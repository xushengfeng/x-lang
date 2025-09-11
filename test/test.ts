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
