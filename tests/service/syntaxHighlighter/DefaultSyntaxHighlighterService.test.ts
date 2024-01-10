import {
  assertEquals,
  assertThrows,
  describe,
  it,
  yamlSyntaxDefinition,
} from "../../test_deps.ts";
import DefaultSyntaxHighlighterService from "../../../src/service/syntaxHighlighter/DefaultSyntaxHighlighterService.ts";

describe("DefaultSyntaxHighlighterService", () => {
  it("JSON registered by default", () => {
    const syntaxHighlighterService = new DefaultSyntaxHighlighterService();

    assertEquals(syntaxHighlighterService.getRegisteredSyntaxes(), ["json"]);
  });

  it("Cannot register a syntax if already registered", () => {
    const syntaxHighlighterService = new DefaultSyntaxHighlighterService();

    assertThrows(() =>
      syntaxHighlighterService.registerSyntax("jSon", yamlSyntaxDefinition)
    );
  });

  it("Can register new syntax", () => {
    const syntaxHighlighterService = new DefaultSyntaxHighlighterService();

    syntaxHighlighterService.registerSyntax("yaml", yamlSyntaxDefinition);
    assertEquals(syntaxHighlighterService.getRegisteredSyntaxes(), [
      "json",
      "yaml",
    ]);
  });

  it("Cannot highlight with unknown syntax", () => {
    const syntaxHighlighterService = new DefaultSyntaxHighlighterService();

    assertThrows(() => syntaxHighlighterService.highlight("foo: 1", "yaml"));
  });

  it("Can highlight with JSON syntax", () => {
    const syntaxHighlighterService = new DefaultSyntaxHighlighterService();

    syntaxHighlighterService.registerSyntax("yaml", yamlSyntaxDefinition);

    const highlighted = syntaxHighlighterService.highlight(
      "{ foo: 1 }",
      "json",
    );
    assertEquals(highlighted, "{ foo: 1 }");
  });

  it("Can highlight with newly registered syntax", () => {
    const syntaxHighlighterService = new DefaultSyntaxHighlighterService();

    syntaxHighlighterService.registerSyntax("yaml", yamlSyntaxDefinition);

    const highlighted = syntaxHighlighterService.highlight("foo: 1", "yaml");
    assertEquals(highlighted, "{ foo: 1 }");
  });

  it("Skipped if color disabled", () => {
    const syntaxHighlighterService = new DefaultSyntaxHighlighterService();
    syntaxHighlighterService.colorEnabled = false;

    const highlighted = syntaxHighlighterService.highlight(
      "{ foo: 1 }",
      "json",
    );

    assertEquals(highlighted, "{ foo: 1 }");
  });
});
