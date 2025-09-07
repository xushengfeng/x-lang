export { env, newNativeFunction };

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
						? never
						: T["type"] extends "nil"
							? null
							: T["type"] extends "any"
								? unknown
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
		cb: Record<string, () => unknown>,
	) => Record<string, unknown>;
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

type XFunction = {
	input: { name: string; mapKey: { id: string; key: string }; type: XType }[];
	output: { name: string; mapKey: { id: string; key: string }; type: XType }[];
	data: Record<
		string,
		{
			functionName: string;
			next: { id: string; fromKey: string; toKey: string }[];
		}
	>;
};

const nativeFunctions: Record<string, NativeFunction> = {
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
};

function env() {
	const funs = nativeFunctions;
	function run(x: XFunction, input: Record<string, unknown>) {}
	function check(x: XFunction) {
		const m: { m: string; posi: string[] }[] = [];
		function addMe(m0: string, posi: string[]) {
			m.push({ m: m0, posi });
		}

		let hasNoFunctionError = false;
		for (const k in x.data) {
			if (!funs[x.data[k].functionName]) {
				hasNoFunctionError = true;
				addMe(`function ${x.data[k].functionName} not found`, [
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
			const v = f.input.find((i) => i.name === key);
			if (!v) {
				addMe(`key ${key} not found in function ${fName}`, path);
			}
			// todo cb
			// todo type
		}
		function checkOutput(
			f: NativeFunction,
			fName: string,
			key: string,
			path: string[],
		) {
			const v = f.output.find((i) => i.name === key);
			if (!v) {
				addMe(`key ${key} not found in function ${fName}`, path);
			}
			// todo cb
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
	return {
		run,
		checkStrict: (x: XFunction) => {
			const r = check(x);
			if (r) {
				console.log(r);
				return;
			}
			return x;
		},
	};
}
