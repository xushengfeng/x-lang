import { assertEquals } from "jsr:@std/assert";
import { env } from "../src/main.ts";

Deno.test({
	name: "simple",
	fn: () => {
		const e = env();
		const x = e.checkStrict({
			input: [
				{
					name: "it",
					mapKey: { id: "0", key: "str" },
					type: { type: "string" },
				},
				{
					name: "sep",
					mapKey: { id: "1", key: "sep" },
					type: { type: "string" },
				},
			],
			output: [
				{
					name: "out",
					mapKey: { id: "1", key: "str" },
					type: { type: "string" },
				},
			],
			data: {
				"0": {
					functionName: "str.split",
					next: [{ id: "1", fromKey: "arr", toKey: "arr" }],
				},
				"1": {
					functionName: "str.join",
					next: [],
				},
			},
		});
		if (x) {
			const r = e.run(x, { it: "a b c", sep: " " });
			console.log(r);
			assertEquals(r, { out: "a b c" });
		}
	},
});

Deno.test({
	name: "callback",
	fn: () => {
		const e = env();
		const x = e.checkStrict({
			input: [
				{
					name: "it",
					mapKey: { id: "0", key: "str" },
					type: { type: "string" },
				},
				{
					name: "sep",
					mapKey: { id: "10", key: "sep" },
					type: { type: "string" },
				},
				{
					name: "rpn",
					mapKey: { id: "2", key: "repeatNum" },
					type: { type: "num" },
				},
				{
					name: "rpn1",
					mapKey: { id: "3", key: "repeatNum" },
					type: { type: "num" },
				},
			],
			output: [
				{
					name: "out",
					mapKey: { id: "10", key: "str" },
					type: { type: "string" },
				},
			],
			data: {
				"0": {
					functionName: "str.split",
					next: [{ id: "1", fromKey: "arr", toKey: "arr" }],
				},
				"1": {
					functionName: "array.map",
					next: [
						{ id: "10", fromKey: "arr", toKey: "arr" },
						{ id: "2", fromKey: "item", toKey: "str" },
					],
				},
				"2": {
					functionName: "str.repeat",
					next: [{ id: "3", fromKey: "str", toKey: "str" }],
				},
				"3": {
					functionName: "str.repeat",
					next: [{ id: "1", fromKey: "str", toKey: "callback" }],
				},
				"10": {
					functionName: "str.join",
					next: [],
				},
			},
		});
		if (x) {
			const r = e.run(x, { it: "a b c", sep: " ", rpn: 2, rpn1: 2 });
			console.log(r);
			assertEquals(r, { out: "aaaa bbbb cccc" });
		}
	},
});
