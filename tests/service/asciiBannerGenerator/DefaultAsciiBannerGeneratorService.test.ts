import { describe, expect, test } from "bun:test";
import DefaultAsciiBannerGeneratorService from "../../../src/service/asciiBannerGenerator/DefaultAsciiBannerGeneratorService.ts";

// FIGlet font is converted to a JSON string and embedded in a simple JSON file: `{ "font": "<figlet font definition>" }`
import smallFont from "./small.flf.json" with { type: "json" };
describe("DefaultAsciiBannerGeneratorService tests", () => {
  test("standard font registered by default", () => {
    const asciiBannerGeneratorService =
      new DefaultAsciiBannerGeneratorService();

    expect(asciiBannerGeneratorService.getRegisteredFonts()).toEqual([
      "standard",
    ]);
  });

  test("Cannot register a font if already registered", () => {
    const asciiBannerGeneratorService =
      new DefaultAsciiBannerGeneratorService();

    expect(() =>
      asciiBannerGeneratorService.registerFont("standard", smallFont.font)
    )
      .toThrow();
  });

  test("Can register new font", () => {
    const asciiBannerGeneratorService =
      new DefaultAsciiBannerGeneratorService();

    asciiBannerGeneratorService.registerFont("small", smallFont.font);
    expect(asciiBannerGeneratorService.getRegisteredFonts()).toEqual([
      "standard",
      "small",
    ]);
  });

  test("Cannot generate with unknown font", () => {
    const asciiBannerGeneratorService =
      new DefaultAsciiBannerGeneratorService();

    expect(asciiBannerGeneratorService.generate("foo", { fontName: "small" }))
      .rejects
      .toThrow();
  });

  test("Can generate with standard font", async () => {
    const asciiBannerGeneratorService =
      new DefaultAsciiBannerGeneratorService();

    asciiBannerGeneratorService.registerFont("small", smallFont.font);

    const generated = await asciiBannerGeneratorService.generate(
      "foo",
      { fontName: "standard" },
    );
    expect(generated).toMatchSnapshot();
  });

  test("Can generate with newly registered font", async () => {
    const asciiBannerGeneratorService =
      new DefaultAsciiBannerGeneratorService();

    asciiBannerGeneratorService.registerFont("small", smallFont.font);

    const generated = await asciiBannerGeneratorService.generate(
      "foo",
      { fontName: "small" },
    );
    expect(generated).toMatchSnapshot();
  });

  test("subMessage is uppercased and double-spaced", async () => {
    const service = new DefaultAsciiBannerGeneratorService();
    const result = await service.generate("foo", {
      fontName: "standard",
      subMessage: "hello",
    });
    expect(result).toContain("H E L L O");
  });

  test("fixed foreground color effect adds ANSI codes to title chars", async () => {
    const service = new DefaultAsciiBannerGeneratorService();
    const result = await service.generate("foo", {
      fontName: "standard",
      colorEffects: {
        messageForeground: { type: "fixed", color: "#ff0000" },
      },
    });
    expect(result).toContain("\x1b[38;2;");
    expect(result).toContain("\x1b[39m");
  });

  test("background color effect adds background ANSI codes", async () => {
    const service = new DefaultAsciiBannerGeneratorService();
    const result = await service.generate("foo", {
      fontName: "standard",
      colorEffects: {
        background: { type: "fixed", color: "#0000ff" },
      },
    });
    expect(result).toContain("\x1b[48;2;");
    expect(result).toContain("\x1b[49m");
  });

  test("no ANSI codes when no color effects specified", async () => {
    const service = new DefaultAsciiBannerGeneratorService();
    const result = await service.generate("foo", { fontName: "standard" });
    expect(result).not.toContain("\x1b[");
  });

  test("subMessage narrower than banner is padded to center", async () => {
    const service = new DefaultAsciiBannerGeneratorService();
    const result = await service.generate("foo", {
      fontName: "standard",
      subMessage: "hi",
    });
    const lines = result.trim().split("\n");
    const subLine = lines[lines.length - 1]!;
    expect(subLine.startsWith(" ")).toBe(true);
  });

  test("subMessage wider than banner pads title lines", async () => {
    const service = new DefaultAsciiBannerGeneratorService();
    const withoutSub = await service.generate("i", { fontName: "standard" });
    const withSub = await service.generate("i", {
      fontName: "standard",
      subMessage: "x".repeat(40),
    });
    const withoutLines = withoutSub.trim().split("\n");
    const withLines = withSub.trim().split("\n").slice(0, withoutLines.length);
    const maxWith = Math.max(...withLines.map((l) => l.length));
    const maxWithout = Math.max(...withoutLines.map((l) => l.length));
    expect(maxWith).toBeGreaterThan(maxWithout);
  });

  test("gradient vertical applies different color per line", async () => {
    const service = new DefaultAsciiBannerGeneratorService();
    const result = await service.generate("foo", {
      fontName: "standard",
      colorEffects: {
        messageForeground: {
          type: "gradient",
          colors: ["#ff0000", "#0000ff"],
          direction: "vertical",
        },
      },
    });
    const lines = result.trim().split("\n").filter((l) =>
      l.includes("\x1b[38;2;")
    );
    const firstCodes = lines.map((l) =>
      l.match(/\x1b\[38;2;(\d+;\d+;\d+)m/)?.[1]
    );
    const unique = new Set(firstCodes.filter(Boolean));
    expect(unique.size).toBeGreaterThan(1);
  });

  test("gradient horizontal applies different color per char within a line", async () => {
    const service = new DefaultAsciiBannerGeneratorService();
    const result = await service.generate("foo", {
      fontName: "standard",
      colorEffects: {
        messageForeground: {
          type: "gradient",
          colors: ["#ff0000", "#0000ff"],
          direction: "horizontal",
        },
      },
    });
    const lines = result.trim().split("\n").filter((l) =>
      l.includes("\x1b[38;2;")
    );
    const firstLine = lines[0]!;
    const codes = [...firstLine.matchAll(/\x1b\[38;2;(\d+;\d+;\d+)m/g)].map((
      m,
    ) => m[1]);
    const unique = new Set(codes);
    expect(unique.size).toBeGreaterThan(1);
  });

  test("rainbow horizontal applies ANSI codes varying per char", async () => {
    const service = new DefaultAsciiBannerGeneratorService();
    const result = await service.generate("foo", {
      fontName: "standard",
      colorEffects: {
        messageForeground: {
          type: "rainbow",
          direction: "horizontal",
          seed: 0.1,
        },
      },
    });
    expect(result).toContain("\x1b[38;2;");
    const lines = result.trim().split("\n").filter((l) =>
      l.includes("\x1b[38;2;")
    );
    const firstLine = lines[0]!;
    const codes = [...firstLine.matchAll(/\x1b\[38;2;(\d+;\d+;\d+)m/g)].map((
      m,
    ) => m[1]);
    const unique = new Set(codes);
    expect(unique.size).toBeGreaterThan(1);
  });

  test("rainbow vertical applies ANSI codes varying per line", async () => {
    const service = new DefaultAsciiBannerGeneratorService();
    const result = await service.generate("foo", {
      fontName: "standard",
      colorEffects: {
        messageForeground: {
          type: "rainbow",
          direction: "vertical",
          seed: 0.1,
        },
      },
    });
    const lines = result.trim().split("\n").filter((l) =>
      l.includes("\x1b[38;2;")
    );
    const firstCodes = lines.map((l) =>
      l.match(/\x1b\[38;2;(\d+;\d+;\d+)m/)?.[1]
    );
    const unique = new Set(firstCodes.filter(Boolean));
    expect(unique.size).toBeGreaterThan(1);
  });
});
