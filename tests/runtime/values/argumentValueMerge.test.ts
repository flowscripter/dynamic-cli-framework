import { assertEquals, assertThrows } from "@std/assert";
import argumentValueMerge from "../../../src/runtime/values/argumentValueMerge.ts";
import { MAXIMUM_ARGUMENT_ARRAY_SIZE } from "../../../src/api/argument/SubCommandArgument.ts";

Deno.test("One layer merge", () => {
  let result = argumentValueMerge({ a: 1 }, { b: 2 });
  assertEquals(result, { a: 1, b: 2 });

  result = argumentValueMerge({ a: "foo" }, { b: "bar" });
  assertEquals(result, { a: "foo", b: "bar" });

  result = argumentValueMerge({ a: true }, { b: false });
  assertEquals(result, { a: true, b: false });
});

Deno.test("One layer merge and override", () => {
  let result = argumentValueMerge({ a: 1 }, { a: 2 });
  assertEquals(result, { a: 1 });

  result = argumentValueMerge({ a: "foo" }, { a: "bar" });
  assertEquals(result, { a: "foo" });

  result = argumentValueMerge({ a: true }, { a: false });
  assertEquals(result, { a: true });
});

Deno.test("One layer merge with no defaults", () => {
  let result = argumentValueMerge({ a: 1 }, {});
  assertEquals(result, { a: 1 });

  result = argumentValueMerge({ a: "foo" }, {});
  assertEquals(result, { a: "foo" });

  result = argumentValueMerge({ a: true }, {});
  assertEquals(result, { a: true });
});

Deno.test("One layer merge with no overrides", () => {
  let result = argumentValueMerge({}, { a: 1 });
  assertEquals(result, { a: 1 });

  result = argumentValueMerge({}, { a: "foo" });
  assertEquals(result, { a: "foo" });

  result = argumentValueMerge({}, { a: true });
  assertEquals(result, { a: true });
});

Deno.test("Override from configured number to parsed string", () => {
  const result = argumentValueMerge({ a: "1" }, { a: 2 });
  assertEquals(result, { a: "1" });
});

Deno.test("Override from configured boolean to parsed string", () => {
  const result = argumentValueMerge({ a: "true" }, { a: false });
  assertEquals(result, { a: "true" });
});

Deno.test("Override from configured single value to parsed array", () => {
  const result = argumentValueMerge({ a: [1, 2] }, { a: 2 });
  assertEquals(result, { a: [1, 2] });
});

Deno.test("Override from configured single number value to parsed string array", () => {
  const result = argumentValueMerge({ a: ["1", "2"] }, { a: 2 });
  assertEquals(result, { a: ["1", "2"] });
});

Deno.test("Override configured array value with parsed single value", () => {
  const result = argumentValueMerge({ a: 3 }, { a: [1, 2] });
  assertEquals(result, { a: [3, 2] });
});

Deno.test("Override configured number array value with parsed single string value", () => {
  const result = argumentValueMerge({ a: "3" }, { a: [1, 2] });
  assertEquals(result, { a: ["3", 2] });
});

Deno.test("Complex object and arrays merge", () => {
  const result = argumentValueMerge({ a: { b: { c: "foo" } } }, {
    d: [{ e: [{ f: 1 }] }],
  });
  assertEquals(result, { a: { b: { c: "foo" } }, d: [{ e: [{ f: 1 }] }] });
});

Deno.test("Complex object and arrays merge and override", () => {
  let result = argumentValueMerge({
    a: { b: { c: "foo", c1: "bar", c2: "car" } },
    d: [{ e: [{ f: 1 }, { g: 2 }, { g2: 3 }] }],
  }, {
    a: { b: { c: "boo", c1: "bar" } },
    d: [{ e: [{ f: 0 }, { g: 0 }, { g1: 2 }] }],
  });
  assertEquals(result, {
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
  assertEquals(result, {
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
  assertEquals(result, {
    a: { b: { c: "foo", c1: "bar", c2: "car" } },
    d: [{ e: [{ f: 1 }, { g: 2 }, { g2: 3 }, { g3: 4 }] }],
  });
});

Deno.test("Primitive array merge and insert", () => {
  let result = argumentValueMerge({ a: [1, 2, 3] }, { a: [1, 2, 3] });
  assertEquals(result, { a: [1, 2, 3] });

  result = argumentValueMerge({ a: [1, 2, 3, 4] }, { a: [1, 2, 3] });
  assertEquals(result, { a: [1, 2, 3, 4] });

  result = argumentValueMerge({ a: [1, 2, 3] }, { a: [1, 2, 3, 4] });
  assertEquals(result, { a: [1, 2, 3, 4] });

  result = argumentValueMerge({ a: [1, 2, 3] }, { a: [4, 5, 6, 7] });
  assertEquals(result, { a: [1, 2, 3, 7] });
});

Deno.test("Complex object array merge and insert", () => {
  let result = argumentValueMerge({ a: [{ b: 1 }, { c: 2 }, { d: 3 }] }, {
    a: [{ b: 1 }, { c: 2 }, { d: 3 }],
  });
  assertEquals(result, { a: [{ b: 1 }, { c: 2 }, { d: 3 }] });

  result = argumentValueMerge({
    a: [{ b: 1 }, { c: 2 }, { d: 3 }, { e: 4 }],
  }, { a: [{ b: 1 }, { c: 2 }, { d: 3 }] });
  assertEquals(result, { a: [{ b: 1 }, { c: 2 }, { d: 3 }, { e: 4 }] });

  result = argumentValueMerge({ a: [{ b: 1 }, { c: 2 }, { d: 3 }] }, {
    a: [{ b: 1 }, { c: 2 }, { d: 3 }, { e: 4 }],
  });
  assertEquals(result, { a: [{ b: 1 }, { c: 2 }, { d: 3 }, { e: 4 }] });

  result = argumentValueMerge({ a: [{ b: 1 }, { c: 2 }, { d: 3 }] }, {
    a: [{ b: 4 }, { c: 5 }, { d: 6 }, { e: 7 }],
  });
  assertEquals(result, { a: [{ b: 1 }, { c: 2 }, { d: 3 }, { e: 7 }] });

  result = argumentValueMerge({ a: [{ b: 1 }, { c: 2 }, { d: 3 }] }, {
    a: [{ b1: 4 }, { c1: 5 }, { d1: 6 }, { e1: 7 }],
  });
  assertEquals(result, {
    a: [{ b: 1, b1: 4 }, { c: 2, c1: 5 }, { d: 3, d1: 6 }, { e1: 7 }],
  });

  result = argumentValueMerge({ a: [{ a: 1 }, { a: 2 }, { a: 3 }] }, {
    a: [{ a: 4 }, { a: 5 }, { a: 6 }, { a: 7 }],
  });
  assertEquals(result, {
    a: [{ a: 1 }, { a: 2 }, { a: 3 }, { a: 7 }],
  });
});

Deno.test("Complex object and arrays merge with no defaults", () => {
  const result = argumentValueMerge({
    a: { b: { c: "foo" } },
    d: [{ e: [{ f: 1 }] }],
  }, {});
  assertEquals(result, { a: { b: { c: "foo" } }, d: [{ e: [{ f: 1 }] }] });
});

Deno.test("Complex object and arrays merge with no overrides", () => {
  const result = argumentValueMerge({}, {
    a: { b: { c: "foo" } },
    d: [{ e: [{ f: 1 }] }],
  });
  assertEquals(result, { a: { b: { c: "foo" } }, d: [{ e: [{ f: 1 }] }] });
});

Deno.test("One layer merge with undefined values", () => {
  let result = argumentValueMerge({ a: undefined }, { b: 1 });
  assertEquals(result, { a: undefined, b: 1 });

  result = argumentValueMerge({ a: undefined }, { b: "foo" });
  assertEquals(result, { a: undefined, b: "foo" });

  result = argumentValueMerge({ a: undefined }, { b: true });
  assertEquals(result, { a: undefined, b: true });
});

Deno.test("One layer merge and override with undefined values", () => {
  let result = argumentValueMerge({ a: undefined }, { a: 1 });
  assertEquals(result, { a: 1 });

  result = argumentValueMerge({ a: undefined }, { a: "foo" });
  assertEquals(result, { a: "foo" });

  result = argumentValueMerge({ a: undefined }, { a: true });
  assertEquals(result, { a: true });
});

Deno.test("Primitive array merge with undefined values", () => {
  const result = argumentValueMerge({ a: [1, 2, 3, undefined] }, {
    a: [1, 2, 3],
  });
  assertEquals(result, { a: [1, 2, 3, undefined] });
});

Deno.test("Primitive array merge and override with undefined values", () => {
  const result = argumentValueMerge({ a: [1, 2, undefined] }, {
    a: [1, 2, 3],
  });
  assertEquals(result, { a: [1, 2, 3] });
});

Deno.test("Complex object and arrays merge undefined values", () => {
  const result = argumentValueMerge({
    a: { b: { c: undefined } },
    d: [{ e: [{ f: 1 }, { g: 2 }, { g2: 3 }, undefined] }],
  }, {
    a: { b: { c1: "foo" } },
    d: [{ e: [{ f: 0 }, { g: 2 }, { g1: 2 }] }],
  });
  assertEquals(result, {
    a: { b: { c: undefined, c1: "foo" } },
    d: [{ e: [{ f: 1 }, { g: 2 }, { g1: 2, g2: 3 }, undefined] }],
  });
});

Deno.test("Complex object and arrays merge and override with undefined values", () => {
  const result = argumentValueMerge({
    a: { b: { c: undefined } },
    d: [{ e: [{ f: 1 }, undefined, { g2: 3 }] }],
  }, { a: { b: { c: "foo" } }, d: [{ e: [{ f: 0 }, { g: 2 }, { g1: 2 }] }] });
  assertEquals(result, {
    a: { b: { c: "foo" } },
    d: [{ e: [{ f: 1 }, { g: 2 }, { g1: 2, g2: 3 }] }],
  });
});

Deno.test("Complex object merge with undefined objects", () => {
  const result = argumentValueMerge({ a: { b1: undefined } }, {
    a: { b2: { c: "foo" } },
  });
  assertEquals(result, { a: { b1: undefined, b2: { c: "foo" } } });
});

Deno.test("Complex object merge and override with undefined objects", () => {
  const result = argumentValueMerge({ a: { b: undefined } }, {
    a: { b: { c: "foo" } },
  });
  assertEquals(result, { a: { b: { c: "foo" } } });
});

Deno.test("Maximum array size asserted", () => {
  const illegal = new Array<number>();
  for (let i = 0; i <= MAXIMUM_ARGUMENT_ARRAY_SIZE; i++) {
    illegal.push(i);
  }
  assertThrows(
    () => argumentValueMerge({ a: illegal }, { a: [1, 2] }),
    "Maximum array size exceeded: 256",
  );
  assertThrows(
    () => argumentValueMerge({ a: [1, 2] }, { a: illegal }),
    "Maximum array size exceeded:",
  );
});

Deno.test("Maximum nesting depth asserted", () => {
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
  assertThrows(
    () => argumentValueMerge(illegal, {}),
    "Maximum complex option nesting depth exceeded: 11",
  );
  assertThrows(
    () => argumentValueMerge({}, illegal),
    "Maximum complex option nesting depth exceeded: 11",
  );
});
