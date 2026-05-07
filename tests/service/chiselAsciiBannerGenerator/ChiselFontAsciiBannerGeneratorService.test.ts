import { describe, expect, test } from "bun:test";
import ChiselFontAsciiBannerGeneratorService from "../../../src/service/chiselAsciiBannerGenerator/ChiselFontAsciiBannerGeneratorService.ts";

describe("ChiselFontAsciiBannerGeneratorService tests", () => {
  test("registerFont throws", () => {
    const service = new ChiselFontAsciiBannerGeneratorService();
    expect(() => service.registerFont("anything", "definition")).toThrow();
  });

  test("getRegisteredFonts returns chisel only", () => {
    const service = new ChiselFontAsciiBannerGeneratorService();
    expect(service.getRegisteredFonts()).toEqual(["chisel"]);
  });

  test("generate returns non-empty string with ANSI codes", async () => {
    const service = new ChiselFontAsciiBannerGeneratorService();
    const result = await service.generate("HI");
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("\x1b[");
  });

  test("custom chisel colors replace default ANSI codes", async () => {
    const service = new ChiselFontAsciiBannerGeneratorService();
    // Generate without custom colors to get baseline
    const baseline = await service.generate("HI");
    // Generate with custom colors
    const result = await service.generate("HI", {
      chiselColors: { shadowForeground: 33 },
    });
    // The result should differ from baseline (color replacement occurred)
    // shadowForeground maps \x1b[90m -> \x1b[33m
    expect(result).not.toContain("\x1b[90m");
    expect(result).toContain("\x1b[33m");
    expect(result).not.toEqual(baseline);
  });

  test("subMessage appears uppercased and double-spaced", async () => {
    const service = new ChiselFontAsciiBannerGeneratorService();
    const result = await service.generate("HI", { subMessage: "world" });
    expect(result).toContain("W O R L D");
  });

  test("fixed foreground color effect adds ANSI codes", async () => {
    const service = new ChiselFontAsciiBannerGeneratorService();
    const result = await service.generate("HI", {
      colorEffects: {
        messageForeground: { type: "fixed", color: "#00ff00" },
      },
    });
    expect(result).toContain("\x1b[38;2;");
  });
});
