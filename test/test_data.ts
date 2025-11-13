import type { XFunction } from "../src/main.ts";

export const callbackCode: XFunction = {
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
};

export const fibCode: XFunction = {
	input: [
		{
			name: "num",
			type: { type: "num" },
			mapKey: { id: "0", key: "value" },
		},
	],
	output: [
		{
			name: "num",
			type: { type: "num" },
			mapKey: { id: "out", key: "out" },
		},
	],
	data: {
		"0": {
			functionName: "value.num",
			next: [
				{ id: "less", fromKey: "out", toKey: "a" },
				{ id: "splitX", fromKey: "out", toKey: "data" },
			],
		},
		constLess1: {
			functionName: "value.num",
			next: [{ id: "less", fromKey: "out", toKey: "b" }],
			defaultValues: { value: 1 },
		},
		less: {
			functionName: "math.lessEq",
			next: [{ id: "splitX", fromKey: "out", toKey: "condition" }],
		},
		splitX: {
			functionName: "ctrl.split",
			next: [
				{ id: "out", fromKey: "true", toKey: "value" },
				{ id: "sub1", fromKey: "false", toKey: "a" },
				{ id: "sub2", fromKey: "false", toKey: "a" },
			],
		},
		constSub1: {
			functionName: "value.num",
			next: [{ id: "sub1", fromKey: "out", toKey: "b" }],
			defaultValues: { value: 1 },
		},
		constSub2: {
			functionName: "value.num",
			next: [{ id: "sub2", fromKey: "out", toKey: "b" }],
			defaultValues: { value: 2 },
		},
		sub1: {
			functionName: "math.subtract",
			next: [{ id: "fib1", fromKey: "result", toKey: "num" }],
		},
		sub2: {
			functionName: "math.subtract",
			next: [{ id: "fib2", fromKey: "result", toKey: "num" }],
		},
		fib1: {
			functionName: "fib",
			next: [{ id: "add", fromKey: "num", toKey: "a" }],
		},
		fib2: {
			functionName: "fib",
			next: [{ id: "add", fromKey: "num", toKey: "b" }],
		},
		add: {
			functionName: "math.add",
			next: [{ id: "out", fromKey: "result", toKey: "value" }],
		},
		out: {
			functionName: "value.num",
			next: [],
		},
	},
};
