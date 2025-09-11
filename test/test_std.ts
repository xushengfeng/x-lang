import { assertEquals } from "jsr:@std/assert";
import { env, type XFunction } from "../src/main.ts";

function runF(
	name: string,
	op: { input: XFunction["input"]; output: XFunction["output"] },
	i: Record<string, unknown>,
	o: Record<string, unknown>,
) {
	const e = env();
	const x = e.checkStrict({
		input: op.input,
		output: op.output,
		data: {
			"0": {
				functionName: name,
				next: [],
			},
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
	name: "str.split",
	fn: () => {
		runF(
			"str.split",
			{
				input: [
					{
						name: "it",
						mapKey: { id: "0", key: "str" },
						type: { type: "string" },
					},
				],
				output: [
					{
						name: "out",
						mapKey: { id: "0", key: "arr" },
						type: { type: "array", subType: { item: { type: "string" } } },
					},
				],
			},
			{ it: "a b c" },
			{ out: ["a", "b", "c"] },
		);
	},
});

Deno.test({
	name: "str.join",
	fn: () => {
		runF(
			"str.join",
			{
				input: [
					{
						name: "it",
						mapKey: { id: "0", key: "arr" },
						type: { type: "array", subType: { item: { type: "string" } } },
					},
					{
						name: "sep",
						mapKey: { id: "0", key: "sep" },
						type: { type: "string" },
					},
				],
				output: [
					{
						name: "out",
						mapKey: { id: "0", key: "str" },
						type: { type: "string" },
					},
				],
			},
			{ it: ["a", "b", "c"], sep: "," },
			{ out: "a,b,c" },
		);
	},
});

Deno.test({
	name: "str.repeat",
	fn: () => {
		runF(
			"str.repeat",
			{
				input: [
					{
						name: "it",
						mapKey: { id: "0", key: "str" },
						type: { type: "string" },
					},
					{
						name: "repeatNum",
						mapKey: { id: "0", key: "repeatNum" },
						type: { type: "num" },
					},
				],
				output: [
					{
						name: "out",
						mapKey: { id: "0", key: "str" },
						type: { type: "string" },
					},
				],
			},
			{ it: "hello", repeatNum: 2 },
			{ out: "hellohello" },
		);
	},
});
