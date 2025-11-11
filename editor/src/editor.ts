import {
	a,
	addClass,
	addStyle,
	button,
	check,
	initDKH,
	input,
	spacer,
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

let lastClick:
	| {
			type: "link";
			block: functionBlock;
			xType: "in" | "out";
			key: string;
	  }
	| {
			type: "bindIo";
			xType: "in" | "out";
			cb: (blockId: string, key: string) => void;
	  }
	| null = null;

class functionBlock {
	id: string;
	fun: NativeFunction;
	el: ElType<HTMLElement>;
	posi = { x: 0, y: 0 };
	private slots = {
		inputs: [] as (NativeFunction["input"][number] & {
			el: ElType<HTMLElement>;
			defaultInput?: ElType<HTMLElement>;
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
	private events: {
		blockMoveEnd: () => void;
		blockRemove: () => void;
		linkAdd: (to: functionBlock, fromKey: string, toKey: string) => void;
		linkRemove: (to: functionBlock, fromKey: string, toKey: string) => void;
		defaultValue: (key: string, value: unknown) => void;
	} = {
		blockMoveEnd: () => {},
		blockRemove: () => {},
		linkAdd: () => {},
		linkRemove: () => {},
		defaultValue: () => {},
	};
	constructor(op: {
		id: string;
		functionName: string;
		linker: ElType<HTMLElement>;
	}) {
		this.id = op.id;
		const fun = functionMap.get(op.functionName);
		if (!fun) throw new Error(`Function ${op.functionName} not found`);
		this.fun = fun;

		this.linker = op.linker;

		this.el = view("y")
			.style({
				position: "absolute",
			})
			.class(editorBlockBaseClass);
		const title = view("x");
		const titleT = txt(op.functionName)
			.style({ flexGrow: 1, userSelect: "none" })
			.addInto(title);
		button("x")
			.class(editorBlockCloseButtonClass)
			.on("click", () => {
				this.el.remove();
				for (const link of this.inLinks) {
					link.from.unLinkTo(this, link.fromKey, link.toKey);
					link.from.emit("linkRemove", this, link.fromKey, link.toKey);
				}
				for (const link of this.outLinks) {
					this.unLinkTo(link.to, link.fromKey, link.toKey);
					this.emit("linkRemove", link.to, link.fromKey, link.toKey);
				}
				this.emit("blockRemove");
			})
			.addInto(title);
		this.el.add(title);
		const slot = view("x").style({ gap: "8px" }).addInto(this.el);
		const inputEl = view("y").addInto(slot);
		const outputEl = view("y").style({ alignItems: "end" }).addInto(slot);

		this.slots.inputs = fun.input.map((i) => {
			const e = txt(`${i.name}:${i.type.type}`);
			e.on("click", () => {
				if (lastClick === null) {
					const thisInputSlots = this.inLinks.filter((x) => x.toKey === i.name);
					if (thisInputSlots.length === 1) {
						const thisInputSlot = thisInputSlots[0];
						thisInputSlot.from.unLinkTo(this, thisInputSlot.fromKey, i.name);
						thisInputSlot.from.emit(
							"linkAdd",
							this,
							thisInputSlot.fromKey,
							i.name,
						);
						lastClick = {
							type: "link",
							block: thisInputSlot.from,
							xType: "out",
							key: thisInputSlot.fromKey,
						};
					} // 目前只能从to到from
				} else if (lastClick.type === "link" && lastClick.xType === "in") {
				} else if (lastClick.type === "link" && lastClick.xType === "out") {
					const l = { ...lastClick };
					const lastSlot = lastClick.block
						.getSlots()
						.outputs.find((o) => o.name === l.key);
					if (lastSlot) {
						if (
							lastSlot.type.type === i.type.type ||
							lastSlot.type.type === "any" ||
							i.type.type === "any" ||
							lastSlot.type.type === "auto" || // todo 计算auto
							i.type.type === "auto" ||
							lastSlot.type.type === "or"
						) {
							l.block.linkTo(this, l.key, i.name);
							l.block.emit("linkAdd", this, l.key, i.name);
							lastClick = null;
						}
					}
				}
				if (lastClick?.type === "bindIo" && lastClick.xType === "in") {
					lastClick.cb(this.id, i.name);
				}
			});
			let di: ElType<HTMLElement> | undefined;
			if (
				i.type.type === "bool" ||
				i.type.type === "string" ||
				i.type.type === "num"
			) {
				di = typedDataInput(i.type.type).on("change", () => {
					this.emit("defaultValue", i.name, di?.gv);
				});
			}
			return { ...i, el: e, defaultInput: di };
		});
		this.slots.outputs = fun.output.map((o) => {
			const e = txt(`${o.name}:${o.type.type}`).style({ cursor: "pointer" });
			e.on("click", () => {
				if (lastClick === null) {
					lastClick = { type: "link", block: this, xType: "out", key: o.name };
				} else if (lastClick.type === "link" && lastClick.xType === "out") {
					lastClick = { type: "link", block: this, xType: "out", key: o.name };
				} else if (lastClick.type === "link" && lastClick.xType === "in") {
				}
				if (lastClick?.type === "bindIo" && lastClick.xType === "out") {
					lastClick.cb(this.id, o.name);
				}
			});
			return { ...o, el: e };
		});

		inputEl.add(
			this.slots.inputs.map((i) => view("y").add(i.el).add(i.defaultInput)),
		);
		outputEl.add(this.slots.outputs.map((o) => o.el));

		trackPoint(titleT, {
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
	private emit<K extends keyof typeof this.events>(
		key: K,
		...args: Parameters<(typeof this.events)[K]>
	) {
		const fn = this.events[key] as unknown as (...a: unknown[]) => void;
		if (fn) fn(...(args as unknown[]));
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
	async linkTo(target: functionBlock, fromKey: string, toKey: string) {
		const svg = functionBlock.ensureSvg(this.linker);
		if (!svg) return;
		const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
		path.setAttribute("fill", "none");
		path.setAttribute("stroke", "#555");
		path.setAttribute("stroke-width", "2");
		path.style.pointerEvents = "all";
		path.style.cursor = "pointer";
		path.ondblclick = () => {
			this.unLinkTo(target, fromKey, toKey);
			this.emit("linkRemove", target, fromKey, toKey);
		};
		svg.appendChild(path);
		this.outLinks.push({ fromKey, to: target, toKey, path });
		target.inLinks.push({ from: this, fromKey, toKey, path });

		target
			.getSlots()
			.inputs.find((i) => i.name === toKey)
			?.defaultInput?.style({ display: "none" });
		await sleep(10);
		this.redrawPath(path, this, fromKey, target, toKey);
		target.redrawLinkedPaths();
	}
	unLinkTo(target: functionBlock, fromKey: string, toKey: string) {
		const svg = functionBlock.ensureSvg(this.linker);
		if (!svg) return;
		const path = this.outLinks.find(
			(x) => x.fromKey === fromKey && x.toKey === toKey && x.to === target,
		);
		if (path) {
			svg.removeChild(path.path);
			this.outLinks = this.outLinks.filter((x) => x !== path);
			target.inLinks = target.inLinks.filter(
				(x) => !(x.from === this && x.fromKey === fromKey && x.toKey === toKey),
			);
		}
		target
			.getSlots()
			.inputs.find((i) => i.name === toKey)
			?.defaultInput?.style({ display: "" });
		target.redrawLinkedPaths();
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
	setDefaultInput(key: string, value: unknown) {
		this.getSlots()
			.inputs.find((i) => i.name === key)
			?.defaultInput?.sv(value);
	}
	on<K extends keyof typeof this.events>(
		event: K,
		cb: (typeof this.events)[K],
	) {
		this.events[event] = cb;
	}
}

async function sleep(T: number) {
	return new Promise((resolve) => setTimeout(resolve, T));
}

async function zip(text: string) {
	const encoder = new TextEncoder();
	const data = encoder.encode(text);

	// 使用CompressionStream进行gzip压缩
	const cs = new CompressionStream("gzip");
	const writer = cs.writable.getWriter();
	writer.write(data);
	writer.close();
	const compressed = await new Response(cs.readable).arrayBuffer();
	const compressedArray = new Uint8Array(compressed);

	return uint8ArrayToBase64Url(compressedArray);
}

async function unzip(base64Url: string) {
	const compressedArray = base64UrlToUint8Array(base64Url);
	const cs = new DecompressionStream("gzip");
	const writer = cs.writable.getWriter();
	writer.write(compressedArray as BufferSource);
	writer.close();
	const decompressed = await new Response(cs.readable).arrayBuffer();
	return new TextDecoder().decode(decompressed);
}

function uint8ArrayToBase64(uint8Array: Uint8Array): string {
	let binary = "";
	const len = uint8Array.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(uint8Array[i]);
	}
	return btoa(binary);
}

// Base64 转 Uint8Array (标准)
function base64ToUint8Array(base64: string): Uint8Array {
	const binaryString = atob(base64);
	const len = binaryString.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes;
}

// Uint8Array 转 Base64 (URL安全)
function uint8ArrayToBase64Url(uint8Array: Uint8Array): string {
	return uint8ArrayToBase64(uint8Array)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");
}

// Base64 转 Uint8Array (URL安全)
function base64UrlToUint8Array(base64Url: string): Uint8Array {
	// 添加padding
	let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
	while (base64.length % 4) {
		base64 += "=";
	}
	return base64ToUint8Array(base64);
}

function renderFile(rawfile: FileData) {
	const file = structuredClone(rawfile);
	fileData = file;
	renderEditor(file);
	toolsBar.add([
		button("编辑").on("click", () => {
			if (fileData) renderEditor(fileData);
		}),
		button("奇幻").on("click", () => {
			if (fileData) renderMagic(fileData);
		}),
	]);
}

function typedDataInput(type: "num" | "string" | "bool") {
	const el = view();
	function change() {
		el.el.dispatchEvent(new CustomEvent("change"));
	}
	if (type === "num") {
		const inputX = input("number")
			.style({ maxWidth: "60px" })
			.on("change", change);
		return el
			.add(inputX)
			.bindGet(() => {
				const v = Number(inputX.gv);
				if (Number.isNaN(v)) {
					return 0;
				}
				return v;
			})
			.bindSet((v: number) => inputX.sv(String(v)));
	}
	if (type === "string") {
		const inputX = input("text")
			.style({ maxWidth: "60px" })
			.on("change", change);
		return el
			.add(inputX)
			.bindGet(() => {
				return inputX.gv;
			})
			.bindSet((v: string) => inputX.sv(v));
	}
	if (type === "bool") {
		const inputX = check("").on("change", change);
		return el
			.add(inputX)
			.bindGet(() => inputX.gv)
			.bindSet((v: boolean) => inputX.sv(v));
	}
	return el;
}

function superArgsInput() {
	const data = new Map<string, { el: ElType<HTMLElement>; type: string }>();
	const el = view("y")
		.bindSet((v: Record<string, unknown>) => {
			el.clear();
			data.clear();
			for (const [k, val] of Object.entries(v)) {
				const inputEl = typedDataInput(
					typeof val === "number"
						? "num"
						: typeof val === "string"
							? "string"
							: typeof val === "boolean"
								? "bool"
								: "string",
				);
				el.add(
					view("x")
						.style({ justifyContent: "space-between" })
						.add([txt(k), inputEl]),
				);
				data.set(k, { el: inputEl, type: typeof val });
			}
		})
		.bindGet(() => {
			const jsonI: string[] = [];
			for (const [k, inputEl] of data.entries()) {
				const v = inputEl.el.gv;
				jsonI.push(
					`"${k}":${inputEl.type === "number" || inputEl.type === "string" || inputEl.type === "boolean" ? JSON.stringify(v) : v}`,
				);
			}
			return JSON.parse(`{${jsonI.join(",")}}`);
		});

	return el;
}

function renderEditor(rawfile: FileData) {
	const file = structuredClone(rawfile);
	const xlangEnv = env({
		runInfo: (fName, frameId) => {
			runInfo.add({ fName, frameId });
		},
		cache: { max: 1000 },
	});
	const runInfo = new Set<{ fName: string; frameId: string }>();
	let runCancel = false;

	const vp = { x: 0, y: 0 };

	baseEditor.clear();
	const pageSelectP = view("x");
	const pageSelect = view("x").style({ gap: "4px" }).addInto(pageSelectP);
	const xWarp = view("x").style({ flexGrow: 1 });
	const viewer = view("x")
		.style({ flexGrow: 1, position: "relative", overflow: "hidden" })
		.addInto(xWarp);
	baseEditor.add([pageSelectP, xWarp]);
	const baseEditorRoot = view().style({ position: "absolute" }).addInto(viewer);
	const ioSetter = view("y").style({ width: "120px" }).addInto(xWarp);

	viewer.on("wheel", (e) => {
		e.preventDefault();
		vp.x -= e.deltaX;
		vp.y -= e.deltaY;
		baseEditorRoot.style({
			left: `${vp.x}px`,
			top: `${vp.y}px`,
		});
	});

	trackPoint(viewer, {
		start: (e) => {
			if (e.target === viewer.el) {
				return { x: vp.x, y: vp.y };
			}
		},
		ing: (p) => {
			vp.x = p.x;
			vp.y = p.y;
			baseEditorRoot.style({
				left: `${vp.x}px`,
				top: `${vp.y}px`,
			});
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

	for (const [_, page] of Object.entries(file.data)) {
		const selectItem = txt(page.functionId).on("click", () => {
			render(page, selectItem);
		});
		pageSelect.add(selectItem);
	}
	pageSelectP.add(
		button("+").on("click", () => {
			const newPageId = `page_${Date.now()}`;
			const newFunctionId = `function_${Date.now()}`;
			const newPage: DataItem = {
				functionId: newFunctionId,
				code: {
					input: [],
					output: [],
					data: {},
				},
				geo: {},
			};
			file.data[newPageId] = newPage;
			const f = xlangEnv.addFunction(newFunctionId, newPage.code);
			functionMap.set(newFunctionId, f);
			const selectItem = txt(newPage.functionId).on("click", () => {
				render(newPage, selectItem);
			});
			pageSelect.add(selectItem);
			render(newPage, selectItem);
		}),
	);
	render(file.data.main, view());
	function render(page: DataItem, selectItem: ElType<HTMLElement>) {
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
				id: blockId,
				functionName: data.functionName,
				linker,
			});
			fb.el.addInto(baseEditorRoot);
			fb.el.data({ id: blockId });
			thisViewBlock.set(blockId, fb);
			const geo = page.geo[blockId];
			if (geo) fb.setPosi(geo.x, geo.y);
			for (const [k, v] of Object.entries(data.defaultValues || {})) {
				fb.setDefaultInput(k, v);
			}

			fb.on("blockMoveEnd", () => {
				page.geo[blockId] = { x: fb.posi.x, y: fb.posi.y };
				fileData = structuredClone(file);
				fileChange();
			});

			fb.on("blockRemove", () => {
				delete page.code.data[blockId];
				delete page.geo[blockId];
				thisViewBlock.delete(blockId);
				fileData = structuredClone(file);
				fileChange();
			});

			fb.on("linkAdd", (to, fromKey, toKey) => {
				const fromId = fb.id;
				const toId = to.id;
				if (!page.code.data[fromId].next) page.code.data[fromId].next = [];
				const nextArr = page.code.data[fromId].next;
				const exists = nextArr.find(
					(n) => n.id === toId && n.fromKey === fromKey && n.toKey === toKey,
				);
				if (!exists) nextArr.push({ id: toId, fromKey, toKey });
				fileData = structuredClone(file);
				fileChange();
			});

			fb.on("linkRemove", (to, fromKey, toKey) => {
				const fromId = fb.id;
				const toId = to.id;
				const nextArr = page.code.data[fromId].next ?? [];
				page.code.data[fromId].next = nextArr.filter(
					(n) => !(n.id === toId && n.fromKey === fromKey && n.toKey === toKey),
				);
				fileData = structuredClone(file);
				fileChange();
			});

			fb.on("defaultValue", (key, value) => {
				if (!page.code.data[blockId].defaultValues)
					page.code.data[blockId].defaultValues = {};
				// biome-ignore lint/style/noNonNullAssertion: checked above
				page.code.data[blockId].defaultValues![key] = value;
				fileData = structuredClone(file);
				fileChange();
			});
		}
		function linkBlock(fromId: string) {
			const fromData = page.code.data[fromId];
			for (const n of fromData.next) {
				const fromBlock = thisViewBlock.get(fromId);
				const toBlock = thisViewBlock.get(n.id);
				if (fromBlock && toBlock) fromBlock.linkTo(toBlock, n.fromKey, n.toKey);
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
			let funs = Array.from(functionMap);
			if (lastClick?.type === "link") {
				const l = { ...lastClick };
				if (lastClick.xType === "in") {
					const inType = lastClick.block
						.getSlots()
						.inputs.find((i) => i.name === l.key)?.type;
					funs = funs.filter(([_, f]) =>
						f.output.find((o) => o.type.type === inType?.type),
					);
				}
				if (lastClick.xType === "out") {
					const outType = lastClick.block
						.getSlots()
						.outputs.find((o) => o.name === l.key)?.type;
					funs = funs.filter(([_, f]) =>
						f.input.find((i) => i.type.type === outType?.type),
					);
				}
				lastClick = null;
				// todo link
			}
			menu.add(
				funs.map(([name]) =>
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
							fileChange();
							addBlock(id);
						}),
				),
			);
		};

		viewer.el.onclick = (e) => {
			if (e.target !== viewer.el) return;
			if (lastClick) lastClick = null;
		};

		ioSetter.clear();

		const functionName = input()
			.style({ width: "100%" })
			.addInto(ioSetter)
			.on("change", () => {
				const name = functionName.gv;
				if (name) {
					const oldName = page.functionId;
					page.functionId = name;
					selectItem.sv(name);
					for (const p of Object.values(file.data)) {
						for (const x of Object.values(p.code.data)) {
							if (x.functionName === oldName) x.functionName = name;
						}
					}
					xlangEnv.updateFunctionName(oldName, name);
					const f = functionMap.get(oldName);
					if (f) functionMap.set(name, f);
					functionMap.delete(oldName);
					fileData = structuredClone(file);
					fileChange();
				}
			})
			.sv(page.functionId);
		if (page.functionId === "main") {
			functionName.remove();
		}

		const inputSetter = view("y").addInto(ioSetter);
		const inputSetterList = view("y").addInto(inputSetter);
		button("+")
			.addInto(inputSetter)
			.on("click", () => {
				tmpInput.push({
					name: "",
					type: { type: "any" },
					mapKey: { id: "", key: "" },
					uid: crypto.randomUUID(),
				});
				addInputSetterItem(tmpInput[tmpInput.length - 1]);
			});

		const outputSetter = view("y").addInto(ioSetter);
		const outputSetterList = view("y").addInto(outputSetter);
		button("+")
			.addInto(outputSetter)
			.on("click", () => {
				tmpOutput.push({
					name: "",
					type: { type: "any" },
					mapKey: { id: "", key: "" },
					uid: crypto.randomUUID(),
				});
				addOutputSetterItem(tmpOutput[tmpOutput.length - 1]);
			});

		let tmpInput = page.code.input.map((i) => ({
			...i,
			uid: crypto.randomUUID(),
		}));
		let tmpOutput = page.code.output.map((i) => ({
			...i,
			uid: crypto.randomUUID(),
		}));
		function addIoSetterItem<
			T extends (typeof tmpInput)[number] | (typeof tmpOutput)[number],
		>(i: T, cb: (data: T) => void, t: "i" | "o", rm: () => void = () => {}) {
			const data = structuredClone(i);
			const itemView = view("x");
			button("#")
				.addInto(itemView)
				.on("click", () => {
					lastClick = {
						type: "bindIo",
						xType: t === "i" ? "in" : "out",
						cb: (blockId, key) => {
							data.mapKey = { id: blockId, key };
							cb(data);
						},
					};
				})
				.on("pointerenter", () => {
					const block = thisViewBlock.get(data.mapKey.id);
					if (block) {
						const slot = block.getSlots()[t === "i" ? "inputs" : "outputs"];
						slot
							.find((i) => i.name === data.mapKey.key)
							?.el.el.classList.add(editorBlockSlotHighlightClass);
					}
				})
				.on("pointerleave", () => {
					const block = thisViewBlock.get(data.mapKey.id);
					if (block) {
						const slot = block.getSlots()[t === "i" ? "inputs" : "outputs"];
						slot
							.find((i) => i.name === data.mapKey.key)
							?.el.el.classList.remove(editorBlockSlotHighlightClass);
					}
				});
			const nameTxt = input()
				.style({ maxWidth: "50px" })
				.addInto(itemView)
				.sv(data.name)
				.on("change", () => {
					data.name = nameTxt.gv;
					cb(data);
				});
			const typeEl = input()
				.style({ maxWidth: "50px" })
				.addInto(itemView)
				.sv(JSON.stringify(data.type.type))
				.on("change", () => {
					data.type.type = JSON.parse(typeEl.gv);
					cb(data);
				});
			itemView.add([
				spacer(),
				button("x").on("click", () => {
					rm();
					itemView.remove();
				}),
			]);

			return itemView;
		}
		function addInputSetterItem(i: (typeof tmpInput)[number]) {
			const el = addIoSetterItem(
				i,
				(data) => {
					const i = tmpInput.findIndex((x) => x.uid === data.uid);
					if (i >= 0) tmpInput[i] = data;
					page.code.input = tmpInput.map((i) => {
						const { uid: _, ...o } = structuredClone(i);
						return o;
					});
					fileData = structuredClone(file);
					fileChange();
					updateFunction();

					updateInputX();
				},
				"i",
				() => {
					tmpInput = tmpInput.filter((x) => x.uid !== i.uid);
					page.code.input = tmpInput.map((i) => {
						const { uid: _, ...o } = structuredClone(i);
						return o;
					});
					fileData = structuredClone(file);
					fileChange();
					updateFunction();
				},
			);
			inputSetterList.add(el);
		}
		function addOutputSetterItem(i: (typeof tmpOutput)[number]) {
			const el = addIoSetterItem(
				i,
				(data) => {
					const i = tmpOutput.findIndex((x) => x.uid === data.uid);
					if (i >= 0) tmpOutput[i] = data;
					page.code.output = tmpOutput.map((i) => {
						const { uid: _, ...o } = structuredClone(i);
						return o;
					});
					fileData = structuredClone(file);
					fileChange();
					updateFunction();
				},
				"o",
				() => {
					tmpOutput = tmpOutput.filter((x) => x.uid !== i.uid);
					page.code.output = tmpOutput.map((i) => {
						const { uid: _, ...o } = structuredClone(i);
						return o;
					});
					fileData = structuredClone(file);
					fileChange();
					updateFunction();
				},
			);
			outputSetterList.add(el);
		}
		for (const i of tmpInput) {
			addInputSetterItem(i);
		}
		for (const o of tmpOutput) {
			addOutputSetterItem(o);
		}
		function updateFunction() {
			const f = xlangEnv.addFunction(page.functionId, page.code);
			functionMap.set(page.functionId, f);
		}

		function updateInputX() {
			inputArea.sv(
				Object.fromEntries(
					page.code.input.map((i) => [
						i.name,
						i.type.type === "bool"
							? false
							: i.type.type === "num"
								? 0
								: undefined,
					]),
				),
			);
		}

		const inputArea = superArgsInput().addInto(ioSetter);
		updateInputX();
		button("运行")
			.addInto(ioSetter)
			.on("click", () => {
				runInfo.clear();
				const input = inputArea.gv;
				const r = xlangEnv.run(page.code, input);
				outputArea.sv(JSON.stringify(r, null, 2));
			});
		const outputArea = textarea().style({ height: "150px" }).addInto(ioSetter);
		button("动画")
			.addInto(ioSetter)
			.on("click", async () => {
				runCancel = false;
				const r = Array.from(runInfo).filter(
					(i) => i.fName === page.functionId,
				);
				// todo 拿到不同函数帧信息（比如递归时可区分层级），节点io数据，等待的节点
				let count = 0;
				for (const info of r) {
					const block = thisViewBlock.get(info.frameId);
					if (block) {
						block.el.el.classList.add(editorBlockHighlightClass);
					}
					count++;
					animateRunProgress.sv(
						`动画进度: ${((count / r.length) * 100).toFixed(2)}%`,
					);
					if (runCancel) break;
					await sleep(30);
					if (block) {
						block.el.el.classList.remove(editorBlockHighlightClass);
					}
				}
			});
		const animateRunProgress = txt().addInto(ioSetter);
		button("取消动画")
			.addInto(ioSetter)
			.on("click", () => {
				runCancel = true;
				animateRunProgress.sv("");
				for (const i of thisViewBlock.values()) {
					i.el.el.classList.remove(editorBlockHighlightClass);
				}
			});
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
	type FontX = number[]; // 下面基本笔画索引

	const magicFontBaseX: FontZb[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
	// 基本笔画
	const magicFontBaseBh: FontBh[] = [];
	const magicFontBaseBhIgnore = [
		[1, 3],
		[4, 6],
		[7, 9],
		[1, 7],
		[2, 8],
		[3, 9],
		[1, 9],
		[3, 7],
	];
	for (let i = 0; i < magicFontBaseX.length; i++) {
		for (let j = i + 1; j < magicFontBaseX.length; j++) {
			if (
				magicFontBaseBhIgnore.some(
					(k) => k[0] === magicFontBaseX[i] && k[1] === magicFontBaseX[j],
				)
			)
				continue;
			magicFontBaseBh.push([magicFontBaseX[i], magicFontBaseX[j]]);
		}
	}
	function genFontId(indexs: FontX) {
		return indexs.sort((a, b) => a - b).join("-");
	}
	function fontId2FontX(id: string): FontX {
		return id.split("-").map((i) => Number(i));
	}
	function FontX2Font(f: FontX): font {
		const x: font = [];
		for (const bi of f) {
			x.push(magicFontBaseBh[bi]);
		}
		return x;
	}

	// todo 自动化生成
	const xBase: Record<string, FontX> = {
		"value.num": [0, 5, 10, 26, 27],
		"ctrl.split": [12, 15, 22],
		"ctrl.if": [6, 11, 15, 17, 18],

		"math.add": [6, 7, 21, 24],
		"math.multiply": [6, 8, 15, 21],
		"math.subtract": [8, 15, 17],
		"math.divide": [6, 15, 19, 21, 24],
		"math.power": [6, 7, 8, 15, 19, 24],
		"math.log": [6, 7, 15, 17, 24],
		"math.lg": [8, 15, 21, 24],
		"math.log2": [6, 8, 15, 21, 24],
		"math.ln": [7, 8, 17, 24],
		"math.exp": [7, 8, 17, 19, 24],
		"math.max": [3, 6, 23],
		"math.min": [8, 11, 18],
		"math.random": [0, 1, 3, 5, 12, 21, 25, 26],
		"math.floor": [8, 17, 26],
		"math.ceil": [6, 24, 27],
		"math.round": [6, 8, 17, 24, 26, 27],
		"math.eq": [0, 5, 15, 19, 26, 27],
		"math.neq": [0, 8, 15, 17, 19, 27],
		"math.less": [11, 18],
		"math.greater": [3, 23],
		"math.lessEq": [11, 18, 19],
		"math.greaterEq": [3, 15, 23],
		"str.split": [5, 6, 8, 14, 18],
		"str.join": [5, 6, 8, 17, 25],
		"str.repeat": [5, 6, 8, 18, 24],
		"array.at": [1, 3, 13, 14],
		"array.at2": [1, 4, 11, 13],
		"array.slice": [1, 11, 13, 17, 24],
		"array.sliceStart": [1, 11, 13, 17],
		"array.sliceEnd": [1, 11, 13, 24],
		"array.reverse": [1, 11, 14, 17, 24],
		"array.sort": [3, 4, 11, 14, 17],
		"array.map": [3, 4, 11, 14],
		"array.reduce": [3, 11, 13, 14],
		"array.filter": [3, 11, 13, 17],
		"array.find": [1, 3, 4, 11, 14, 17],
		"array.findIndex": [1, 3, 4, 11, 14, 24],
	};
	const x: Record<string, font> = {};
	for (const [k, v] of Object.entries(xBase)) {
		x[k] = FontX2Font(v);
	}

	const fontMap = {
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
		newFun: [[1, 7]],
		ioBase: [
			[4, 7],
			[3, 6],
		],
		exDataStart: [[8, 7, 1, 2]],
		exDataEnd: [[8, 9, 3, 2]],
		exDataBase: [
			[7, 8],
			[1, 3],
		],
	} satisfies Record<string, font>;

	let magicId = 0;
	for (const [pageId, page] of Object.entries(file.data)) {
		if (pageId === "main") continue;
		x[page.functionId] = idFont(fontMap.newFun, magicId);
		magicId++;
	}

	function idFont(baseFont: font, id: number) {
		const x: font = [...baseFont];
		const restP = magicFontBaseX.filter(
			(i) => !baseFont.find((x) => x.includes(i)),
		);
		const b = id.toString(2);
		for (let i = b.length - 1; i >= 0; i--) {
			if (b[i] === "1") {
				x.push([restP[b.length - 1 - i]]);
			}
		}
		return x;
	}
	function toDataView(input: number | string) {
		if (typeof input === "number") {
			return input
				.toString(2)
				.split("")
				.map((b) => (b === "1" ? 1 : 0))
				.reverse();
		} else {
			const uint8Array = new TextEncoder().encode(input);
			const buffer = new ArrayBuffer(uint8Array.length);
			const view = new DataView(buffer);
			for (const [index, byte] of uint8Array.entries()) {
				view.setUint8(index, byte);
			}
			const bits: (0 | 1)[] = [];

			// 每个字节：低位在前，高位在后
			for (let i = 0; i < view.byteLength; i++) {
				const byte = view.getUint8(i);
				for (let j = 0; j < 8; j++) {
					bits.push(((byte >> j) & 1) as 0 | 1);
				}
			}
			// 去掉末尾多余的0
			let endIndex = bits.length - 1;
			while (endIndex > 0 && bits[endIndex] === 0) {
				endIndex--;
			}

			const b = bits.slice(0, endIndex + 1);
			return b;
		}
	}
	function binFont(b: (0 | 1)[]): font[] {
		// 全部点做二进制表示
		const x: font[] = [];
		for (let i = 0; i < b.length; i += 9) {
			const c = b.slice(i, i + 9);
			const f: font = [];
			for (let j = 0; j < c.length; j++) {
				if (c[j]) f.push([(j + 1) as FontZb]);
			}
			x.push(f);
		}
		return x;
	}

	baseEditor.clear();

	const viewer = view("x")
		.style({ backgroundColor: "#000", color: "#fff", height: "100%" })
		.addInto(baseEditor);

	const hexGridSize = 480;
	const size = hexGridSize * 2 + hexGridSize;
	const hexGridTopX = size / 2;
	const hexGridTopY = 200;

	const svgNS = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(svgNS, "svg");
	svg.setAttribute("width", String(size));
	svg.setAttribute("viewBox", `0 0 ${size} ${2048}`);
	svg.style.display = "block";
	svg.style.backgroundColor = "#000";
	svg.style.width = "100%";
	viewer.clear();
	const w = view().style({ flexGrow: 1, overflow: "scroll" }).addInto(viewer);
	w.el.appendChild(svg);

	const glyphMap = new Map<string, { els: SVGGElement[]; noHlTimer: number }>();

	const sideBar = view("y").addInto(viewer);
	const inputArea = superArgsInput()
		.sv(
			Object.fromEntries(
				file.data.main.code.input.map((i) => [
					i.name,
					i.type.type === "bool"
						? false
						: i.type.type === "num"
							? 0
							: undefined,
				]),
			),
		)
		.addInto(sideBar);
	button("运行")
		.addInto(sideBar)
		.on("click", async () => {
			cancelRun = false;
			const code = inputArea.gv;
			const x = code;

			runInfo.clear();

			const r = xlangEnv.run(file.data.main.code, x);

			outputArea.sv(
				JSON.stringify(r, null, 2)
					.split("\n")
					.slice(1, -1)
					.map((line) => line.trim())
					.join(""),
			);

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
	const outputArea = textarea()
		.addInto(sideBar)
		.attr({ readOnly: true })
		.style({ width: "120px" });
	const animateRunProgress = txt().addInto(view("x").addInto(sideBar));
	button("取消魔法进行")
		.on("click", () => {
			cancelRun = true;
		})
		.addInto(sideBar);

	button("符文编辑器")
		.on("click", async () => {
			const xel = view("y")
				.style({
					position: "fixed",
					width: "100vw",
					height: "100vh",
					top: 0,
					left: 0,
					zIndex: 999,
					color: "white",
					background: "#000",
				})
				.addInto();
			button("关闭")
				.on("click", () => {
					xel.remove();
				})
				.addInto(xel);

			const bhS = new Set<number>();
			const bhIp = input()
				.addInto(xel)
				.bindGet((el) => JSON.parse(el.value) as number[])
				.bindSet((v: number[], el) => {
					el.value = JSON.stringify(v.sort((a, b) => a - b));
				})
				.sv([])
				.on("change", () => {
					bhS.clear();
					for (const i of bhIp.gv) bhS.add(i);
					updateF();
				});
			xel.add(
				button("随机").on("click", () => {
					bhS.clear();
					const n = magicFontBaseBh.flatMap((_, i) =>
						Math.random() < 0.3 ? [i] : [],
					);
					for (const i of n) bhS.add(i);
					bhIp.sv(Array.from(bhS));
					updateF();
				}),
			);
			function updateF() {
				for (const [i, el] of elMap) {
					if (bhS.has(i)) {
						el.style({ backgroundColor: "#555" });
					} else {
						el.style({ backgroundColor: "transparent" });
					}
				}
				vvv
					.clear()
					.el.appendChild(createFontRect(48, FontX2Font(Array.from(bhS))));
				const p = new Set<FontZb>();
				for (const pp of FontX2Font(Array.from(bhS))) {
					for (const b of pp) {
						p.add(b);
					}
				}
				vvv.el.appendChild(
					createFontRect(
						48,
						Array.from(p).map((b) => [b]),
					),
				);
				vvv.add(txt(`笔画数: ${bhS.size} 点数: ${p.size}`));

				const ff = genFontId(Array.from(bhS).map((i) => i));

				for (const [_, s] of data.dt[String(p.size)]) {
					if (s.has(ff)) {
						const index = Array.from(s).indexOf(ff);
						vvv.add(txt(`${Math.floor(index / pageSize) + 1}`));
						break;
					}
				}
			}
			const bhMap: number[] = [
				15, 19, 21, 7, 0, 1, 2, 6, 3, 4, 5, 13, 12, 8, 11, 14, 27, 25, 22, 24,
				10, 18, 26, 16, 20, 17, 23, 9,
			];
			const elMap = new Map<number, ElType<HTMLElement>>();
			view("x")
				.add(
					bhMap.map((idx) => {
						const bh = magicFontBaseBh[idx];
						const el = view().style({ border: "1px solid #555" });
						el.el.appendChild(createFontRect(24, [bh]));
						el.on("click", () => {
							if (bhS.has(idx)) {
								bhS.delete(idx);
							} else {
								bhS.add(idx);
							}
							updateF();
							bhIp.sv(Array.from(bhS));
						});
						elMap.set(idx, el);
						return el;
					}),
				)
				.addInto(xel);
			const vvv = view("x").style({ gap: "8px" }).addInto(xel);

			const data = await genFonts();
			console.log(data);

			const pageSize = 1000;
			const pointCount = view("x").addInto(xel).style({ gap: "4px" });
			function fost(fid: string) {
				const el = view()
					.style({ width: "48px", height: "48px" })
					.on("click", () => {
						bhS.clear();
						for (const x of fontId2FontX(fid)) {
							bhS.add(x);
						}
						bhIp.sv(Array.from(bhS));
						updateF();
					})
					.addInto(v);
				el.el.appendChild(createFontRect(48, FontX2Font(fontId2FontX(fid))));
				return el;
			}
			for (const [n, f] of Object.entries(data.dt)) {
				pointCount.add(
					txt(n).on("click", () => {
						pointStyle.clear();
						for (const [p, c] of f) {
							if (c.size === 0) continue;
							const ps = p.split("").map((i) => [Number(i) as FontZb]);
							const el = view()
								.addInto(pointStyle)
								.style({ border: "1px solid #555", padding: "2px" });
							el.el.appendChild(createFontRect(24, ps));
							el.on("click", () => {
								pageSplit.clear();
								v.clear();
								if (c.size > 1000) {
									const ff = Array.from(c);
									const pages = Math.ceil(ff.length / pageSize);
									for (let p = 0; p < pages; p++) {
										pageSplit.add(
											txt(`页${p + 1}`)
												.style({ flexShrink: 0 })
												.on("click", () => {
													v.clear();

													const start = p * pageSize;
													const end = Math.min(c.size, (p + 1) * pageSize);
													for (let i = start; i < end; i++) {
														fost(ff[i]).addInto(v);
													}
												}),
										);
									}
								} else {
									v.add(Array.from(c).map((i) => fost(i)));
								}
							});
						}
					}),
				);
			}
			const pointStyle = view("x")
				.style({ gap: "8px", overflow: "scroll", flexShrink: 0 })
				.addInto(xel);
			const pageSplit = view("x")
				.style({ gap: "4px", overflow: "scroll", flexShrink: 0 })
				.addInto(xel);
			const v = view("x", "wrap")
				.style({ overflowY: "scroll", flexGrow: 1, alignContent: "flex-start" })
				.addInto(xel);
		})
		.addInto(sideBar);

	button("符文对应")
		.on("click", () => {
			const xel = view("y")
				.style({
					position: "fixed",
					width: "100vw",
					height: "100vh",
					top: 0,
					left: 0,
					zIndex: 999,
					color: "white",
					background: "#000",
				})
				.addInto();
			button("关闭")
				.on("click", () => {
					xel.remove();
				})
				.addInto(xel);
			const l = view("y").style({ overflow: "scroll" }).addInto(xel);

			for (const [n, v] of Object.entries(fontMap)) {
				const el = view("x");
				el.add(txt(n));
				const svg = createFontRect(24, v);
				el.el.appendChild(svg);
				l.add(el);
			}

			for (const f of functionMap.keys()) {
				const el = view("x");
				el.add(txt(f));
				const svg = createFontRect(24, x[f] ?? fontMap.undefined);
				el.el.appendChild(svg);
				l.add(el);
			}
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
			path.setAttribute("stroke-width", "3");
			path.setAttribute("stroke-linecap", "round");
			path.setAttribute("stroke-linejoin", "round");
			g.appendChild(path);
		}

		svg.appendChild(g);
		return g;
	}
	function createFontRect(width: number, font: font): SVGSVGElement {
		const svg = document.createElementNS(svgNS, "svg");
		const height = width;
		svg.setAttribute("width", String(width));
		svg.setAttribute("height", String(height));
		svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
		svg.style.display = "block";

		// 3x3 网格坐标映射
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

		const cellW = width / 3;
		const cellH = height / 3;
		const strokeW = Math.max(1, Math.round(width / 24));
		const dotR = Math.max(1, Math.round(strokeW / 2));

		function gridToXY(n: number) {
			const [col, row] = posMap[n];
			const x = (col + 0.5) * cellW;
			const y = (2 - row + 0.5) * cellH; // 行从下到上：0,1,2
			return [x, y] as const;
		}

		for (const stroke of font) {
			if (!stroke || stroke.length === 0) continue;
			if (stroke.length === 1) {
				const [x, y] = gridToXY(stroke[0]);
				const circle = document.createElementNS(svgNS, "circle");
				circle.setAttribute("cx", String(x));
				circle.setAttribute("cy", String(y));
				circle.setAttribute("r", String(dotR));
				circle.setAttribute("fill", mainColor);
				svg.appendChild(circle);
				continue;
			}
			const path = document.createElementNS(svgNS, "path");
			const d: string[] = [];
			for (let i = 0; i < stroke.length; i++) {
				const [x, y] = gridToXY(stroke[i]);
				d.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
			}
			path.setAttribute("d", d.join(" "));
			path.setAttribute("fill", "none");
			path.setAttribute("stroke", mainColor);
			path.setAttribute("stroke-width", String(strokeW));
			path.setAttribute("stroke-linecap", "round");
			path.setAttribute("stroke-linejoin", "round");
			svg.appendChild(path);
		}

		return svg;
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

	const gloConnect = document.createElementNS(svgNS, "g");
	svg.appendChild(gloConnect);

	const exF = new Set<string>();
	for (const [, page] of pages) {
		if (page.functionId !== "main") exF.add(page.functionId);
	}

	// 全局连接线
	for (let pi = 0; pi < pages.length; pi++) {
		const [, page] = pages[pi];
		const center = centers[pi];
		const cx = center.x;
		const cy = center.y;
		for (const { functionName } of Object.values(page.code.data)) {
			if (!exF.has(functionName)) continue;
			// 寻找目标 page
			const targetPi = pages.findIndex((i) => i[1].functionId === functionName);
			if (targetPi < 0) continue;
			const targetCenter = centers[targetPi];
			// 双股线：在连线两侧各偏移一条平行线
			const ux = targetCenter.x - cx;
			const uy = targetCenter.y - cy;
			const len = Math.hypot(ux, uy) || 1;
			const nx = -uy / len; // 垂直单位向量
			const ny = ux / len;
			const offset = 6; // 两股间距的一半

			for (const s of [-1, 1] as const) {
				const pathEl = document.createElementNS(svgNS, "path");
				pathEl.setAttribute("stroke", "#fff");
				pathEl.setAttribute("stroke-width", "2");
				pathEl.setAttribute("fill", "none");
				pathEl.setAttribute("stroke-linecap", "round");
				gloConnect.appendChild(pathEl);

				const x1 = cx + nx * offset * s;
				const y1 = cy + ny * offset * s;
				const x2 = targetCenter.x + nx * offset * s;
				const y2 = targetCenter.y + ny * offset * s;

				pathEl.setAttribute("d", `M ${x1} ${y1} L ${x2} ${y2}`);
			}
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

		const exData: (0 | 1)[][] = [];

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
					font: idFont(fontMap.ioBase, i),
					exType: "i",
					exData: `${name}-i-${fun.input[i].name}`,
				});
				const d = f.defaultValues?.[fun.input[i].name];
				if (d !== undefined) {
					const canT = typeof d === "string" || typeof d === "number";
					if (!canT) {
						console.log(d, name, f.defaultValues, `is not a valid input`);
					}
					exData.push(canT ? toDataView(d) : toDataView(0));
					sPage.push({
						font: idFont(fontMap.exDataBase, exData.length - 1),
						exType: "f",
						exData: `${name}-i-default-${fun.input[i].name}`,
					});
				}
			}
			for (let i = 0; i < fun.output.length; i++) {
				sPage.push({
					font: idFont(fontMap.ioBase, i),
					exType: "o",
					exData: `${name}-o-${fun.output[i].name}`,
				});
			}
		}
		if (exData.length > 0) {
			sPage.push({
				font: fontMap.exDataStart,
				exType: "f",
				exData: "exDataStart",
			});
		}
		for (const [i, d] of exData.entries()) {
			sPage.push({
				font: idFont(fontMap.exDataBase, i),
				exType: "f",
				exData: "",
			});
			for (const f of binFont(d)) {
				sPage.push({
					font: f,
					exType: "f",
					exData: `exData-${i}`,
				});
			}
		}
		if (exData.length > 0)
			sPage.push({
				font: fontMap.exDataEnd,
				exType: "f",
				exData: "exDataEnd",
			});

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

		const outerCircle = ringX.at(-1);
		if (outerCircle) {
			const circle = document.createElementNS(svgNS, "circle");
			circle.setAttribute("cx", String(cx));
			circle.setAttribute("cy", String(cy));
			circle.setAttribute("r", String(outerCircle.r + outerCircle.h + 8));
			circle.setAttribute("fill", "#000");
			circle.setAttribute("stroke", mainColor);
			circle.setAttribute("stroke-width", "4");
			svg.appendChild(circle);
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
	}

	async function genFonts() {
		// 外围是3*3
		const magicFontPoints: Record<number, Set<string>> = {
			2: new Set(["19", "37"]),
			3: new Set(["138", "349", "279", "167", "168", "348", "249", "267"]),
			4: new Set(["2468"]),
		};

		for (let i = 3; i <= 9; i++) {
			const a = magicFontBaseX;
			for (const l of magicFontPoints[i - 1]) {
				const ll = l.split("").map((i) => Number(i));
				const rest = a.filter((n) => !ll.includes(n));
				for (const r of rest) {
					const nl = [...ll, r].sort((a, b) => a - b).join("");
					if (!magicFontPoints[i]) magicFontPoints[i] = new Set();
					magicFontPoints[i].add(nl);
				}
			}
		}

		console.log(magicFontPoints);

		async function findCanonicalStrokeCover(targetPoints: Set<number>) {
			const result: number[][] = [];

			// 找到所有端点都是目标点的笔画
			const validStrokes: number[] = [];

			for (let i = 0; i < magicFontBaseBh.length; i++) {
				const stroke = magicFontBaseBh[i];
				// 笔画的两个端点都必须在目标点集合中
				if (targetPoints.has(stroke[0]) && targetPoints.has(stroke[1])) {
					validStrokes.push(i);
				}
			}

			// 使用回溯法高效搜索最小覆盖
			const coveredPoints = new Set<number>();
			const currentSolution: number[] = [];

			backtrack(
				0,
				coveredPoints,
				currentSolution,
				validStrokes,
				targetPoints,
				result,
			);

			await sleep(0);

			// 在基础解的基础上继续生成变种：对每个已找到的解，
			// 逐步将剩余的笔画加入，直到笔画用完，
			// 并将所有超集（去重）加入结果
			const seen = new Set<string>();
			for (const r of result) {
				seen.add(genFontId(r));
			}
			const expanded: number[][] = [];
			const queue: number[][] = result.map((r) => [...r]);
			if (targetPoints.size <= 5)
				while (queue.length > 0) {
					const base = queue.shift();
					if (!base) continue;
					// 计算剩余可加入的笔画
					const remaining = validStrokes.filter((s) => !base.includes(s));
					for (const s of remaining) {
						const ns = [...base, s].sort((a, b) => a - b);
						const id = genFontId(ns);
						if (!seen.has(id)) {
							seen.add(id);
							expanded.push(ns);
							queue.push(ns);
						}
					}
				}

			// 把扩展结果合并回最终结果
			for (const e of expanded) result.push(e);

			return result;
		}

		function backtrack(
			startIndex: number,
			coveredPoints: Set<number>,
			currentSolution: number[],
			validStrokes: number[],
			targetPoints: Set<number>,
			result: number[][],
		): void {
			// 如果已经覆盖所有目标点，保存当前解
			if (isAllCovered(coveredPoints, targetPoints)) {
				result.push([...currentSolution]);
				return;
			}

			// 如果已经遍历完所有笔画，返回
			if (startIndex >= validStrokes.length) {
				return;
			}

			// 剪枝：如果剩余笔画不足以覆盖未覆盖的点，提前返回
			const uncoveredCount = countUncoveredPoints(coveredPoints, targetPoints);
			const remainingStrokes = validStrokes.length - startIndex;
			if (remainingStrokes < Math.ceil(uncoveredCount / 2)) {
				return;
			}

			for (let i = startIndex; i < validStrokes.length; i++) {
				const strokeIndex = validStrokes[i];
				const stroke = magicFontBaseBh[strokeIndex];

				// 计算这个笔画能覆盖的新点
				const newPoints: number[] = [];
				if (!coveredPoints.has(stroke[0])) newPoints.push(stroke[0]);
				if (!coveredPoints.has(stroke[1])) newPoints.push(stroke[1]);

				// 如果这个笔画没有覆盖新点，跳过（避免重复覆盖）
				if (newPoints.length === 0) {
					continue;
				}

				// 选择当前笔画
				currentSolution.push(strokeIndex);
				for (const point of newPoints) coveredPoints.add(point);

				// 递归搜索
				backtrack(
					i + 1,
					coveredPoints,
					currentSolution,
					validStrokes,
					targetPoints,
					result,
				);

				// 回溯
				currentSolution.pop();
				for (const point of newPoints) coveredPoints.delete(point);
			}

			// 也考虑不选择任何笔画的情况（继续搜索）
			backtrack(
				validStrokes.length,
				coveredPoints,
				currentSolution,
				validStrokes,
				targetPoints,
				result,
			);
		}

		function isAllCovered(
			coveredPoints: Set<number>,
			targetPoints: Set<number>,
		): boolean {
			for (const point of targetPoints) {
				if (!coveredPoints.has(point)) {
					return false;
				}
			}
			return true;
		}

		function countUncoveredPoints(
			coveredPoints: Set<number>,
			targetPoints: Set<number>,
		): number {
			let count = 0;
			for (const point of targetPoints) {
				if (!coveredPoints.has(point)) {
					count++;
				}
			}
			return count;
		}

		const dt: Record<string, Map<string, Set<string>>> = {};

		for (const [n, s] of Object.entries(magicFontPoints)) {
			for (const ss of s) {
				const p = new Set(ss.split("").map((i) => Number(i)));
				if (!dt[n]) dt[n] = new Map();
				if (!dt[n].has(ss)) dt[n].set(ss, new Set());
				const r = await findCanonicalStrokeCover(p);
				for (const rr of r) {
					dt[n].get(ss)?.add(genFontId(rr));
				}
			}
		}

		console.log(dt);

		return {
			dt: dt,
		};
	}
}

async function fileChange() {
	const url = new URL(location.href);
	url.searchParams.set(
		"code",
		encodeURIComponent(await zip(JSON.stringify(fileData))),
	);
	url.searchParams.set("zip", "gzip");
	history.replaceState({}, "", url.href);
}

initDKH({ pureStyle: true });

const mainDiv = view("y")
	.style({
		width: "100vw",
		height: "100vh",
	})
	.addInto();

const toolsBar = view("x").style({ gap: "4px" }).addInto(mainDiv);

a(location.origin).add("开始页").addInto(toolsBar);

button("导出")
	.on("click", () => {
		console.log(fileData);
	})
	.addInto(toolsBar);

a("https://github.com/xushengfeng/x-lang").add("项目主页").addInto(toolsBar);

const viewer = view()
	.style({ flexGrow: 1, overflow: "hidden" })
	.addInto(mainDiv);

const baseEditor = view("y")
	.style({ width: "100%", height: "100%" })
	.addInto(viewer);

addStyle({
	textarea: {
		backgroundColor: "transparent",
	},
	input: {
		backgroundColor: "transparent",
	},
});

const editorBlockBaseClass = addClass(
	{
		borderRadius: "4px",
		padding: "4px",
		border: "1px solid #ccc",
		backgroundColor: "#fff",
	},
	{},
);

const editorBlockHighlightClass = addClass(
	{
		background: "#cfc",
	},
	{},
);

const editorBlockCloseButtonClass = addClass(
	{
		opacity: 0.2,
	},
	{
		"&:hover": {
			opacity: 1,
		},
	},
);
const editorBlockSlotHighlightClass = addClass(
	{
		outline: "2px solid #0ff",
	},
	{},
);

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
			stroke: "#888",
		},
		"& > circle": {
			fill: "#888",
		},
	},
);

function showExample() {
	baseEditor.clear().add(
		Object.values(example).map((i) =>
			button(i.name).on("click", () => {
				renderFile(i.d);
			}),
		),
	);
}

const example: Record<string, { name: string; d: FileData }> = {
	start: {
		name: "空白",
		d: {
			display: {
				type: "block",
			},
			data: {
				main: {
					functionId: "main",
					code: {
						input: [],
						output: [],
						data: {},
					},
					geo: {},
				},
			},
		},
	},
	fib: {
		name: "斐波那契数列",
		d: {
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
					geo: {
						0: {
							x: 600,
							y: 150,
						},
					},
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
		},
	},
};

const urlP = new URLSearchParams(location.search);

const code = urlP.get("code");

if (code)
	try {
		if (urlP.get("zip") === "gzip")
			unzip(decodeURIComponent(code)).then((decompressed) => {
				const f = JSON.parse(decompressed);
				renderFile(f);
			});
		else {
			const f = JSON.parse(decodeURIComponent(code));
			renderFile(f);
		}
	} catch {
		showExample();
	}
else {
	const exampleName = urlP.get("example");
	if (exampleName) {
		const exampleFile = example[exampleName];
		if (exampleFile) {
			renderFile(exampleFile.d);
		}
	} else showExample();
}
