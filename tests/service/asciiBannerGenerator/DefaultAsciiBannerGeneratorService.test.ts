import { describe, expect, test } from "bun:test";
import DefaultAsciiBannerGeneratorService from "../../../src/service/asciiBannerGenerator/DefaultAsciiBannerGeneratorService.ts";

// FIGlet font is converted to a JSON string and embedded in a simple JSON file: `{ "font": "<figlet font definition>" }`
import smallFont from "./small.flf.json" with { type: "json" };
describe("DefaultAsciiBannerGeneratorService Tests", () => {
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

  test("Cannot generate with unknown font", async () => {
    const asciiBannerGeneratorService =
      new DefaultAsciiBannerGeneratorService();

    await expect(asciiBannerGeneratorService.generate("foo", "small")).rejects
      .toThrow();
  });

  test("Can generate with standard font", async () => {
    const asciiBannerGeneratorService =
      new DefaultAsciiBannerGeneratorService();

    asciiBannerGeneratorService.registerFont("small", smallFont.font);

    const generated = await asciiBannerGeneratorService.generate(
      "foo",
      "standard",
    );
    expect(generated).toMatchSnapshot();
  });

  test("Can generate with newly registered font", async () => {
    const asciiBannerGeneratorService =
      new DefaultAsciiBannerGeneratorService();

    asciiBannerGeneratorService.registerFont("small", smallFont.font);

    const generated = await asciiBannerGeneratorService.generate(
      "foo",
      "small",
    );
    expect(generated).toMatchSnapshot();
  });
});
