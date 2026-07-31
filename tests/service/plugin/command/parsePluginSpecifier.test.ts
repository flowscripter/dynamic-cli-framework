import { describe, expect, test } from "bun:test";
import { parsePluginSpecifier } from "../../../../src/service/plugin/command/parsePluginSpecifier.ts";

describe("parsePluginSpecifier", () => {
  test("returns pluginId with no version when no colon is present", () => {
    expect(parsePluginSpecifier("@scope/plugin")).toEqual({ pluginId: "@scope/plugin" });
  });

  test("returns pluginId with no version for an unscoped name", () => {
    expect(parsePluginSpecifier("plugin")).toEqual({ pluginId: "plugin" });
  });

  test("splits a scoped plugin specifier on the last colon", () => {
    expect(parsePluginSpecifier("@scope/plugin:3.0.0")).toEqual({
      pluginId: "@scope/plugin",
      version: "3.0.0",
    });
  });

  test("splits an unscoped plugin specifier on the last colon", () => {
    expect(parsePluginSpecifier("plugin:3.0.0")).toEqual({
      pluginId: "plugin",
      version: "3.0.0",
    });
  });

  test("treats a non-semver tail as the version, e.g. 'latest'", () => {
    expect(parsePluginSpecifier("@scope/plugin:latest")).toEqual({
      pluginId: "@scope/plugin",
      version: "latest",
    });
  });

  test("treats a non-semver tail as the version, e.g. 'next'", () => {
    expect(parsePluginSpecifier("@scope/plugin:next")).toEqual({
      pluginId: "@scope/plugin",
      version: "next",
    });
  });

  test("splits on the last colon only, not the first", () => {
    expect(parsePluginSpecifier("@scope/plugin:1.0.0:extra")).toEqual({
      pluginId: "@scope/plugin:1.0.0",
      version: "extra",
    });
  });
});
