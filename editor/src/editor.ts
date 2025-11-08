import { initDKH, trackPoint, txt, view, type ElType } from "dkh-ui";
import { env, type NativeFunction, type XFunction } from "../../src/main";

import { fibCode } from "../../test/test_data";

type DataItem = {
	functionId: string;
	code: XFunction;
	geo: Record<
		string,
		{
			x: number;
			y: number;
		}
	>;
};

type FileData = {
	display: {
		type: "block";
	};
	data: { main: DataItem } & Record<string, DataItem>;
};

const functionMap = new Map<string, NativeFunction>();

const thisViewBlock = new Map<string, functionBlock>();

class functionBlock {
	fun: NativeFunction;
	el: ElType<HTMLElement>;
	posi = { x: 0, y: 0 };
	private slots = {
		inputs: [] as (NativeFunction["input"][number] & {
			el: ElType<HTMLElement>;
		})[],
		outputs: [] as (NativeFunction["output"][number] & {
			el: ElType<HTMLElement>;
		})[],
	};
	private outLinks: {
		fromKey: string;
		to: functionBlock;
		toKey: string;
		path: SVGPathElement;
	}[] = [];
	private inLinks: {
		from: functionBlock;
		fromKey: string;
		toKey: string;
		path: SVGPathElement;
	}[] = [];
	private linker: ElType<HTMLElement>;
	constructor(op: { functionName: string; linker: ElType<HTMLElement> }) {
		const fun = functionMap.get(op.functionName);
		if (!fun) throw new Error(`Function ${op.functionName} not found`);
		this.fun = fun;

		this.linker = op.linker;

		this.el = view("y").style({
			position: "absolute",
			backgroundColor: "lightgray",
			padding: "4px",
			border: "1px solid black",
		});
		const title = txt(op.functionName);
		this.el.add(title);
		const slot = view("x").style({ gap: "8px" }).addInto(this.el);
		const inputEl = view("y").addInto(slot);
		const outputEl = view("y").style({ alignItems: "end" }).addInto(slot);

		this.slots.inputs = fun.input.map((i) => {
			const e = txt(i.name + ":" + i.type.type);
			return { ...i, el: e };
		});
		this.slots.outputs = fun.output.map((o) => {
			const e = txt(o.name + ":" + o.type.type);
			return { ...o, el: e };
		});

		inputEl.add(this.slots.inputs.map((i) => i.el));
		outputEl.add(this.slots.outputs.map((o) => o.el));

		trackPoint(title, {
			start: () => {
				return { x: this.posi.x, y: this.posi.y };
			},
			ing: (p) => {
				this.setPosi(p.x, p.y);
				this.redrawLinkedPaths();
			},
		});
	}
	setPosi(x: number, y: number) {
		this.el.style({
			top: `${y}px`,
			left: `${x}px`,
		});
		this.posi = { x, y };
	}
	getSlots() {
		return this.slots;
	}
	static ensureSvg(linker: ElType<HTMLElement>): SVGSVGElement | null {
		const root = linker.el;
		let svg = root.querySelector(
			'svg[data-linker-svg="true"]',
		) as SVGSVGElement | null;
		if (!svg) {
			svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.setAttribute("data-linker-svg", "true");
			svg.style.position = "absolute";
			svg.style.top = "0";
			svg.style.left = "0";
			svg.style.width = "100%";
			svg.style.height = "100%";
			svg.style.overflow = "visible";
			root.appendChild(svg);
		}
		return svg;
	}
	static getSlotPoint(
		linker: ElType<HTMLElement>,
		block: functionBlock,
		kind: "in" | "out",
		key: string,
	): { x: number; y: number } | null {
		const el = block
			.getSlots()
			[kind === "in" ? "inputs" : "outputs"].find((s) => s.name === key)?.el;
		const root = linker.el;
		if (!el || !root) return null;
		const r = el.el.getBoundingClientRect();
		const lr = root.getBoundingClientRect();
		const x = kind === "out" ? r.right - lr.left : r.left - lr.left;
		const y = r.top - lr.top + r.height / 2;
		return { x, y };
	}
	static drawCurve(
		pathEl: SVGPathElement,
		from: { x: number; y: number },
		to: { x: number; y: number },
	) {
		const dx = Math.abs(to.x - from.x);
		const c = Math.max(40, dx * 0.4);
		const d = `M ${from.x} ${from.y} C ${from.x + c} ${from.y}, ${to.x - c} ${to.y}, ${to.x} ${to.y}`;
		pathEl.setAttribute("d", d);
	}
	linkTo(target: functionBlock, fromKey: string, toKey: string) {
		const svg = functionBlock.ensureSvg(this.linker);
		if (!svg) return;
		const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
		path.setAttribute("fill", "none");
		path.setAttribute("stroke", "#555");
		path.setAttribute("stroke-width", "2");
		svg.appendChild(path);
		this.outLinks.push({ fromKey, to: target, toKey, path });
		target.inLinks.push({ from: this, fromKey, toKey, path });
		this.redrawPath(path, this, fromKey, target, toKey);
	}
	private redrawPath(
		path: SVGPathElement,
		fromBlock: functionBlock,
		fromKey: string,
		toBlock: functionBlock,
		toKey: string,
	) {
		const from = functionBlock.getSlotPoint(
			this.linker,
			fromBlock,
			"out",
			fromKey,
		);
		const to = functionBlock.getSlotPoint(this.linker, toBlock, "in", toKey);
		if (!from || !to) return;
		functionBlock.drawCurve(path, from, to);
	}
	redrawLinkedPaths() {
		for (const l of this.outLinks) {
			this.redrawPath(l.path, this, l.fromKey, l.to, l.toKey);
		}
		for (const l of this.inLinks) {
			this.redrawPath(l.path, l.from, l.fromKey, this, l.toKey);
		}
	}
}

function renderFile(file: FileData) {
	const xlangEnv = env();

	baseEditor.clear();
	const pageSelect = view();
	const viewer = view().style({ flexGrow: 1, position: "relative" });
	baseEditor.add([pageSelect, viewer]);
	const baseEditorRoot = view().style({ position: "absolute" }).addInto(viewer);

	for (const [pageId, page] of Object.entries(file.data)) {
		if (pageId === "main") continue;
		xlangEnv.addFunction(page.functionId, page.code);
	}
	functionMap.clear();
	const funs = xlangEnv.getFunctions();
	for (const [name, fun] of Object.entries(funs)) {
		functionMap.set(name, fun);
	}

	for (const [pageId, page] of Object.entries(file.data)) {
		pageSelect.add(
			txt(pageId).on("click", () => {
				baseEditorRoot.clear();

				const linker = view()
					.style({
						position: "absolute",
						top: "0",
						left: "0",
						pointerEvents: "none",
						width: "100%",
						height: "100%",
					})
					.addInto(baseEditorRoot);
				linker.data({ role: "linker" });

				const svg = functionBlock.ensureSvg(linker);
				if (svg) svg.innerHTML = "";
				thisViewBlock.clear();
				for (const [blockId, data] of Object.entries(page.code.data)) {
					const fb = new functionBlock({
						functionName: data.functionName,
						linker,
					});
					fb.el.addInto(baseEditorRoot);
					fb.el.data({ id: blockId });
					thisViewBlock.set(blockId, fb);
					const geo = page.geo[blockId];
					if (geo) fb.setPosi(geo.x, geo.y);
				}
				for (const [fromId, fromData] of Object.entries(page.code.data)) {
					for (const n of fromData.next) {
						const fromBlock = thisViewBlock.get(fromId);
						const toBlock = thisViewBlock.get(n.id);
						if (fromBlock && toBlock)
							fromBlock.linkTo(toBlock, n.fromKey, n.toKey);
					}
				}
			}),
		);
	}
}

initDKH({ pureStyle: true });

const mainDiv = view("y")
	.style({
		width: "100vw",
		height: "100vh",
	})
	.addInto();

const toolsBar = view().addInto(mainDiv);
const viewer = view().style({ flexGrow: 1 }).addInto(mainDiv);

const baseEditor = view()
	.style({ width: "100%", height: "100%" })
	.on("contextmenu", (e) => {
		e.preventDefault();
		let baseX = 0;
		let baseY = 0;
		const x = e.clientX - baseX;
		const y = e.clientY - baseY;
		const menu = view()
			.style({
				position: "absolute",
				top: `${y}px`,
				left: `${x}px`,
				backgroundColor: "white",
				border: "1px solid black",
				maxHeight: "200px",
				overflow: "auto",
				padding: "4px",
				zIndex: 1000,
			})
			.addInto(baseEditor);
		const funs = functionMap;
		menu.add(
			Object.entries(funs).map(([name, f]) =>
				view()
					.add(txt(name))
					.on("click", () => {
						menu.remove();
						console.log(name, f);
						// const fb = new functionBlock(name);
						// fb.el.addInto(baseEditor);
						// todo
					}),
			),
		);
	})
	.addInto(viewer);

// for test

renderFile({
	display: {
		type: "block",
	},
	data: {
		main: {
			functionId: "main",
			code: { input: [], output: [], data: {} },
			geo: {},
		},
		xxx: {
			functionId: "fib",
			code: fibCode,
			geo: {
				0: { x: 35, y: 150 },
				constLess1: { x: 200, y: 125 },
				less: { x: 348, y: 155 },
				splitX: { x: 500, y: 159 },
				constSub1: { x: 611, y: 125 },
				constSub2: { x: 611, y: 313 },
				sub1: { x: 758, y: 130 },
				sub2: { x: 758, y: 323 },
				fib1: { x: 933, y: 135 },
				fib2: { x: 933, y: 335 },
				add: { x: 1024, y: 245 },
				out: { x: 1247, y: 221 },
			},
		},
	},
});
