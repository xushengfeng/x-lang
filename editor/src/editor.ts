import { button, initDKH, trackPoint, txt, view, type ElType } from "dkh-ui";
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

let fileData: FileData | undefined;

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
	private events: { blockMoveEnd: () => void } = { blockMoveEnd: () => {} };
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
			end: () => {
				this.emit("blockMoveEnd");
			},
		});
	}
	private emit(key: keyof typeof this.events) {
		this.events[key]();
	}
	setPosi(x: number, y: number) {
		const myRect = this.getRect({ dx: 4, dy: 4 });
		const otherRect = Array.from(thisViewBlock.values())
			.filter((i) => i !== this)
			.map((b) => b.getRect({ dx: 4, dy: 4 }));

		const dx = myRect.width / 2;
		const dy = myRect.height / 2;

		const cx = x + dx;
		const cy = y + dy;

		const xs = otherRect
			.map((r) => r.left - dx)
			.concat(otherRect.map((r) => r.right + dx))
			.concat([cx]);
		const ys = otherRect
			.map((r) => r.top - dy)
			.concat(otherRect.map((r) => r.bottom + dy))
			.concat([cy]);

		const points = xs
			.flatMap((px) =>
				ys.map((py) => ({ x: px, y: py, rq: (px - cx) ** 2 + (py - cy) ** 2 })),
			)
			.sort((a, b) => a.rq - b.rq);

		for (const p of points) {
			const thisRect = {
				left: p.x - dx,
				right: p.x + dx,
				top: p.y - dy,
				bottom: p.y + dy,
			};
			const overlap = otherRect.some((r) => {
				return (
					Math.max(thisRect.right, r.right) - Math.min(thisRect.left, r.left) <
						thisRect.right - thisRect.left + r.width &&
					Math.max(thisRect.bottom, r.bottom) - Math.min(thisRect.top, r.top) <
						thisRect.bottom - thisRect.top + r.height
				);
			});
			if (overlap) continue;
			else 1;
			x = p.x - dx;
			y = p.y - dy;
			break;
		}

		this.el.style({
			top: `${y}px`,
			left: `${x}px`,
		});
		this.posi = { x, y };
		return this.posi;
	}
	getRect(padding = { dx: 0, dy: 0 }) {
		const rect = this.el.el.getBoundingClientRect();
		return {
			left: this.posi.x - padding.dx,
			top: this.posi.y - padding.dy,
			right: this.posi.x + rect.width + padding.dx,
			bottom: this.posi.y + rect.height + padding.dy,
			width: rect.width + padding.dx * 2,
			height: rect.height + padding.dy * 2,
		};
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
		const x = kind === "out" ? r.right - lr.left + 4 : r.left - lr.left - 4;
		const y = r.top - lr.top + r.height / 2;
		return { x, y };
	}
	static drawCurve(
		pathEl: SVGPathElement,
		from: { x: number; y: number },
		to: { x: number; y: number },
	) {
		const dx = Math.abs(to.x - from.x);
		let c = Math.max(40, dx * 0.4);
		if (from.x + c > to.x - c) {
			c = Math.abs(from.x - (from.x + to.x) / 2);
		}
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

	on<K extends keyof typeof this.events>(
		event: K,
		cb: (typeof this.events)[K],
	) {
		this.events[event] = cb;
	}
}

function renderFile(rawfile: FileData) {
	const file = structuredClone(rawfile);
	const xlangEnv = env();

	const vp = { x: 0, y: 0 };

	baseEditor.clear();
	const pageSelect = view();
	const xWarp = view("x").style({ flexGrow: 1 });
	const viewer = view("x")
		.style({ flexGrow: 1, position: "relative", overflow: "hidden" })
		.addInto(xWarp);
	baseEditor.add([pageSelect, xWarp]);
	const baseEditorRoot = view().style({ position: "absolute" }).addInto(viewer);
	const ioSetter = view().style({ width: "200px" }).addInto(xWarp);

	viewer.on("wheel", (e) => {
		e.preventDefault();
		vp.x -= e.deltaX;
		vp.y -= e.deltaY;
		baseEditorRoot.style({
			left: `${vp.x}px`,
			top: `${vp.y}px`,
		});
	});

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

				function addBlock(blockId: string) {
					const data = page.code.data[blockId];
					const fb = new functionBlock({
						functionName: data.functionName,
						linker,
					});
					fb.el.addInto(baseEditorRoot);
					fb.el.data({ id: blockId });
					thisViewBlock.set(blockId, fb);
					const geo = page.geo[blockId];
					if (geo) fb.setPosi(geo.x, geo.y);

					fb.on("blockMoveEnd", () => {
						page.geo[blockId] = { x: fb.posi.x, y: fb.posi.y };
						fileData = structuredClone(file);
					});
				}
				function linkBlock(fromId: string) {
					const fromData = page.code.data[fromId];
					for (const n of fromData.next) {
						const fromBlock = thisViewBlock.get(fromId);
						const toBlock = thisViewBlock.get(n.id);
						if (fromBlock && toBlock)
							fromBlock.linkTo(toBlock, n.fromKey, n.toKey);
					}
				}

				for (const blockId of Object.keys(page.code.data)) {
					addBlock(blockId);
				}
				for (const fromId of Object.keys(page.code.data)) {
					linkBlock(fromId);
				}

				viewer.el.oncontextmenu = (e) => {
					e.preventDefault();
					const x = e.clientX;
					const y = e.clientY;
					const menu = view()
						.style({
							position: "fixed",
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
						Array.from(funs.entries()).map(([name, f]) =>
							view()
								.add(txt(name))
								.on("click", () => {
									menu.remove();
									const id = crypto.randomUUID().slice(0, 8);
									page.code.data[id] = {
										functionName: name,
										next: [],
									};
									const rootRect = baseEditorRoot.el.getBoundingClientRect();
									page.geo[id] = {
										x: x - rootRect.x,
										y: y - rootRect.y,
									};
									fileData = structuredClone(file);
									addBlock(id);
								}),
						),
					);
				};
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

button("导出")
	.on("click", () => {
		console.log(fileData);
	})
	.addInto(toolsBar);

const viewer = view().style({ flexGrow: 1 }).addInto(mainDiv);

const baseEditor = view("y")
	.style({ width: "100%", height: "100%" })
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
				constLess1: { x: 116, y: 274 },
				less: { x: 293, y: 84 },
				splitX: { x: 500, y: 159 },
				constSub1: { x: 522, y: 55 },
				constSub2: { x: 470, y: 327 },
				sub1: { x: 756, y: 97 },
				sub2: { x: 758, y: 323 },
				fib1: { x: 933, y: 135 },
				fib2: { x: 933, y: 335 },
				add: { x: 1175, y: 260 },
				out: { x: 1430, y: 212 },
			},
		},
	},
});
