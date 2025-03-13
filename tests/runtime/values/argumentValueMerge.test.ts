import { describe, expect, test } from "bun:test";
import argumentValueMerge from "../../../src/runtime/values/argumentValueMerge.ts";
import { MAXIMUM_ARGUMENT_ARRAY_SIZE } from "../../../src/api/argument/SubCommandArgument.ts";

describe("argumentValueMerge tests", () => {
  test("One layer merge", () => {
    let result = argumentValueMerge({ a: 1 }, { b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });

    result = argumentValueMerge({ a: "foo" }, { b: "bar" });
    expect(result).toEqual({ a: "foo", b: "bar" });

    result = argumentValueMerge({ a: true }, { b: false });
    expect(result).toEqual({ a: true, b: false });
  });

  test("One layer merge and override", () => {
    let result = argumentValueMerge({ a: 1 }, { a: 2 });
    expect(result).toEqual({ a: 1 });

    result = argumentValueMerge({ a: "foo" }, { a: "bar" });
    expect(result).toEqual({ a: "foo" });

    result = argumentValueMerge({ a: true }, { a: false });
    expect(result).toEqual({ a: true });
  });

  test("One layer merge with no defaults", () => {
    let result = argumentValueMerge({ a: 1 }, {});
    expect(result).toEqual({ a: 1 });

    result = argumentValueMerge({ a: "foo" }, {});
    expect(result).toEqual({ a: "foo" });

    result = argumentValueMerge({ a: true }, {});
    expect(result).toEqual({ a: true });
  });

  test("One layer merge with no overrides", () => {
    let result = argumentValueMerge({}, { a: 1 });
    expect(result).toEqual({ a: 1 });

    result = argumentValueMerge({}, { a: "foo" });
    expect(result).toEqual({ a: "foo" });

    result = argumentValueMerge({}, { a: true });
    expect(result).toEqual({ a: true });
  });

  test("Override from configured number to parsed string", () => {
    const result = argumentValueMerge({ a: "1" }, { a: 2 });
    expect(result).toEqual({ a: "1" });
  });

  test("Override from configured boolean to parsed string", () => {
    const result = argumentValueMerge({ a: "true" }, { a: false });
    expect(result).toEqual({ a: "true" });
  });

  test("Override from configured single value to parsed array", () => {
    const result = argumentValueMerge({ a: [1, 2] }, { a: 2 });
    expect(result).toEqual({ a: [1, 2] });
  });

  test("Override from configured single number value to parsed string array", () => {
    const result = argumentValueMerge({ a: ["1", "2"] }, { a: 2 });
    expect(result).toEqual({ a: ["1", "2"] });
  });

  test("Override configured array value with parsed single value", () => {
    const result = argumentValueMerge({ a: 3 }, { a: [1, 2] });
    expect(result).toEqual({ a: [3, 2] });
  });

  test("Override configured number array value with parsed single string value", () => {
    const result = argumentValueMerge({ a: "3" }, { a: [1, 2] });
    expect(result).toEqual({ a: ["3", 2] });
  });

  test("Complex object and arrays merge", () => {
    const result = argumentValueMerge({ a: { b: { c: "foo" } } }, {
      d: [{ e: [{ f: 1 }] }],
    });
    expect(result).toEqual({ a: { b: { c: "foo" } }, d: [{ e: [{ f: 1 }] }] });
  });

  test("Complex object and arrays merge and override", () => {
    let result = argumentValueMerge({
      a: { b: { c: "foo", c1: "bar", c2: "car" } },
      d: [{ e: [{ f: 1 }, { g: 2 }, { g2: 3 }] }],
    }, {
      a: { b: { c: "boo", c1: "bar" } },
      d: [{ e: [{ f: 0 }, { g: 0 }, { g1: 2 }] }],
    });
    expect(result).toEqual({
      a: { b: { c: "foo", c1: "bar", c2: "car" } },
      d: [{ e: [{ f: 1 }, { g: 2 }, { g1: 2, g2: 3 }] }],
    });

    result = argumentValueMerge({
      a: { b: { c: "foo", c1: "bar", c2: "car" } },
      d: [{ e: [{ f: 1 }, { g: 2 }, { g2: 3 }] }],
    }, {
      a: { b: { c: "boo", c1: "bar" } },
      d: [{ e: [{ f: 0 }, { g: 0 }, { g1: 2 }, { g3: 4 }] }],
    });
    expect(result).toEqual({
      a: { b: { c: "foo", c1: "bar", c2: "car" } },
      d: [{ e: [{ f: 1 }, { g: 2 }, { g1: 2, g2: 3 }, { g3: 4 }] }],
    });

    result = argumentValueMerge({
      a: { b: { c: "foo", c1: "bar", c2: "car" } },
      d: [{ e: [{ f: 1 }, { g: 2 }, { g2: 3 }] }],
    }, {
      a: { b: { c: "boo", c1: "bar" } },
      d: [{ e: [{ f: 0 }, { g: 0 }, { g2: 2 }, { g3: 4 }] }],
    });
    expect(result).toEqual({
      a: { b: { c: "foo", c1: "bar", c2: "car" } },
      d: [{ e: [{ f: 1 }, { g: 2 }, { g2: 3 }, { g3: 4 }] }],
    });
  });

  test("Primitive array merge and insert", () => {
    let result = argumentValueMerge({ a: [1, 2, 3] }, { a: [1, 2, 3] });
    expect(result).toEqual({ a: [1, 2, 3] });

    result = argumentValueMerge({ a: [1, 2, 3, 4] }, { a: [1, 2, 3] });
    expect(result).toEqual({ a: [1, 2, 3, 4] });

    result = argumentValueMerge({ a: [1, 2, 3] }, { a: [1, 2, 3, 4] });
    expect(result).toEqual({ a: [1, 2, 3, 4] });

    result = argumentValueMerge({ a: [1, 2, 3] }, { a: [4, 5, 6, 7] });
    expect(result).toEqual({ a: [1, 2, 3, 7] });
  });

  test("Complex object array merge and insert", () => {
    let result = argumentValueMerge({ a: [{ b: 1 }, { c: 2 }, { d: 3 }] }, {
      a: [{ b: 1 }, { c: 2 }, { d: 3 }],
    });
    expect(result).toEqual({ a: [{ b: 1 }, { c: 2 }, { d: 3 }] });

    result = argumentValueMerge({
      a: [{ b: 1 }, { c: 2 }, { d: 3 }, { e: 4 }],
    }, { a: [{ b: 1 }, { c: 2 }, { d: 3 }] });
    expect(result).toEqual({ a: [{ b: 1 }, { c: 2 }, { d: 3 }, { e: 4 }] });

    result = argumentValueMerge({ a: [{ b: 1 }, { c: 2 }, { d: 3 }] }, {
      a: [{ b: 1 }, { c: 2 }, { d: 3 }, { e: 4 }],
    });
    expect(result).toEqual({ a: [{ b: 1 }, { c: 2 }, { d: 3 }, { e: 4 }] });

    result = argumentValueMerge({ a: [{ b: 1 }, { c: 2 }, { d: 3 }] }, {
      a: [{ b: 4 }, { c: 5 }, { d: 6 }, { e: 7 }],
    });
    expect(result).toEqual({ a: [{ b: 1 }, { c: 2 }, { d: 3 }, { e: 7 }] });

    result = argumentValueMerge({ a: [{ b: 1 }, { c: 2 }, { d: 3 }] }, {
      a: [{ b1: 4 }, { c1: 5 }, { d1: 6 }, { e1: 7 }],
    });
    expect(result).toEqual({
      a: [{ b: 1, b1: 4 }, { c: 2, c1: 5 }, { d: 3, d1: 6 }, { e1: 7 }],
    });

    result = argumentValueMerge({ a: [{ a: 1 }, { a: 2 }, { a: 3 }] }, {
      a: [{ a: 4 }, { a: 5 }, { a: 6 }, { a: 7 }],
    });
    expect(result).toEqual({
      a: [{ a: 1 }, { a: 2 }, { a: 3 }, { a: 7 }],
    });
  });

  test("Complex object and arrays merge with no defaults", () => {
    const result = argumentValueMerge({
      a: { b: { c: "foo" } },
      d: [{ e: [{ f: 1 }] }],
    }, {});
    expect(result).toEqual({ a: { b: { c: "foo" } }, d: [{ e: [{ f: 1 }] }] });
  });

  test("Complex object and arrays merge with no overrides", () => {
    const result = argumentValueMerge({}, {
      a: { b: { c: "foo" } },
      d: [{ e: [{ f: 1 }] }],
    });
    expect(result).toEqual({ a: { b: { c: "foo" } }, d: [{ e: [{ f: 1 }] }] });
  });

  test("One layer merge with undefined values", () => {
    let result = argumentValueMerge({ a: undefined }, { b: 1 });
    expect(result).toEqual({ a: undefined, b: 1 });

    result = argumentValueMerge({ a: undefined }, { b: "foo" });
    expect(result).toEqual({ a: undefined, b: "foo" });

    result = argumentValueMerge({ a: undefined }, { b: true });
    expect(result).toEqual({ a: undefined, b: true });
  });

  test("One layer merge and override with undefined values", () => {
    let result = argumentValueMerge({ a: undefined }, { a: 1 });
    expect(result).toEqual({ a: 1 });

    result = argumentValueMerge({ a: undefined }, { a: "foo" });
    expect(result).toEqual({ a: "foo" });

    result = argumentValueMerge({ a: undefined }, { a: true });
    expect(result).toEqual({ a: true });
  });

  test("Primitive array merge with undefined values", () => {
    const result = argumentValueMerge({ a: [1, 2, 3, undefined] }, {
      a: [1, 2, 3],
    });
    expect(result).toEqual({ a: [1, 2, 3, undefined] });
  });

  test("Primitive array merge and override with undefined values", () => {
    const result = argumentValueMerge({ a: [1, 2, undefined] }, {
      a: [1, 2, 3],
    });
    expect(result).toEqual({ a: [1, 2, 3] });
  });

  test("Complex object and arrays merge undefined values", () => {
    const result = argumentValueMerge({
      a: { b: { c: undefined } },
      d: [{ e: [{ f: 1 }, { g: 2 }, { g2: 3 }, undefined] }],
    }, {
      a: { b: { c1: "foo" } },
      d: [{ e: [{ f: 0 }, { g: 2 }, { g1: 2 }] }],
    });
    expect(result).toEqual({
      a: { b: { c: undefined, c1: "foo" } },
      d: [{ e: [{ f: 1 }, { g: 2 }, { g1: 2, g2: 3 }, undefined] }],
    });
  });

  test("Complex object and arrays merge and override with undefined values", () => {
    const result = argumentValueMerge({
      a: { b: { c: undefined } },
      d: [{ e: [{ f: 1 }, undefined, { g2: 3 }] }],
    }, { a: { b: { c: "foo" } }, d: [{ e: [{ f: 0 }, { g: 2 }, { g1: 2 }] }] });
    expect(result).toEqual({
      a: { b: { c: "foo" } },
      d: [{ e: [{ f: 1 }, { g: 2 }, { g1: 2, g2: 3 }] }],
    });
  });

  test("Complex object merge with undefined objects", () => {
    const result = argumentValueMerge({ a: { b1: undefined } }, {
      a: { b2: { c: "foo" } },
    });
    expect(result).toEqual({ a: { b1: undefined, b2: { c: "foo" } } });
  });

  test("Complex object merge and override with undefined objects", () => {
    const result = argumentValueMerge({ a: { b: undefined } }, {
      a: { b: { c: "foo" } },
    });
    expect(result).toEqual({ a: { b: { c: "foo" } } });
  });

  test("Maximum array size asserted", () => {
    const illegal = new Array<number>();
    for (let i = 0; i <= MAXIMUM_ARGUMENT_ARRAY_SIZE; i++) {
      illegal.push(i);
    }
    expect(() => argumentValueMerge({ a: illegal }, { a: [1, 2] }))
      .toThrowError(
        "Maximum array size exceeded: 256",
      );
    expect(() => argumentValueMerge({ a: [1, 2] }, { a: illegal }))
      .toThrowError(
        "Maximum array size exceeded:",
      );
  });

  test("Maximum nesting depth asserted", () => {
    const illegal = {
      a: {
        b: {
          c: {
            d: {
              e: {
                f: {
                  g: {
                    h: {
                      i: {
                        j: {
                          k: {
                            l: 1,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    expect(() => argumentValueMerge(illegal, {})).toThrowError(
      "Maximum complex option nesting depth exceeded: 11",
    );
    expect(() => argumentValueMerge({}, illegal)).toThrowError(
      "Maximum complex option nesting depth exceeded: 11",
    );
  });
});
