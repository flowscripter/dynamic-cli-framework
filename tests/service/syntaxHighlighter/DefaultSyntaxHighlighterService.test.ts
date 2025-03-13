import { describe, expect, test } from "bun:test";
import { expectBytesEquals } from "../../fixtures/util.ts";
import DefaultSyntaxHighlighterService from "../../../src/service/syntaxHighlighter/DefaultSyntaxHighlighterService.ts";
import yaml from "highlight.js/lib/languages/yaml";

describe("DefaultSyntaxHighlighterService tests", () => {
  test("JSON registered by default", () => {
    const syntaxHighlighterService = new DefaultSyntaxHighlighterService();

    expect(syntaxHighlighterService.getRegisteredSyntaxes()).toEqual(["json"]);
  });

  test("Cannot register a syntax if already registered", () => {
    const syntaxHighlighterService = new DefaultSyntaxHighlighterService();

    expect(() => syntaxHighlighterService.registerSyntax("jSon", yaml))
      .toThrow();
  });

  test("Can register new syntax", () => {
    const syntaxHighlighterService = new DefaultSyntaxHighlighterService();

    syntaxHighlighterService.registerSyntax("yaml", yaml);
    expect(syntaxHighlighterService.getRegisteredSyntaxes()).toEqual([
      "json",
      "yaml",
    ]);
  });

  test("Cannot highlight with unknown syntax", () => {
    const syntaxHighlighterService = new DefaultSyntaxHighlighterService();

    expect(() => syntaxHighlighterService.highlight("foo: 1", "yaml"))
      .toThrow();
  });

  test("Can highlight with JSON syntax", () => {
    const syntaxHighlighterService = new DefaultSyntaxHighlighterService();

    syntaxHighlighterService.registerSyntax("yaml", yaml);

    const highlighted = syntaxHighlighterService.highlight(
      "{ foo: 1 }",
      "json",
    );
    expectBytesEquals(
      highlighted,
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

  test("Can highlight with newly registered syntax", () => {
    const syntaxHighlighterService = new DefaultSyntaxHighlighterService();

    syntaxHighlighterService.registerSyntax("yaml", yaml);

    const highlighted = syntaxHighlighterService.highlight("foo: 1", "yaml");
    expectBytesEquals(
      highlighted,
      new Uint8Array([
        27,
        91,
        51,
        51,
        109,
        102,
        111,
        111,
        58,
        27,
        91,
        51,
        57,
        109,
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
      ]),
    );
  });

  test("Skipped if color disabled", () => {
    const syntaxHighlighterService = new DefaultSyntaxHighlighterService();
    syntaxHighlighterService.colorEnabled = false;

    const highlighted = syntaxHighlighterService.highlight(
      "{ foo: 1 }",
      "json",
    );

    expect(highlighted).toEqual("{ foo: 1 }");
  });
});
