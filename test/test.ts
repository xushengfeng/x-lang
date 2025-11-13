import { assertEquals } from "jsr:@std/assert";
import { env, newFunction } from "../src/main.ts";
import { callbackCode, fibCode } from "./test_data.ts";

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
		const x = e.checkStrict(callbackCode);
		if (x) {
			const r = e.run(x, { it: "a b c", sep: " ", rpn: 2, rpn1: 2 });
			console.log(r);
			assertEquals(r, { out: "aaaa bbbb cccc" });
		}
	},
});

Deno.test({
	name: "default value",
	fn: () => {
		const e = env();
		const x = e.checkStrict({
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
					defaultValues: { repeatNum: 2 },
				},
				"3": {
					functionName: "str.repeat",
					next: [{ id: "1", fromKey: "str", toKey: "callback" }],
					defaultValues: { repeatNum: 2 },
				},
				"10": {
					functionName: "str.join",
					next: [],
					defaultValues: { sep: " " },
				},
			},
		});
		if (x) {
			const r = e.run(x, { it: "a b c" });
			console.log(r);
			assertEquals(r, { out: "aaaa bbbb cccc" });
		}
	},
});

Deno.test({
	name: "default value2",
	fn: () => {
		const e = env();
		const x = e.checkStrict({
			input: [],
			output: [
				{
					name: "out",
					mapKey: { id: "10", key: "str" },
					type: { type: "string" },
				},
			],
			data: {
				"10": {
					functionName: "str.join",
					next: [],
					defaultValues: { arr: ["a", "b", "c"], sep: " " },
				},
			},
		});
		if (x) {
			const r = e.run(x, {});
			console.log(r);
			assertEquals(r, { out: "a b c" });
		}
	},
});

Deno.test({
	name: "fib",
	fn: () => {
		const e = env();
		const fib = newFunction(fibCode);
		e.addFunction("fib", fib);
		e.checkStrict(fib);
		const x = e.checkStrict({
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
		});
		function fibf(n: number): number {
			if (n <= 1) return n;
			return fibf(n - 1) + fibf(n - 2);
		}
		if (x) {
			const r = e.run(x, { it: 5 });
			console.log(r);
			assertEquals(r, { out: fibf(5) });
		}
	},
});

Deno.test({
	name: "cache fib",
	fn: () => {
		const e = env({
			cache: {
				max: 10000,
			},
			log: { debug: () => {}, warn: () => {}, error: () => {}, info: () => {} },
		});
		const fib = newFunction(fibCode);
		e.addFunction("fib", fib);
		e.checkStrict(fib);
		const x = e.checkStrict({
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
		});
		const cachedResults = new Map<number, number>();
		function fibf(n: number): number {
			if (n <= 1) return n;
			if (cachedResults.has(n)) {
				return cachedResults.get(n)!;
			}
			const r = fibf(n - 1) + fibf(n - 2);
			cachedResults.set(n, r);
			return r;
		}
		if (x) {
			const r = e.run(x, { it: 30 });
			console.log(r);
			assertEquals(r, { out: fibf(30) });
		}
	},
});
