import { assertEquals } from "jsr:@std/assert";
import { env, type XFunction } from "../src/main.ts";

function runF(
	name: string,
	op: {
		input: Record<string, { value: unknown }>;
		output: Record<string, { value: unknown }>;
	},
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
