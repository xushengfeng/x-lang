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

class functionBlock {
	fun: NativeFunction;
	el: ElType<HTMLElement>;
	posi = { x: 0, y: 0 };
	constructor(id: string) {
		const fun = functionMap.get(id);
		if (!fun) throw new Error(`Function ${id} not found`);
		this.fun = fun;

		this.el = view("y").style({
			position: "absolute",
			backgroundColor: "lightgray",
			padding: "4px",
			border: "1px solid black",
		});
		const title = txt(id);
		this.el.add(title);
		this.el.add(
			txt(
				`${fun.input.map((i) => i.type.type).join(", ")} -> ${fun.output.map((o) => o.type.type).join(", ")}`,
			),
		);

		trackPoint(title, {
			start: () => {
				return { x: this.posi.x, y: this.posi.y };
			},
			ing: (p) => {
				this.setPosi(p.x, p.y);
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
				for (const [blockId, data] of Object.entries(page.code.data)) {
					const fb = new functionBlock(data.functionName);
					fb.el.addInto(baseEditorRoot);
					fb.el.data({ id: blockId });
					const geo = page.geo[blockId];
					if (geo !== undefined) {
						fb.setPosi(geo.x, geo.y);
					} else {
						console.warn(`cant find ${blockId}.geo`);
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
						const fb = new functionBlock(name);
						fb.el.addInto(baseEditor);
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
