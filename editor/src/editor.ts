import {
	addClass,
	addStyle,
	button,
	initDKH,
	textarea,
	trackPoint,
	txt,
	view,
	type ElType,
} from "dkh-ui";
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
	toolsBar.add([
		button("编辑").on("click", () => {
			renderEditor(file);
		}),
		button("奇幻").on("click", () => {
			renderMagic(file);
		}),
	]);
}

function renderEditor(rawfile: FileData) {
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
	// const ioSetter = view().style({ width: "200px" }).addInto(xWarp);

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
						Array.from(funs.keys()).map((name) =>
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

function renderMagic(rawfile: FileData) {
	const file = structuredClone(rawfile);
	const runInfo = new Set<{ fName: string; frameId: string }>();
	let cancelRun = false;
	const xlangEnv = env({
		runInfo: (fName, frameId) => {
			console.log(fName, frameId);
			runInfo.add({ fName, frameId });
		},
		cache: {
			max: 1000,
		},
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

	// 7 8 9
	// 4 5 6
	// 1 2 3
	// 这样用数字坐标
	type FontZb = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
	// 笔画
	type FontBh = FontZb[];
	// 字形
	type font = FontBh[];

	// todo 自动化生成
	const x: Record<string, font> = {
		"value.num": [
			[7, 9],
			[8, 1],
			[1, 3],
		],
		"math.lessEq": [[9, 4, 3]],
		"ctrl.split": [
			[4, 5],
			[5, 9],
			[5, 3],
		],
		"math.subtract": [[7], [1], [4, 6]],
		"math.add": [[7], [1], [4, 6], [2, 8]],
	};

	let magicId = 0;
	for (const [pageId, page] of Object.entries(file.data)) {
		if (pageId === "main") continue;
		x[page.functionId] = [
			[1, 7],
			...number2binFont(magicId, [2, 5, 8, 3, 6, 9]),
		];
		magicId++;
	}

	const fontMap: Record<string, font> = {
		blank: [
			[7, 9],
			[1, 3],
		],
		undefined: [
			[7, 9],
			[9, 3],
			[3, 1],
			[1, 7],
			[1, 9],
			[3, 7],
		],
	};

	function number2binFont(data: number, index: FontZb[]): font {
		const x: font = [];
		const b = data.toString(2);
		for (let i = b.length - 1; i >= 0; i--) {
			if (b[i] === "1") {
				x.push([index[b.length - 1 - i]]);
			}
		}
		return x;
	}

	function io2font(index: number): font {
		const x: font = [
			[4, 7],
			[3, 6],
		];
		x.push(...number2binFont(index, [1, 2, 5, 8, 9]));
		return x;
	}

	baseEditor.clear();

	const viewer = view("x")
		.style({ backgroundColor: "#000", color: "#fff" })
		.addInto(baseEditor);

	const hexGridSize = 400;
	const size = hexGridSize * 2 + hexGridSize;
	const hexGridTopX = size / 2;
	const hexGridTopY = 200;

	const svgNS = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(svgNS, "svg");
	svg.setAttribute("width", String(size));
	svg.setAttribute("height", String(2048));
	svg.style.display = "block";
	svg.style.backgroundColor = "#000";
	viewer.clear();
	viewer.el.appendChild(svg);

	const glyphMap = new Map<string, { els: SVGGElement[]; noHlTimer: number }>();

	const sideBar = view("y").addInto(viewer);
	const inputArea = textarea().addInto(sideBar);
	button("运行")
		.addInto(sideBar)
		.on("click", async () => {
			cancelRun = false;
			const code = inputArea.gv;
			const x = JSON.parse(code);

			runInfo.clear();

			const r = xlangEnv.run(file.data.main.code, x);

			outputArea.sv(JSON.stringify(r, null, 2));

			async function sleep(T: number) {
				return new Promise((resolve) => setTimeout(resolve, T));
			}

			for (const gArr of glyphMap.values()) {
				for (const g of gArr.els) {
					g.classList.add(magicWillHighLightClass);
					g.classList.add(magicHighLightBaseClass);
				}
			}

			function clearHighLight(classList: DOMTokenList) {
				classList.remove(magicHighLight1Class);
				classList.remove(magicHighLight2Class);
				classList.remove(magicHighLight3Class);
			}

			const t = 40;
			const t2 = 100;
			let runCount = 0;
			for (const info of runInfo) {
				if (cancelRun) break;
				const gArr = glyphMap.get(`${info.fName}-${info.frameId}`) ?? {
					els: [],
					noHlTimer: 0,
				};
				for (const g of gArr.els) {
					if (g.classList.contains(magicWillHighLightClass)) {
						g.classList.add(magicHighLight1Class);
					} else if (g.classList.contains(magicHighLight1Class)) {
						clearHighLight(g.classList);
						g.classList.add(magicHighLight2Class);
					} else if (g.classList.contains(magicHighLight2Class)) {
						clearHighLight(g.classList);
						g.classList.add(magicHighLight3Class);
					} else if (g.classList.contains(magicHighLight3Class)) {
						clearHighLight(g.classList);
						g.classList.add(magicHighLight1Class);
					}
					g.classList.remove(magicWillHighLightClass);
					await sleep(t);
				}
				runCount++;
				animateRunProgress.sv(
					`${((runCount / runInfo.size) * 100).toFixed(2)}%`,
				);
				await sleep(t2);
			}
			await sleep(t * 6);

			for (const gArr of glyphMap.values()) {
				for (const g of gArr.els) {
					clearHighLight(g.classList);

					if (g.classList.contains(magicWillHighLightClass)) {
						await sleep(t);
					}
					g.classList.add(magicHighLight1Class);
					g.classList.remove(magicWillHighLightClass);
				}
			}
			await sleep(2000);
			for (const gArr of glyphMap.values()) {
				for (const g of gArr.els) {
					g.classList.remove(magicHighLightBaseClass);
					clearHighLight(g.classList);
				}
			}
		});
	const outputArea = textarea().addInto(sideBar).attr({ readOnly: true });
	const animateRunProgress = txt().addInto(view("x").addInto(sideBar));
	button("取消魔法进行")
		.on("click", () => {
			cancelRun = true;
		})
		.addInto(sideBar);

	const pages = Object.entries(file.data);
	if (pages.length === 0) return;

	const centers: { x: number; y: number }[] = [];
	for (let idx = 0; idx < pages.length; idx++) {
		const stackIdx = Math.floor(idx / 3);
		const x = idx % 3;
		let cx = hexGridTopX;
		let cy = hexGridTopY + stackIdx * hexGridSize;
		if (x === 1) {
			cx += hexGridSize * Math.cos(Math.PI / 6);
			cy += hexGridSize * Math.sin(Math.PI / 6);
		}
		if (x === 2) {
			cx -= hexGridSize * Math.cos(Math.PI / 6);
			cy += hexGridSize * Math.sin(Math.PI / 6);
		}
		centers.push({ x: cx, y: cy });
	}

	const mainColor = "#fff";

	/**
	 *
	 * @param angleRad 弧度
	 * @param radius 模长
	 * @param colWidthRatio 字符宽度，比例表示
	 * @param textHeight 字符高度（1-7距离）
	 * @param font
	 */
	function createFont(
		centerX: number,
		centerY: number,
		angleRad: number,
		radius: number,
		colWidthRatio: number,
		textHeight: number,
		font: font,
	): SVGGElement {
		const g = document.createElementNS(svgNS, "g");

		const posMap: Record<number, [number, number]> = {
			7: [0, 2],
			8: [1, 2],
			9: [2, 2],
			4: [0, 1],
			5: [1, 1],
			6: [2, 1],
			1: [0, 0],
			2: [1, 0],
			3: [2, 0],
		};

		const perRow = textHeight / 2;
		const anglePerCol = colWidthRatio * 2 * Math.PI;

		function gridToGlobalPolar(n: number) {
			const p = posMap[n];
			const col = p[0];
			const row = p[1];
			const colOffset = col - 1;
			const deltaAngle = -colOffset * anglePerCol; // 逆时针转为顺时针
			const radialOffset = row * perRow;
			const finalRadius = radius + radialOffset;
			const finalAngle = angleRad + deltaAngle;

			const gx = centerX + finalRadius * Math.cos(finalAngle);
			const gy = centerY - finalRadius * Math.sin(finalAngle);
			return [gx, gy];
		}

		for (const stroke of font) {
			if (!stroke || stroke.length === 0) continue;
			if (stroke.length === 1) {
				// 点
				const [gx, gy] = gridToGlobalPolar(stroke[0]);
				const circle = document.createElementNS(svgNS, "circle");
				circle.setAttribute("cx", String(gx));
				circle.setAttribute("cy", String(gy));
				circle.setAttribute("r", "2");
				circle.setAttribute("fill", mainColor);
				g.appendChild(circle);
				continue;
			}
			const path = document.createElementNS(svgNS, "path");
			const dParts: string[] = [];
			for (let k = 0; k < stroke.length; k++) {
				const n = stroke[k];
				const [gx, gy] = gridToGlobalPolar(n);
				if (k === 0) dParts.push(`M ${gx} ${gy}`);
				else dParts.push(`L ${gx} ${gy}`);
			}
			path.setAttribute("d", dParts.join(" "));
			path.setAttribute("fill", "none");
			path.setAttribute("stroke", mainColor);
			path.setAttribute("stroke-width", "4");
			path.setAttribute("stroke-linecap", "round");
			path.setAttribute("stroke-linejoin", "round");
			g.appendChild(path);
		}

		svg.appendChild(g);
		return g;
	}
	function renderRing(
		centerX: number,
		centerY: number,
		fonts: { font: font; exData: string; exType: "f" | "i" | "o" | "blank" }[],
		r: number,
		height: number,
		ssArr: ({
			font: font;
			exData: string;
			exType: "f" | "i" | "o" | "blank";
		} & { r: number; a: number })[],
		fName: string,
	) {
		const maxItems = fonts.length;
		const defaultColWidthRatio = (1 / maxItems) * 0.33;
		const defaultTextHeight = height;
		for (let j = 0; j < maxItems; j++) {
			const count = maxItems;
			const angle = Math.PI / 2 - (j / count) * 2 * Math.PI;
			const fontData = fonts[j];
			const gEl = createFont(
				centerX,
				centerY,
				angle,
				r,
				defaultColWidthRatio,
				defaultTextHeight,
				fontData.font,
			);
			ssArr.push({ ...fontData, a: angle, r: r });
			if (
				fontData.exType === "f" ||
				fontData.exType === "i" ||
				fontData.exType === "o"
			) {
				const id = `${fName}-${fontData.exType === "f" ? fontData.exData : fontData.exData.split("-")[0]}`;
				const arr = glyphMap.get(id) ?? { els: [], noHlTimer: 0 };
				arr.els.push(gEl);
				glyphMap.set(id, arr);
			}
			if (fontData.exType === "blank") {
				const id = `${fName}-blank`;
				const arr = glyphMap.get(id) ?? { els: [], noHlTimer: 0 };
				arr.els.push(gEl);
				glyphMap.set(id, arr);
			}
		}
	}

	function drawLinkPolar(
		pathEl: SVGPathElement,
		fromPolar: { r: number; a: number },
		toPolar: { r: number; a: number },
		cx: number,
		cy: number,
		existingArcs: { r: number; a1: number; a2: number }[],
	) {
		const eps = 0.0001;
		// 若半径相等则绘制圆弧
		if (Math.abs(fromPolar.r - toPolar.r) < eps) {
			let r = fromPolar.r;
			// 规范化角度到 (-PI, PI]
			function norm(a: number) {
				while (a <= -Math.PI) a += 2 * Math.PI;
				while (a > Math.PI) a -= 2 * Math.PI;
				return a;
			}
			const a1 = norm(fromPolar.a);
			const a2 = norm(toPolar.a);

			// 计算从 a1 到 a2 的顺时针角度增量（0..2PI)
			function to360(v: number) {
				let t = v;
				while (t < 0) t += 2 * Math.PI;
				while (t >= 2 * Math.PI) t -= 2 * Math.PI;
				return t;
			}
			const a1_360 = to360(a1);
			const a2_360 = to360(a2);
			// 顺时针方向角度差（从 a1 到 a2 顺时针走过的角度）
			let deltaCW = a1_360 - a2_360;
			if (deltaCW < 0) deltaCW += 2 * Math.PI;

			// largeArcFlag 根据顺时针角度是否大于 PI 自动决定；sweepFlag=1 保持顺时针绘制
			const largeArcFlag = deltaCW > Math.PI ? 1 : 0;
			const sweepFlag = 1;

			// 检查与已绘制弧的重叠（在相同或接近半径时）并计算偏移
			const offsetStep = 6;
			let overlapCount = 0;
			for (const ex of existingArcs) {
				if (Math.abs(ex.r - r) > 1) continue;
				const exA1 = to360(ex.a1);
				const exA2 = to360(ex.a2);
				// 当前弧的 CW 覆盖区间用 [s1,e1] 表示（在 0..4PI 范围内确保 e1>=s1）
				const s1 = a2_360;
				let e1 = a1_360;
				if (e1 < s1) e1 += 2 * Math.PI;
				// 已有弧的 CW 覆盖区间
				const s2 = exA2;
				let e2 = exA1;
				if (e2 < s2) e2 += 2 * Math.PI;
				// 若区间在展开空间有交集则认为重叠
				const inter = !(e1 < s2 || e2 < s1);
				if (inter) overlapCount++;
			}
			if (overlapCount > 0) {
				const sign = overlapCount % 2 === 0 ? 1 : -1;
				const n = Math.ceil(overlapCount / 2);
				r = r + sign * n * offsetStep;
			}

			const x1 = cx + r * Math.cos(fromPolar.a);
			const y1 = cy - r * Math.sin(fromPolar.a);
			const x2 = cx + r * Math.cos(toPolar.a);
			const y2 = cy - r * Math.sin(toPolar.a);
			const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${x2} ${y2}`;
			pathEl.setAttribute("d", d);
			existingArcs.push({ r, a1: fromPolar.a, a2: toPolar.a });
		} else {
			// 直线
			const x1 = cx + fromPolar.r * Math.cos(fromPolar.a);
			const y1 = cy - fromPolar.r * Math.sin(fromPolar.a);
			const x2 = cx + toPolar.r * Math.cos(toPolar.a);
			const y2 = cy - toPolar.r * Math.sin(toPolar.a);
			const d = `M ${x1} ${y1} L ${x2} ${y2}`;
			pathEl.setAttribute("d", d);
		}
	}

	// 为每个 page 分别渲染一个圆形布局，排列为六边形格子
	for (let pi = 0; pi < pages.length; pi++) {
		const [, page] = pages[pi];
		const center = centers[pi];

		const cx = center.x;
		const cy = center.y;

		// build items for this page
		const sPage: {
			font: font;
			exData: string;
			exType: "f" | "i" | "o" | "blank";
			funcName?: string;
		}[] = [];
		const ssPage: ((typeof sPage)[number] & { r: number; a: number })[] = [];

		for (const [name, f] of Object.entries(page.code.data)) {
			if (!x[f.functionName]) {
				console.warn(`${f.functionName} magic font unfind`);
			}
			sPage.push({
				font: x[f.functionName] ?? fontMap.undefined,
				exData: name,
				exType: "f",
				funcName: f.functionName,
			});
			const fun = functionMap.get(f.functionName);
			if (!fun) continue;
			for (let i = 0; i < fun.input.length; i++) {
				sPage.push({
					font: io2font(i),
					exType: "i",
					exData: `${name}-i-${fun.input[i].name}`,
				});
			}
			for (let i = 0; i < fun.output.length; i++) {
				sPage.push({
					font: io2font(i),
					exType: "o",
					exData: `${name}-o-${fun.output[i].name}`,
				});
			}
		}

		const ringXr: { len: number; r: number; h: number }[] = [
			{ len: 13, r: 60, h: 24 },
			{ len: 23, r: 120, h: 24 },
			{ len: 31, r: 180, h: 24 },
		];
		const ringX: typeof ringXr = [];

		let allLen = 0;
		for (const i of ringXr) {
			if (allLen >= sPage.length) break;
			ringX.push(i);
			allLen += i.len;
		}
		if (allLen < sPage.length) {
			ringX.push({
				len: Math.max(42, sPage.length - allLen),
				r: 240,
				h: 24,
			});
		}
		const dLen = allLen - sPage.length;
		const lastRingLen = ringX.length ? (ringX.at(-1)?.len ?? 1) : 1;
		const xi = Math.ceil(dLen / (lastRingLen - dLen));

		for (let i = 0; i < dLen; i++) {
			const ni = i + Math.floor(i / xi);
			sPage.splice(sPage.length - ni, 0, {
				font: fontMap.blank,
				exData: "",
				exType: "blank",
			});
		}

		const linkGroup = document.createElementNS(svgNS, "g");
		svg.appendChild(linkGroup);

		let usedCont = 0;
		for (const { len, r, h } of ringX) {
			const length = len === 0 ? sPage.length - usedCont : len;
			renderRing(
				cx,
				cy,
				sPage.slice(usedCont, usedCont + length),
				r,
				h,
				ssPage,
				page.functionId,
			);
			usedCont += length;
			if (usedCont >= sPage.length) break;
		}

		const existingArcs: { r: number; a1: number; a2: number }[] = [];

		const pageCode = page.code.data;
		for (const [fromId, fromData] of Object.entries(pageCode)) {
			if (!fromData.next) continue;
			for (const n of fromData.next) {
				const toId = n.id;
				const oItem = ssPage.find(
					(i) => i.exType === "o" && i.exData === `${fromId}-o-${n.fromKey}`,
				);
				if (!oItem) continue;
				const iItem = ssPage.find(
					(i) => i.exType === "i" && i.exData === `${toId}-i-${n.toKey}`,
				);
				if (!iItem) continue;
				// 为避免与字形重叠，向内移动一点半径
				const fromPolar = { r: oItem.r - 8, a: oItem.a };
				const toPolar = { r: iItem.r - 8, a: iItem.a };
				const path = document.createElementNS(svgNS, "path");
				path.setAttribute("fill", "none");
				path.setAttribute("stroke", mainColor);
				path.setAttribute("stroke-width", "2");
				drawLinkPolar(path, fromPolar, toPolar, cx, cy, existingArcs);
				linkGroup.appendChild(path);
			}
		}

		const outerCircle = ringX.at(-1);
		if (outerCircle) {
			const circle = document.createElementNS(svgNS, "circle");
			circle.setAttribute("cx", String(cx));
			circle.setAttribute("cy", String(cy));
			circle.setAttribute("r", String(outerCircle.r + outerCircle.h + 8));
			circle.setAttribute("fill", "none");
			circle.setAttribute("stroke", mainColor);
			circle.setAttribute("stroke-width", "4");
			svg.appendChild(circle);
		}
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

addStyle({
	textarea: {
		backgroundColor: "transparent",
	},
});

const magicHighLightBaseClass = addClass(
	{},
	{
		"& > *": {
			filter: `drop-shadow(0 0 4px #be78ffff)`,
			transition: "0.1s",
		},
		"& > path": {
			stroke: "var(--c)",
		},
		"& > circle": {
			fill: "var(--c)",
		},
	},
);
const magicHighLight1Class = addClass(
	{},
	{
		"& > *": {
			"--c": "oklch(64.44% 0.27 300deg)",
		},
	},
);
const magicHighLight2Class = addClass(
	{},
	{
		"& > *": {
			"--c": "oklch(64.44% 0.27 270deg)",
		},
	},
);
const magicHighLight3Class = addClass(
	{},
	{
		"& > *": {
			"--c": "oklch(64.44% 0.27 330deg)",
		},
	},
);

const magicWillHighLightClass = addClass(
	{},
	{
		"& > path": {
			stroke: "#fff5",
		},
		"& > circle": {
			fill: "#fff5",
		},
	},
);

// for test

renderFile({
	display: {
		type: "block",
	},
	data: {
		main: {
			functionId: "main",
			code: {
				input: [
					{
						name: "it",
						mapKey: { id: "0", key: "num" },
						type: { type: "num" },
					},
				],
				output: [
					{
						name: "out",
						mapKey: { id: "0", key: "num" },
						type: { type: "num" },
					},
				],
				data: {
					"0": {
						functionName: "fib",
						next: [],
					},
				},
			},
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
