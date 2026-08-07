import { describe, expect, test } from "bun:test";
import { parsePluginSpecifier } from "../../../../src/service/plugin/command/parsePluginSpecifier.ts";

describe("parsePluginSpecifier", () => {
  test("returns pluginId with no version when no @ version separator is present", () => {
    expect(parsePluginSpecifier("@scope/plugin")).toEqual({ pluginId: "@scope/plugin" });
  });

  test("returns pluginId with no version for an unscoped name", () => {
    expect(parsePluginSpecifier("plugin")).toEqual({ pluginId: "plugin" });
  });

  test("does not treat a colon as a version separator", () => {
    expect(parsePluginSpecifier("plugin:3.0.0")).toEqual({ pluginId: "plugin:3.0.0" });
  });

  test("splits a scoped plugin specifier on the npm-style @ separator", () => {
    expect(parsePluginSpecifier("@scope/plugin@1.0.0")).toEqual({
      pluginId: "@scope/plugin",
      version: "1.0.0",
    });
  });

  test("treats a dist-tag after the @ separator as the version, e.g. 'next'", () => {
    expect(parsePluginSpecifier("@scope/plugin@next")).toEqual({
      pluginId: "@scope/plugin",
      version: "next",
    });
  });

  test("splits an unscoped plugin specifier on the @ separator", () => {
    expect(parsePluginSpecifier("plugin@1.0.0")).toEqual({
      pluginId: "plugin",
      version: "1.0.0",
    });
  });

  test("does not treat the leading scope @ as a version separator when no version is given", () => {
    expect(parsePluginSpecifier("@scope/plugin")).toEqual({ pluginId: "@scope/plugin" });
  });
});
