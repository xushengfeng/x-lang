export { env, newNativeFunction };

type XType = { main: "string" | "num" };

type XTypeToActual<T extends XType> = T extends { main: "string" }
	? string
	: T extends { main: "num" }
		? number
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

type NativeFunction = {
	input: { name: string; type: XType }[];
	output: { name: string; type: XType }[];
	fun: (args: Record<string, unknown>) => Record<string, unknown>;
};

function newNativeFunction<
	x extends string,
	I extends { name: x; type: XType }[],
	xx extends string,
	O extends { name: xx; type: XType }[],
>(x: {
	input: I;
	output: O;
	fun: (args: InputToArgs<I>) => OutputToResult<O>;
}) {
	return x as NativeFunction;
}

newNativeFunction({
	input: [
		{ name: "str", type: { main: "string" } },
		{ name: "arr", type: { main: "num" } },
	],
	output: [{ name: "x", type: { main: "string" } }],
	fun: (args) => {
		args.str;
		return { x: "" };
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
		input: [{ name: "str", type: { main: "string" } }],
		output: [{ name: "arr", type: { main: "string" } }],
		fun: (args) => ({
			arr: args.str.split(" "),
		}),
	}),
	"str.join": newNativeFunction({
		input: [
			{ name: "arr", type: { main: "string" } },
			{ name: "sep", type: { main: "string" } },
		],
		output: [{ name: "str", type: { main: "string" } }],
		fun: (args) => ({
			str: args.arr.join(args.sep),
		}),
	}),
};

function env() {
	function run(x: XFunction) {}
	function check(x: XFunction) {}
}
