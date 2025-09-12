import { assertEquals } from "jsr:@std/assert";
import { env, type XFunction } from "../src/main.ts";

function runF(
	name: string,
	op: {
		input: Record<string, { value: unknown }>;
		output: Record<string, { value: unknown }>;
	},
	_with?: XFunction["data"],
) {
	const e = env();
	const i = Object.fromEntries(
		Object.entries(op.input).map(([k, v]) => [k, v.value]),
	);
	const o = Object.fromEntries(
		Object.entries(op.output).map(([k, v]) => [k, v.value]),
	);
	const x = e.checkStrict({
		input: Object.keys(op.input).map((k) => ({
			mapKey: { id: "0", key: k },
			type: { type: "any" },
			name: k,
		})),
		output: Object.keys(op.output).map((k) => ({
			mapKey: { id: "0", key: k },
			type: { type: "any" },
			name: k,
		})),
		data: {
			"0": {
				functionName: name,
				next: [],
			},
			..._with,
		},
	});
	if (x) {
		const r = e.run(x, i);
		assertEquals(r, o);
	} else {
		throw new Error("Failed to create function");
	}
}

Deno.test({
	name: "ctrl.if",
	fn: () => {
		runF("ctrl.if", {
			input: {
				condition: {
					value: true,
				},
				true: {
					value: "a",
				},
				false: {
					value: "b",
				},
			},
			output: {
				data: {
					value: "a",
				},
			},
		});
		runF("ctrl.if", {
			input: {
				condition: {
					value: false,
				},
				true: {
					value: "a",
				},
				false: {
					value: "b",
				},
			},
			output: { data: { value: "b" } },
		});
	},
});

Deno.test({
	name: "math.add",
	fn: () => {
		runF("math.add", {
			input: { a: { value: 1 }, b: { value: 2 } },
			output: { result: { value: 3 } },
		});
	},
});
Deno.test({
	name: "math.multiply",
	fn: () => {
		runF("math.multiply", {
			input: { a: { value: 3.7 }, b: { value: 42 } },
			output: { result: { value: 155.4 } },
		});
	},
});
Deno.test({
	name: "math.subtract",
	fn: () => {
		runF("math.subtract", {
			input: { a: { value: 1 }, b: { value: 2 } },
			output: { result: { value: -1 } },
		});
	},
});
Deno.test({
	name: "math.divide",
	fn: () => {
		runF("math.divide", {
			input: { a: { value: 1 }, b: { value: 2 } },
			output: { result: { value: 0.5 } },
		});
	},
});
Deno.test({
	name: "math.power",
	fn: () => {
		runF("math.power", {
			input: { a: { value: 2 }, b: { value: 3 } },
			output: { result: { value: 8 } },
		});
	},
});
Deno.test({
	name: "math.log",
	fn: () => {
		runF("math.log", {
			input: { a: { value: 2 }, b: { value: 8 } },
			output: { result: { value: 3 } },
		});
	},
});
Deno.test({
	name: "math.lg",
	fn: () => {
		runF("math.lg", {
			input: { a: { value: 100 } },
			output: { result: { value: 2 } },
		});
	},
});
Deno.test({
	name: "math.log2",
	fn: () => {
		runF("math.log2", {
			input: { a: { value: 8 } },
			output: { result: { value: 3 } },
		});
	},
});
Deno.test({
	name: "math.ln",
	fn: () => {
		runF("math.ln", {
			input: { a: { value: Math.E ** 2 } },
			output: { result: { value: 2 } },
		});
	},
});
Deno.test({
	name: "math.exp",
	fn: () => {
		runF("math.exp", {
			input: { a: { value: 2 } },
			output: { result: { value: Math.exp(2) } },
		});
	},
});
Deno.test({
	name: "math.max",
	fn: () => {
		runF("math.max", {
			input: { a: { value: 9.8 }, b: { value: 9.11 } },
			output: { result: { value: 9.8 } },
		});
	},
});
Deno.test({
	name: "math.min",
	fn: () => {
		runF("math.min", {
			input: { a: { value: 9.8 }, b: { value: 9.11 } },
			output: { result: { value: 9.11 } },
		});
	},
});
Deno.test({
	name: "math.floor",
	fn: () => {
		runF("math.floor", {
			input: { a: { value: 9.8 } },
			output: { out: { value: 9 } },
		});
	},
});
Deno.test({
	name: "math.ceil",
	fn: () => {
		runF("math.ceil", {
			input: { a: { value: 9.8 } },
			output: { out: { value: 10 } },
		});
	},
});
Deno.test({
	name: "math.round",
	fn: () => {
		runF("math.round", {
			input: { a: { value: 9.8 } },
			output: { out: { value: 10 } },
		});
	},
});
Deno.test({
	name: "math.eqs",
	fn: () => {
		const a = 10;
		const l = [-1, 0, 10, 11];
		function x(name: string, f: (a: number, b: number) => boolean) {
			for (const b of l) {
				runF(name, {
					input: { a: { value: a }, b: { value: b } },
					output: { out: { value: f(a, b) } },
				});
			}
		}
		x("math.eq", (a, b) => a === b);
		x("math.neq", (a, b) => a !== b);
		x("math.less", (a, b) => a < b);
		x("math.greater", (a, b) => a > b);
		x("math.lessEq", (a, b) => a <= b);
		x("math.greaterEq", (a, b) => a >= b);
	},
});
Deno.test({
	name: "str.split",
	fn: () => {
		runF("str.split", {
			input: {
				str: { value: "a b c" },
			},
			output: {
				arr: {
					value: ["a", "b", "c"],
				},
			},
		});
	},
});

Deno.test({
	name: "str.join",
	fn: () => {
		runF("str.join", {
			input: {
				arr: {
					value: ["a", "b", "c"],
				},
				sep: {
					value: ",",
				},
			},
			output: {
				str: {
					value: "a,b,c",
				},
			},
		});
	},
});

Deno.test({
	name: "str.repeat",
	fn: () => {
		runF("str.repeat", {
			input: {
				str: {
					value: "hello",
				},
				repeatNum: {
					value: 2,
				},
			},
			output: {
				str: {
					value: "hellohello",
				},
			},
		});
	},
});

Deno.test({
	name: "array.at",
	fn: () => {
		runF("array.at", {
			input: {
				arr: {
					value: [0, 1, 2, 3],
				},
				index: { value: 1 },
			},
			output: {
				item: { value: 1 },
			},
		});
		runF("array.at", {
			input: {
				arr: {
					value: [0, 1, 2, 3],
				},
				index: { value: 10 },
			},
			output: {
				item: { value: null },
			},
		});
		runF("array.at", {
			input: {
				arr: {
					value: [0, 1, 2, 3],
				},
				index: { value: -1 },
			},
			output: {
				item: { value: null },
			},
		});
	},
});

Deno.test({
	name: "array.at2",
	fn: () => {
		runF("array.at2", {
			input: {
				arr: {
					value: [0, 1, 2, 3],
				},
				index: { value: 1 },
			},
			output: {
				item: { value: 1 },
			},
		});
		runF("array.at2", {
			input: {
				arr: {
					value: [0, 1, 2, 3],
				},
				index: { value: 10 },
			},
			output: {
				item: { value: null },
			},
		});
		runF("array.at2", {
			input: {
				arr: {
					value: [0, 1, 2, 3],
				},
				index: { value: -1 },
			},
			output: {
				item: { value: 3 },
			},
		});
	},
});

Deno.test({
	name: "array.slice",
	fn: () => {
		runF("array.slice", {
			input: {
				arr: {
					value: [0, 1, 2, 3],
				},
				from: { value: 1 },
				to: { value: 2 },
			},
			output: {
				subArray: { value: [0, 1, 2, 3].slice(1, 2) },
			},
		});
		runF("array.slice", {
			input: {
				arr: {
					value: [0, 1, 2, 3],
				},
				from: { value: 1 },
				to: { value: -0 },
			},
			output: {
				subArray: { value: [0, 1, 2, 3].slice(1, -0) },
			},
		});
		runF("array.slice", {
			input: {
				arr: {
					value: [0, 1, 2, 3],
				},
				from: { value: 1 },
				to: { value: -1 },
			},
			output: {
				subArray: { value: [] },
			},
		});
	},
});

Deno.test({
	name: "array.sliceStart",
	fn: () => {
		runF("array.sliceStart", {
			input: {
				arr: {
					value: [0, 1, 2, 3],
				},
				len: { value: 2 },
			},
			output: {
				subArray: { value: [0, 1] },
			},
		});
	},
});

Deno.test({
	name: "array.sliceEnd",
	fn: () => {
		runF("array.sliceEnd", {
			input: {
				arr: {
					value: [0, 1, 2, 3],
				},
				len: { value: 2 },
			},
			output: {
				subArray: { value: [2, 3] },
			},
		});
	},
});

Deno.test({
	name: "array.reverse",
	fn: () => {
		runF("array.reverse", {
			input: {
				arr: {
					value: [0, 1, 2, 3],
				},
			},
			output: {
				arr: { value: [3, 2, 1, 0] },
			},
		});
	},
});

Deno.test({
	name: "array.sort",
	fn: () => {
		runF(
			"array.sort",
			{
				input: {
					arr: {
						value: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5],
					},
				},
				output: {
					arr: {
						value: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5].toSorted((a, b) => a - b),
					},
				},
			},
			{
				sub: {
					functionName: "math.subtract",
					next: [{ id: "0", fromKey: "result", toKey: "callback" }],
				},
				0: {
					functionName: "array.sort",
					next: [
						{ id: "sub", fromKey: "itemA", toKey: "a" },
						{ id: "sub", fromKey: "itemB", toKey: "b" },
					],
				},
			},
		);
	},
});

Deno.test({
	name: "array.map",
	fn: () => {
		runF(
			"array.map",
			{
				input: {
					arr: {
						value: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5],
					},
				},
				output: {
					arr: {
						value: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5].map((i) => i * 2),
					},
				},
			},
			{
				m: {
					functionName: "math.multiply",
					next: [{ id: "0", fromKey: "result", toKey: "callback" }],
					defaultValues: { b: 2 },
				},
				0: {
					functionName: "array.map",
					next: [{ id: "m", fromKey: "item", toKey: "a" }],
				},
			},
		);
	},
});

Deno.test({
	name: "array.reduce",
	fn: () => {
		runF(
			"array.reduce",
			{
				input: {
					arr: {
						value: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5],
					},
				},
				output: {
					out: {
						value: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5].reduce(
							(acc, i) => acc + i,
						),
					},
				},
			},
			{
				m: {
					functionName: "math.add",
					next: [{ id: "0", fromKey: "result", toKey: "callback" }],
				},
				0: {
					functionName: "array.reduce",
					next: [
						{ id: "m", fromKey: "item", toKey: "a" },
						{ id: "m", fromKey: "prev", toKey: "b" },
					],
				},
			},
		);
	},
});

Deno.test({
	name: "array.filter",
	fn: () => {
		runF(
			"array.filter",
			{
				input: {
					arr: {
						value: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5],
					},
				},
				output: {
					arr: {
						value: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5].filter((i) => i > 3),
					},
				},
			},
			{
				m: {
					functionName: "math.greater",
					next: [{ id: "0", fromKey: "out", toKey: "callback" }],
					defaultValues: { b: 3 },
				},
				0: {
					functionName: "array.filter",
					next: [{ id: "m", fromKey: "item", toKey: "a" }],
				},
			},
		);
	},
});

Deno.test({
	name: "array.find",
	fn: () => {
		runF(
			"array.find",
			{
				input: {
					arr: {
						value: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5],
					},
				},
				output: {
					item: {
						value: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5].find((i) => i > 3),
					},
				},
			},
			{
				m: {
					functionName: "math.greater",
					next: [{ id: "0", fromKey: "out", toKey: "callback" }],
					defaultValues: { b: 3 },
				},
				0: {
					functionName: "array.find",
					next: [{ id: "m", fromKey: "item", toKey: "a" }],
				},
			},
		);
	},
});

Deno.test({
	name: "array.findIndex",
	fn: () => {
		runF(
			"array.findIndex",
			{
				input: {
					arr: {
						value: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5],
					},
				},
				output: {
					index: {
						value: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5].findIndex((i) => i > 3),
					},
				},
			},
			{
				m: {
					functionName: "math.greater",
					next: [{ id: "0", fromKey: "out", toKey: "callback" }],
					defaultValues: { b: 3 },
				},
				0: {
					functionName: "array.findIndex",
					next: [{ id: "m", fromKey: "item", toKey: "a" }],
				},
			},
		);
	},
});
