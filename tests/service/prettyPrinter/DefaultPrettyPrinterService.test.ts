import { describe, expect, test } from "bun:test";
import DefaultPrettyPrinterService from "../../../src/service/prettyPrinter/DefaultPrettyPrinterService";
import FooSyntax from "../../fixtures/prettierPluginFoo";

describe("DefaultPrettyPrinterService tests", () => {
  test("JSON registered by default", async () => {
    const prettyPrinterService = new DefaultPrettyPrinterService();

    expect(await prettyPrinterService.getRegisteredSyntaxes()).toContain(
      "json",
    );
  });

  test("Cannot register a syntax if already registered", () => {
    const prettyPrinterService = new DefaultPrettyPrinterService();

    expect(prettyPrinterService.registerSyntax("jSon", FooSyntax)).rejects
      .toThrow();
  });

  test("Can register new syntax", async () => {
    const prettyPrinterService = new DefaultPrettyPrinterService();

    prettyPrinterService.registerSyntax("foo", FooSyntax);
    expect(await prettyPrinterService.getRegisteredSyntaxes()).toContain("foo");
  });

  test("Cannot pretty print with unknown syntax", () => {
    const prettyPrinterService = new DefaultPrettyPrinterService();

    expect(() => prettyPrinterService.prettify("foo: 1", "bar"))
      .toThrow();
  });

  test("Can pretty print with JSON syntax", async () => {
    const prettyPrinterService = new DefaultPrettyPrinterService();

    const prettified = await prettyPrinterService.prettify(
      "{foo:1}",
      "json",
    );
    expect(prettified).toEqual('{ "foo": 1 }\n');
  });

  test("Can pretty print with newly registered syntax", async () => {
    const prettyPrinterService = new DefaultPrettyPrinterService();

    prettyPrinterService.registerSyntax("foo", FooSyntax);

    const prettified = await prettyPrinterService.prettify("foo: 1", "foo");
    expect(prettified).toEqual("foo");
  });
});
