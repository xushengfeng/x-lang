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
	input: { name: string; mapKey: { id: string; key: string } }[];
	output: { name: string; mapKey: { id: string; key: string } }[];
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
	function run(x: XFunction) {}
	function check(x: XFunction) {}
}
