export {
	env,
	newNativeFunction,
	newFunction,
	type XFunction,
	type NativeFunction,
};

type XType = (
	| { type: "string" }
	| { type: "num" }
	| { type: "array"; subType: { item: XType } }
	| { type: "object"; subType: { value: XType } }
	| { type: "bool" }
	| { type: "stop" }
	| { type: "nil" }
	| { type: "any" }
	| { type: "auto" }
	| { type: "or"; subType: { left: XType; right: XType } }
) & { name?: string };

type XTypeToActual<T extends XType> = T["type"] extends "string"
	? string
	: T["type"] extends "num"
		? number
		: T["type"] extends "array"
			? // @ts-expect-error
				XTypeToActual<T["subType"]["item"]>[]
			: T["type"] extends "object"
				? // @ts-expect-error
					Record<string, XTypeToActual<T["subType"]["value"]>>
				: T["type"] extends "bool"
					? boolean
					: T["type"] extends "stop"
						? typeof stopValue
						: T["type"] extends "nil"
							? null
							: T["type"] extends "any"
								? unknown
								: T["type"] extends "or"
									? // @ts-expect-error
											| XTypeToActual<T["subType"]["left"]>
											// @ts-expect-error
											| XTypeToActual<T["subType"]["right"]>
									: never;

type InputToArgs<I extends { name: string; type: XType }[]> = {
	[K in I[number]["name"]]: XTypeToActual<
		Extract<I[number], { name: K }>["type"]
	>;
};

type OutputToResult<O extends { name: string; type: XType }[]> = {
	[K in O[number]["name"]]: XTypeToActual<
		Extract<O[number], { name: K }>["type"]
	>;
};

type CallbackX<
	x extends Record<
		string,
		{
			input: { name: string; type: XType }[];
			output: { name: string; type: XType }[];
		}
	>,
> = {
	[K in keyof x]: (
		args: InputToArgs<x[K]["input"]>,
	) => OutputToResult<x[K]["output"]>;
};

type NativeFunction = {
	input: { name: string; type: XType }[];
	output: { name: string; type: XType }[];
	cb?: Record<
		string,
		{
			input: { name: string; type: XType }[];
			output: { name: string; type: XType }[];
		}
	>;
	fun: (
		args: Record<string, unknown>,
		cb: Record<string, (args: Record<string, unknown>) => unknown>,
	) => Record<string, unknown>;
};

type XFunction = {
	input: { name: string; mapKey: { id: string; key: string }; type: XType }[];
	output: { name: string; mapKey: { id: string; key: string }; type: XType }[];
	data: Record<
		string,
		{
			functionName: string;
			next: { id: string; fromKey: string; toKey: string }[];
			defaultValues?: Record<string, unknown>;
		}
	>;
};

function newNativeFunction<
	x extends string,
	I extends { name: x; type: XType }[],
	xx extends string,
	O extends { name: xx; type: XType }[],
	cbI extends string,
	cbO extends string,
	cb extends Record<
		string,
		{
			input: { name: cbI; type: XType }[];
			output: { name: cbO; type: XType }[];
		}
	>,
>(x: {
	input: I;
	output: O;
	cb?: cb;
	fun: (args: InputToArgs<I>, cb: CallbackX<cb>) => OutputToResult<O>;
}) {
	// @ts-expect-error
	// todo
	return x as NativeFunction;
}

newNativeFunction({
	input: [
		{ name: "str", type: { type: "string" } },
		{ name: "arr", type: { type: "num" } },
	],
	output: [
		{
			name: "x",
			type: { type: "array", subType: { item: { type: "string" } } },
		},
	],
	fun: (args) => {
		args.str;
		return { x: [] };
	},
});

function newFunction(data: XFunction) {
	return data;
}

const stopValue = Symbol("stop");

const nativeFunctions: Record<string, NativeFunction> = {
	"value.num": newNativeFunction({
		input: [{ name: "value", type: { type: "num" } }],
		output: [{ name: "out", type: { type: "num" } }],
		fun: (args) => {
			return { out: args.value };
		},
	}),
	"ctrl.if": newNativeFunction({
		input: [
			{ name: "condition", type: { type: "bool" } },
			{ name: "true", type: { type: "auto", name: "T" } },
			{ name: "false", type: { type: "auto", name: "F" } },
		],
		output: [
			{
				name: "data",
				type: {
					type: "or",
					subType: {
						left: { type: "auto", name: "T" },
						right: { type: "auto", name: "F" },
					},
				},
			},
		],
		fun: (args) => {
			if (args.condition) {
				return { data: args.true };
			} else {
				return { data: args.false };
			}
		},
	}),
	"ctrl.split": newNativeFunction({
		input: [
			{ name: "condition", type: { type: "bool", name: "C" } },
			{ name: "data", type: { type: "auto", name: "D" } },
		],
		output: [
			{
				name: "true",
				type: {
					type: "or",
					subType: {
						left: { type: "auto", name: "D" },
						right: { type: "stop" },
					},
					name: "C",
				},
			},
			{
				name: "false",
				type: {
					type: "or",
					subType: {
						left: { type: "stop" },
						right: { type: "auto", name: "D" },
					},
					name: "C",
				},
			},
		],
		// @ts-expect-error // todo
		fun: (args) => {
			if (args.condition) {
				return { true: args.data, false: stopValue };
			} else {
				return { true: stopValue, false: args.data };
			}
		},
	}),
	"math.add": newNativeFunction({
		input: [
			{ name: "a", type: { type: "num" } },
			{ name: "b", type: { type: "num" } },
		],
		output: [{ name: "result", type: { type: "num" } }],
		fun: (args) => ({
			result: args.a + args.b,
		}),
	}),
	"math.multiply": newNativeFunction({
		input: [
			{ name: "a", type: { type: "num" } },
			{ name: "b", type: { type: "num" } },
		],
		output: [{ name: "result", type: { type: "num" } }],
		fun: (args) => ({
			result: args.a * args.b,
		}),
	}),
	"math.subtract": newNativeFunction({
		input: [
			{ name: "a", type: { type: "num" } },
			{ name: "b", type: { type: "num" } },
		],
		output: [{ name: "result", type: { type: "num" } }],
		fun: (args) => ({
			result: args.a - args.b,
		}),
	}),
	"math.divide": newNativeFunction({
		input: [
			{ name: "a", type: { type: "num" } },
			{ name: "b", type: { type: "num" } },
		],
		output: [{ name: "result", type: { type: "num" } }],
		fun: (args) => ({
			result: args.a / args.b,
		}),
	}),
	"math.power": newNativeFunction({
		input: [
			{ name: "a", type: { type: "num" } },
			{ name: "b", type: { type: "num" } },
		],
		output: [{ name: "result", type: { type: "num" } }],
		fun: (args) => ({
			result: args.a ** args.b,
		}),
	}),
	"math.log": newNativeFunction({
		input: [
			{ name: "a", type: { type: "num" } },
			{ name: "b", type: { type: "num" } },
		],
		output: [{ name: "result", type: { type: "num" } }],
		fun: (args) => ({
			result: Math.log(args.b) / Math.log(args.a),
		}),
	}),
	"math.lg": newNativeFunction({
		input: [{ name: "a", type: { type: "num" } }],
		output: [{ name: "result", type: { type: "num" } }],
		fun: (args) => ({
			result: Math.log(args.a) / Math.log(10),
		}),
	}),
	"math.log2": newNativeFunction({
		input: [{ name: "a", type: { type: "num" } }],
		output: [{ name: "result", type: { type: "num" } }],
		fun: (args) => ({
			result: Math.log2(args.a),
		}),
	}),
	"math.ln": newNativeFunction({
		input: [{ name: "a", type: { type: "num" } }],
		output: [{ name: "result", type: { type: "num" } }],
		fun: (args) => ({
			result: Math.log(args.a),
		}),
	}),
	"math.exp": newNativeFunction({
		input: [{ name: "a", type: { type: "num" } }],
		output: [{ name: "result", type: { type: "num" } }],
		fun: (args) => ({
			result: Math.exp(args.a),
		}),
	}),
	"math.max": newNativeFunction({
		input: [
			{ name: "a", type: { type: "num" } },
			{ name: "b", type: { type: "num" } },
		],
		output: [{ name: "result", type: { type: "num" } }],
		fun: (args) => ({
			result: Math.max(args.a, args.b),
		}),
	}),
	"math.min": newNativeFunction({
		input: [
			{ name: "a", type: { type: "num" } },
			{ name: "b", type: { type: "num" } },
		],
		output: [{ name: "result", type: { type: "num" } }],
		fun: (args) => ({
			result: Math.min(args.a, args.b),
		}),
	}),
	"math.random": newNativeFunction({
		input: [],
		output: [{ name: "result", type: { type: "num" } }],
		fun: () => ({
			result: Math.random(),
		}),
	}),
	"math.floor": newNativeFunction({
		input: [{ name: "a", type: { type: "num" } }],
		output: [
			{
				name: "out",
				type: { type: "num" },
			},
		],
		fun: (args) => ({
			out: Math.floor(args.a),
		}),
	}),
	"math.ceil": newNativeFunction({
		input: [{ name: "a", type: { type: "num" } }],
		output: [
			{
				name: "out",
				type: { type: "num" },
			},
		],
		fun: (args) => ({
			out: Math.ceil(args.a),
		}),
	}),
	"math.round": newNativeFunction({
		input: [{ name: "a", type: { type: "num" } }],
		output: [
			{
				name: "out",
				type: { type: "num" },
			},
		],
		fun: (args) => ({
			out: Math.round(args.a),
		}),
	}),
	"math.eq": newNativeFunction({
		input: [
			{ name: "a", type: { type: "num" } },
			{ name: "b", type: { type: "num" } },
		],
		output: [
			{
				name: "out",
				type: { type: "bool" },
			},
		],
		fun: (args) => ({
			out: args.a === args.b,
		}),
	}),
	"math.neq": newNativeFunction({
		input: [
			{ name: "a", type: { type: "num" } },
			{ name: "b", type: { type: "num" } },
		],
		output: [
			{
				name: "out",
				type: { type: "bool" },
			},
		],
		fun: (args) => ({
			out: args.a !== args.b,
		}),
	}),
	"math.less": newNativeFunction({
		input: [
			{ name: "a", type: { type: "num" } },
			{ name: "b", type: { type: "num" } },
		],
		output: [
			{
				name: "out",
				type: { type: "bool" },
			},
		],
		fun: (args) => ({
			out: args.a < args.b,
		}),
	}),
	"math.greater": newNativeFunction({
		input: [
			{ name: "a", type: { type: "num" } },
			{ name: "b", type: { type: "num" } },
		],
		output: [
			{
				name: "out",
				type: { type: "bool" },
			},
		],
		fun: (args) => ({
			out: args.a > args.b,
		}),
	}),
	"math.lessEq": newNativeFunction({
		input: [
			{ name: "a", type: { type: "num" } },
			{ name: "b", type: { type: "num" } },
		],
		output: [
			{
				name: "out",
				type: { type: "bool" },
			},
		],
		fun: (args) => ({
			out: args.a <= args.b,
		}),
	}),
	"math.greaterEq": newNativeFunction({
		input: [
			{ name: "a", type: { type: "num" } },
			{ name: "b", type: { type: "num" } },
		],
		output: [
			{
				name: "out",
				type: { type: "bool" },
			},
		],
		fun: (args) => ({
			out: args.a >= args.b,
		}),
	}),
	"str.split": newNativeFunction({
		input: [{ name: "str", type: { type: "string" } }],
		output: [
			{
				name: "arr",
				type: { type: "array", subType: { item: { type: "string" } } },
			},
		],
		fun: (args) => ({
			arr: args.str.split(" "),
		}),
	}),
	"str.join": newNativeFunction({
		input: [
			{
				name: "arr",
				type: { type: "array", subType: { item: { type: "string" } } },
			},
			{ name: "sep", type: { type: "string" } },
		],
		output: [{ name: "str", type: { type: "string" } }],
		fun: (args) => ({
			str: args.arr.join(args.sep),
		}),
	}),
	"str.repeat": newNativeFunction({
		input: [
			{
				name: "str",
				type: { type: "string" },
			},
			{ name: "repeatNum", type: { type: "num" } },
		],
		output: [{ name: "str", type: { type: "string" } }],
		fun: (args) => ({
			str: args.str.repeat(args.repeatNum),
		}),
	}),
	"array.at": newNativeFunction({
		input: [
			{
				name: "arr",
				type: { type: "array", subType: { item: { type: "auto", name: "I" } } },
			},
			{ name: "index", type: { type: "num" } },
		],
		output: [
			{
				name: "item",
				type: {
					type: "or",
					subType: {
						left: { type: "auto", name: "I" },
						right: { type: "nil" },
					},
				},
			},
		],
		fun: (args) => ({
			item: args.arr[args.index] ?? null,
		}),
	}),
	"array.at2": newNativeFunction({
		input: [
			{
				name: "arr",
				type: { type: "array", subType: { item: { type: "auto", name: "I" } } },
			},
			{ name: "index", type: { type: "num" } },
		],
		output: [
			{
				name: "item",
				type: {
					type: "or",
					subType: {
						left: { type: "auto", name: "I" },
						right: { type: "nil" },
					},
				},
			},
		],
		fun: (args) => ({
			item: args.arr.at(args.index) ?? null,
		}),
	}),
	"array.slice": newNativeFunction({
		input: [
			{
				name: "arr",
				type: { type: "array", subType: { item: { type: "auto", name: "I" } } },
			},
			{ name: "from", type: { type: "num" } },
			{ name: "to", type: { type: "num" } },
		],
		output: [
			{
				name: "subArray",
				type: {
					type: "array",
					subType: { item: { type: "auto", name: "I" } },
				},
			},
		],
		fun: (args) => {
			const from = Math.max(0, args.from);
			const to = Math.max(0, Math.min(args.arr.length, args.to));
			return {
				subArray: args.arr.slice(from, to),
			};
		},
	}),
	"array.sliceStart": newNativeFunction({
		input: [
			{
				name: "arr",
				type: { type: "array", subType: { item: { type: "auto", name: "I" } } },
			},
			{ name: "len", type: { type: "num" } },
		],
		output: [
			{
				name: "subArray",
				type: {
					type: "array",
					subType: { item: { type: "auto", name: "I" } },
				},
			},
		],
		fun: (args) => {
			return {
				subArray: args.arr.slice(0, args.len),
			};
		},
	}),
	"array.sliceEnd": newNativeFunction({
		input: [
			{
				name: "arr",
				type: { type: "array", subType: { item: { type: "auto", name: "I" } } },
			},
			{ name: "len", type: { type: "num" } },
		],
		output: [
			{
				name: "subArray",
				type: {
					type: "array",
					subType: { item: { type: "auto", name: "I" } },
				},
			},
		],
		fun: (args) => {
			return {
				subArray: args.arr.slice(-args.len),
			};
		},
	}),
	"array.reverse": newNativeFunction({
		input: [
			{
				name: "arr",
				type: { type: "array", subType: { item: { type: "auto", name: "I" } } },
			},
		],
		output: [
			{
				name: "arr",
				type: {
					type: "array",
					subType: { item: { type: "auto", name: "I" } },
				},
			},
		],
		fun: (args) => ({
			arr: args.arr.toReversed(),
		}),
	}),
	"array.sort": newNativeFunction({
		input: [
			{
				name: "arr",
				type: { type: "array", subType: { item: { type: "auto", name: "I" } } },
			},
		],
		output: [
			{
				name: "arr",
				type: { type: "array", subType: { item: { type: "auto", name: "I" } } },
			},
		],
		cb: {
			cb: {
				input: [
					{
						name: "itemA",
						type: { type: "auto", name: "I" },
					},
					{
						name: "itemB",
						type: { type: "auto", name: "I" },
					},
				],
				output: [{ name: "callback", type: { type: "num" } }],
			},
		},
		fun: (args, cb) => ({
			arr: args.arr.toSorted((a, b) => cb.cb({ itemA: a, itemB: b }).callback),
		}),
	}),
	"array.map": newNativeFunction({
		input: [
			{
				name: "arr",
				type: { type: "array", subType: { item: { type: "auto", name: "I" } } },
			},
		],
		output: [
			{
				name: "arr",
				type: { type: "array", subType: { item: { type: "auto", name: "O" } } },
			},
		],
		cb: {
			cb: {
				input: [
					{
						name: "item",
						type: { type: "auto", name: "I" },
					},
				],
				output: [{ name: "callback", type: { type: "auto", name: "O" } }],
			},
		},
		fun: (args, cb) => ({
			arr: args.arr.map((i) => cb.cb({ item: i }).callback),
		}),
	}),
	"array.reduce": newNativeFunction({
		input: [
			{
				name: "arr",
				type: { type: "array", subType: { item: { type: "auto", name: "I" } } },
			},
		],
		output: [
			{
				name: "out",
				type: { type: "auto", name: "I" },
			},
		],
		cb: {
			cb: {
				input: [
					{
						name: "prev",
						type: { type: "auto", name: "I" },
					},
					{
						name: "item",
						type: { type: "auto", name: "I" },
					},
				],
				output: [{ name: "callback", type: { type: "auto", name: "O" } }],
			},
		},
		fun: (args, cb) => ({
			out: args.arr.reduce((p, i) => cb.cb({ prev: p, item: i }).callback),
		}),
	}),
	"array.filter": newNativeFunction({
		input: [
			{
				name: "arr",
				type: { type: "array", subType: { item: { type: "auto", name: "I" } } },
			},
		],
		output: [
			{
				name: "arr",
				type: { type: "array", subType: { item: { type: "auto", name: "I" } } },
			},
		],
		cb: {
			cb: {
				input: [
					{
						name: "item",
						type: { type: "auto", name: "I" },
					},
				],
				output: [{ name: "callback", type: { type: "bool" } }],
			},
		},
		fun: (args, cb) => ({
			arr: args.arr.filter((i) => cb.cb({ item: i }).callback),
		}),
	}),
	"array.find": newNativeFunction({
		input: [
			{
				name: "arr",
				type: { type: "array", subType: { item: { type: "auto", name: "I" } } },
			},
		],
		output: [
			{
				name: "result",
				type: {
					type: "or",
					subType: {
						left: { type: "auto", name: "I" },
						right: { type: "nil" },
					},
				},
			},
		],
		cb: {
			cb: {
				input: [
					{
						name: "item",
						type: { type: "auto", name: "I" },
					},
				],
				output: [{ name: "callback", type: { type: "bool" } }],
			},
		},
		fun: (args, cb) => ({
			result: args.arr.find((i) => cb.cb({ item: i }).callback) ?? null,
		}),
	}),
	"array.findIndex": newNativeFunction({
		input: [
			{
				name: "arr",
				type: { type: "array", subType: { item: { type: "auto", name: "I" } } },
			},
		],
		output: [
			{
				name: "index",
				type: {
					type: "or",
					subType: {
						left: { type: "num" },
						right: { type: "nil" },
					},
				},
			},
		],
		cb: {
			cb: {
				input: [
					{
						name: "item",
						type: { type: "auto", name: "I" },
					},
				],
				output: [{ name: "callback", type: { type: "bool" } }],
			},
		},
		fun: (args, cb) => {
			const v = args.arr.findIndex((i) => cb.cb({ item: i }).callback);
			return {
				index: v === -1 ? null : v,
			};
		},
	}),
};

function checkData(data: NativeFunction) {
	const inputNames = new Set<string>();
	const outputNames = new Set<string>();
	const m: string[] = [];
	for (const i of data.input) {
		if (inputNames.has(i.name)) {
			m.push(`input ${i.name} is duplicated`);
		}
		inputNames.add(i.name);
	}
	for (const i of data.output) {
		if (outputNames.has(i.name)) {
			m.push(`output ${i.name} is duplicated`);
		}
		outputNames.add(i.name);
	}

	for (const x of Object.values(data.cb ?? {})) {
		for (const i of x.output) {
			if (inputNames.has(i.name)) {
				m.push(`cb output ${i.name} is duplicated with input ${i.name}`);
			}
			inputNames.add(i.name);
		}
		for (const i of x.input) {
			if (outputNames.has(i.name)) {
				m.push(`cb input ${i.name} is duplicated with output ${i.name}`);
			}
			outputNames.add(i.name);
		}
	}
	return m.length ? m : null;
}

function slice(fromIds: string[], toIds: string[], data: XFunction["data"]) {
	const subData: XFunction["data"] = {};
	const ids = structuredClone(fromIds);
	const endIds = [];
	for (let _i = 0; _i <= Object.keys(data).length; _i++) {
		const id = ids.shift();
		if (!id) break;
		const v = data[id];
		subData[id] = v;
		for (const i of v.next) {
			if (toIds.includes(i.id)) {
				endIds.push(id);
				continue;
			}
			ids.push(i.id);
		}
	}
	return { subData, endIds };
}

function findHeads(data: XFunction["data"]) {
	const heads = new Set<string>();
	for (const id of Object.keys(data)) heads.add(id);
	for (const [_, v] of Object.entries(data)) {
		for (const n of v.next) {
			heads.delete(n.id);
		}
	}
	return { heads };
}

function env(op?: {
	log?: {
		log?: (...args: unknown[]) => void;
		error?: (...args: unknown[]) => void;
		warn?: (...args: unknown[]) => void;
		info?: (...args: unknown[]) => void;
		debug?: (...args: unknown[]) => void;
	};
	runInfo?: (fName: string, frameId: string) => void;
	cache?: {
		max?: number;
	};
}) {
	const funs = nativeFunctions;

	const log = {
		log: console.log,
		error: console.error,
		warn: console.warn,
		info: console.info,
		debug: console.debug,
		...op?.log,
	};

	const cache = new Map<string, Record<string, unknown>>();
	const cacheFunName = op?.cache ? new Set<string>() : undefined;

	function run0(
		x: XFunction,
		frames: Map<string, Map<string, unknown>>,
		fName = "main",
	) {
		const outputs: Record<string, unknown> = {};

		let maxRun = Object.keys(x.data).length + 10;

		while (true) {
			const nowFrameKey = frames.keys().next();
			if (nowFrameKey.done) break;

			maxRun--;
			if (maxRun <= 0) {
				log.error(`max run exceeded`, frames, x);
				break;
			}

			const nowFrameId = nowFrameKey.value;
			// biome-ignore lint/style/noNonNullAssertion: check function had checked all
			const nowFrame = frames.get(nowFrameId)!;
			const nowX = x.data[nowFrameId];
			const f = funs[nowX.functionName];

			// if args count
			const argsCountEqual = f.input.every(
				(i) =>
					nowFrame.has(i.name) || nowX.defaultValues?.[i.name] !== undefined,
			);

			if (argsCountEqual) {
				const { o: normalNext, cb: cbNext } = Object.groupBy(
					nowX.next,
					(next) =>
						f.output.find((i) => i.name === next.fromKey) ? "o" : "cb",
				);
				// pack callback
				// todo check cb args is full
				const { subData, endIds } = slice(
					(cbNext ?? []).map((i) => i.id),
					[nowFrameId],
					x.data,
				);
				const cb = Object.fromEntries(
					Object.entries(f.cb ?? {}).map(([k, v]) => {
						const rundata: XFunction = {
							input: v.input.map((i) => {
								const n = (cbNext ?? []).find((n) => n.fromKey === i.name);
								if (!n) throw new Error(`callback input ${i.name} not found`);
								return {
									name: i.name,
									mapKey: {
										id: n.id,
										key: n.toKey,
									},
									type: i.type,
								};
							}),
							output: v.output.flatMap((i) => {
								const x = endIds.find((id) =>
									subData[id].next.find((n) => n.toKey === i.name),
								);
								if (!x) throw new Error(`callback output ${i.name} not found`);
								return {
									name: i.name,
									mapKey: {
										id: x,
										// biome-ignore lint/style/noNonNullAssertion: I am confident that this key exists at last line
										key: subData[x].next.find((n) => n.toKey === i.name)!
											.fromKey,
									},
									type: i.type,
								};
							}),
							data: Object.fromEntries(
								Object.entries(subData).map(([k, v]) => [
									k,
									{
										...v,
										next: v.next.filter((i) => i.id !== nowFrameId),
									},
								]),
							),
						};

						return [
							k,
							(x: Record<string, unknown>) => {
								const subFrames = new Map<string, Map<string, unknown>>();
								for (const [k, v] of frames) {
									if (subData[k]) {
										subFrames.set(k, structuredClone(v));
									}
								}
								for (const i of rundata.input) {
									const inputV = x[i.name];
									if (!inputV) throw new Error(`input ${i.name} not found`);
									else addFrame(subFrames, i.mapKey.id, i.mapKey.key, inputV);
								}
								return run0(rundata, subFrames, fName);
							},
						];
					}),
				);

				// run
				const args = Object.fromEntries(
					f.input.map((i) => [
						i.name,
						nowFrame.get(i.name) ?? nowX.defaultValues?.[i.name],
					]),
				);
				op?.runInfo?.(fName, nowFrameId);

				let res: Record<string, unknown> | undefined;
				let key: string | undefined;
				if (op?.cache) {
					key = `${nowX.functionName}::${JSON.stringify(args)}`;
					res = cache.get(key);
					if (res) {
						log.info("cache hit", key);
					}
				}
				if (!res) res = f.fun(args, cb);
				if (op?.cache?.max && key) {
					if (!cacheFunName || cacheFunName.has(nowX.functionName)) {
						cache.set(key, res);
						if (cache.size > op.cache.max) {
							const firstKey = Array.from(cache.keys())[0];
							if (firstKey) cache.delete(firstKey);
						}
					}
				}
				for (const i of Object.keys(subData)) {
					frames.delete(i);
				}
				// add next frame
				for (const next of normalNext ?? []) {
					if (res[next.fromKey] === stopValue) {
						log.info("stop at", nowFrameId, next.fromKey);
						continue;
					}
					addFrame(frames, next.id, next.toKey, res[next.fromKey]);
				}
				// set output
				const o = x.output.find((i) => i.mapKey.id === nowFrameId);
				if (o) {
					outputs[o.name] = res[o.mapKey.key];
					if (Object.keys(outputs).length === x.output.length) {
						break;
					}
				}
			}

			frames.delete(nowFrameId);
			if (!argsCountEqual) {
				frames.set(nowFrameId, nowFrame);
			}
		}
		return outputs;
	}

	function addFrame(
		frames: Map<string, Map<string, unknown>>,
		id: string,
		key: string,
		value: unknown,
	) {
		const f = frames.get(id) ?? new Map();
		f.set(key, value);
		frames.set(id, f);
	}

	function run(x: XFunction, input: Record<string, unknown>, fName = "main") {
		const frames = new Map<string, Map<string, unknown>>();

		for (const i of x.input) {
			const inputV = input[i.name];
			if (!Object.hasOwn(input, i.name))
				throw new Error(`input ${i.name} not found`);
			else addFrame(frames, i.mapKey.id, i.mapKey.key, inputV);
		}

		const { heads } = findHeads(x.data);
		for (const id of heads) {
			if (!frames.has(id)) frames.set(id, new Map());
		}

		return run0(x, frames, fName);
	}

	function check(x: XFunction) {
		const m: { m: string; posi: string[] }[] = [];
		function addMe(m0: string, posi: string[]) {
			m.push({ m: m0, posi });
		}

		let hasNoFunctionError = false;
		for (const [k, v] of Object.entries(x.data)) {
			if (!funs[v.functionName]) {
				hasNoFunctionError = true;
				addMe(`function ${v.functionName} not found`, [
					"data",
					k,
					"functionName",
				]);
			}
		}

		if (hasNoFunctionError) return m;

		function getF(name: string) {
			return funs[name];
		}

		function checkId(id: string, path: string[]) {
			if (!x.data[id]) {
				addMe(`id ${id} not found`, path);
				return false;
			}
			return x.data[id];
		}
		function checkInput(
			f: NativeFunction,
			fName: string,
			key: string,
			path: string[],
		) {
			const v =
				f.input.find((i) => i.name === key) ||
				Object.values(f.cb || {}).find((i) =>
					i.output.find((o) => o.name === key),
				);
			if (!v) {
				addMe(
					`key ${key} not found in function ${fName} only ${f.input.map((i) => i.name).join(", ")}`,
					path,
				);
			}
			// todo type
		}
		function checkOutput(
			f: NativeFunction,
			fName: string,
			key: string,
			path: string[],
		) {
			const v =
				f.output.find((i) => i.name === key) ||
				Object.values(f.cb || {}).find((i) =>
					i.input.find((o) => o.name === key),
				);
			if (!v) {
				addMe(
					`key ${key} not found in function ${fName} only ${f.output.map((i) => i.name).join(", ")}`,
					path,
				);
			}
			// todo type
		}

		for (const [n, item] of x.input.entries()) {
			const x = checkId(item.mapKey.id, ["input", String(n), "mapKey", "id"]);
			if (!x) continue;
			const f = getF(x.functionName);
			checkInput(f, x.functionName, item.mapKey.key, [
				"input",
				String(n),
				"mapKey",
				"key",
			]);
		}
		for (const [n, item] of x.output.entries()) {
			const x = checkId(item.mapKey.id, ["ouput", String(n), "mapKey", "id"]);
			if (!x) continue;
			const f = getF(x.functionName);
			checkOutput(f, x.functionName, item.mapKey.key, [
				"output",
				String(n),
				"mapKey",
				"key",
			]);
		}
		for (const [n, item] of Object.entries(x.data)) {
			const thisF = getF(item.functionName);
			for (const k of Object.keys(item.defaultValues ?? {})) {
				checkInput(thisF, item.functionName, k, [
					"data",
					String(n),
					"defaultValues",
					k,
				]);
			}
			for (const [i, xx] of item.next.entries()) {
				checkOutput(thisF, item.functionName, xx.fromKey, [
					"data",
					String(n),
					"next",
					String(i),
					"fromKey",
				]);
				const next = checkId(xx.id, [
					"data",
					String(n),
					"next",
					String(i),
					"id",
				]);
				if (!next) continue;
				const nextF = getF(next.functionName);
				checkInput(nextF, next.functionName, xx.toKey, [
					"data",
					String(n),
					"next",
					String(i),
					"toKey",
				]);
			}
		}

		// todo no circle
		const inputS = new Map<string, Set<string>>();
		function addInputKey(id: string, keyName: string) {
			const x = inputS.get(id) ?? new Set();
			x.add(keyName);
			inputS.set(id, x);
		}
		for (const i of x.input) {
			addInputKey(i.mapKey.id, i.mapKey.key);
		}
		for (const [_, item] of Object.entries(x.data)) {
			for (const xx of item.next) {
				addInputKey(xx.id, xx.toKey);
			}
		}
		for (const [n, item] of Object.entries(x.data)) {
			const f = getF(item.functionName);
			const fk = inputS.get(n) ?? new Set();
			for (const x of Object.keys(item.defaultValues ?? {})) {
				fk.add(x);
			}
			const noInK = f.input.filter((i) => !fk.has(i.name)); // todo cb
			if (noInK.length) {
				addMe(
					`${item.functionName} input key not has ${noInK.map((i) => i.name).join(", ")}`,
					["data", n],
				);
			}
		}

		return m.length ? m : null;
	}

	// biome-ignore lint/correctness/noConstantCondition: just for test
	if (true) {
		// todo only run in test
		for (const [k, v] of Object.entries(nativeFunctions)) {
			const x = checkData(v);
			if (x) {
				console.log(`${k}`, x);
			}
		}
	}

	return {
		getFunctions: () => funs,
		// @ts-expect-error
		run: (...args) => {
			cache.clear();
			// @ts-expect-error
			return run(...args);
		},
		checkStrict: (x: XFunction) => {
			const r = check(x);
			if (r) {
				console.log(r);
				return;
			}
			return x;
		},
		addFunction: (name: string, x: XFunction) => {
			cacheFunName?.add(name);
			funs[name] = {
				input: x.input,
				output: x.output,
				fun: (args) => {
					return run(x, args, name);
				},
			};
		},
	};
}
