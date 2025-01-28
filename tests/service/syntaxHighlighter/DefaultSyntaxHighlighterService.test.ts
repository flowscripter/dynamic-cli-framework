import { assertEquals, assertThrows } from "@std/assert";
import { Buffer } from "@std/streams";
import { expectBufferBytesEquals } from "../../fixtures/util.ts";
import DefaultSyntaxHighlighterService from "../../../src/service/syntaxHighlighter/DefaultSyntaxHighlighterService.ts";
import yaml from "highlight.js/lib/languages/yaml";

Deno.test("JSON registered by default", () => {
  const syntaxHighlighterService = new DefaultSyntaxHighlighterService();

  assertEquals(syntaxHighlighterService.getRegisteredSyntaxes(), ["json"]);
});

Deno.test("Cannot register a syntax if already registered", () => {
  const syntaxHighlighterService = new DefaultSyntaxHighlighterService();

  assertThrows(() => syntaxHighlighterService.registerSyntax("jSon", yaml));
});

Deno.test("Can register new syntax", () => {
  const syntaxHighlighterService = new DefaultSyntaxHighlighterService();

  syntaxHighlighterService.registerSyntax("yaml", yaml);
  assertEquals(syntaxHighlighterService.getRegisteredSyntaxes(), [
    "json",
    "yaml",
  ]);
});

Deno.test("Cannot highlight with unknown syntax", () => {
  const syntaxHighlighterService = new DefaultSyntaxHighlighterService();

  assertThrows(() => syntaxHighlighterService.highlight("foo: 1", "yaml"));
});

Deno.test("Can highlight with JSON syntax", () => {
  const syntaxHighlighterService = new DefaultSyntaxHighlighterService();

  syntaxHighlighterService.registerSyntax("yaml", yaml);

  const highlighted = syntaxHighlighterService.highlight(
    "{ foo: 1 }",
    "json",
  );
  expectBufferBytesEquals(
    new Buffer(new TextEncoder().encode(highlighted)),
    new Uint8Array([
      123,
      32,
      102,
      111,
      111,
      58,
      32,
      27,
      91,
      51,
      54,
      109,
      49,
      27,
      91,
      51,
      57,
      109,
      32,
      125,
    ]),
  );
});

// Deno.test("Can highlight with newly registered syntax", () => {
//   const syntaxHighlighterService = new DefaultSyntaxHighlighterService();
//
//   syntaxHighlighterService.registerSyntax("yaml", yamlSyntaxDefinition);
//
//   const highlighted = syntaxHighlighterService.highlight("foo: 1", "yaml");
//   expectBufferBytesEquals(
//     new Buffer(new TextEncoder().encode(highlighted)),
//     new Uint8Array([
//       27,
//       91,
//       51,
//       51,
//       109,
//       102,
//       111,
//       111,
//       58,
//       27,
//       91,
//       51,
//       57,
//       109,
//       32,
//       27,
//       91,
//       51,
//       54,
//       109,
//       49,
//       27,
//       91,
//       51,
//       57,
//       109,
//     ]),
//   );
// });
//
// Deno.test("Skipped if color disabled", () => {
//   const syntaxHighlighterService = new DefaultSyntaxHighlighterService();
//   syntaxHighlighterService.colorEnabled = false;
//
//   const highlighted = syntaxHighlighterService.highlight(
//     "{ foo: 1 }",
//     "json",
//   );
//
//   assertEquals(highlighted, "{ foo: 1 }");
// });
