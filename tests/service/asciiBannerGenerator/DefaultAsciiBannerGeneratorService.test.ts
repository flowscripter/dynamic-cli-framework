import { assertEquals, assertThrows, describe, it } from "../../test_deps.ts";
import DefaultAsciiBannerGeneratorService from "../../../src/service/asciiBannerGenerator/DefaultAsciiBannerGeneratorService.ts";

// FIGlet font is converted to a JSON string and embedded in a simple JSON file: `{ "font": "<figlet font definition>" }`
import { font as smallFont } from "./small.flf.json" assert { type: "json" };

describe("DefaultAsciiBannerGeneratorService", () => {
  it("standard font registered by default", () => {
    const asciiBannerGeneratorService =
      new DefaultAsciiBannerGeneratorService();

    assertEquals(asciiBannerGeneratorService.getRegisteredFonts(), [
      "standard",
    ]);
  });

  it("Cannot register a font if already registered", () => {
    const asciiBannerGeneratorService =
      new DefaultAsciiBannerGeneratorService();

    assertThrows(() =>
      asciiBannerGeneratorService.registerFont("standard", smallFont)
    );
  });

  it("Can register new font", () => {
    const asciiBannerGeneratorService =
      new DefaultAsciiBannerGeneratorService();

    asciiBannerGeneratorService.registerFont("small", smallFont);
    assertEquals(asciiBannerGeneratorService.getRegisteredFonts(), [
      "standard",
      "small",
    ]);
  });

  it("Cannot generate with unknown font", () => {
    const asciiBannerGeneratorService =
      new DefaultAsciiBannerGeneratorService();

    assertThrows(() => asciiBannerGeneratorService.generate("foo", "small"));
  });

  it("Can generate with standard font", async () => {
    const asciiBannerGeneratorService =
      new DefaultAsciiBannerGeneratorService();

    asciiBannerGeneratorService.registerFont("small", smallFont);

    const generated = await asciiBannerGeneratorService.generate(
      "foo",
      "standard",
    );
    assertEquals(
      generated,
      "  _____    ___     ___  \n" +
        " |  ___|  / _ \\   / _ \\ \n" +
        " | |_    | | | | | | | |\n" +
        " |  _|   | |_| | | |_| |\n" +
        " |_|      \\___/   \\___/ \n",
    );
  });

  it("Can generate with newly registered font", async () => {
    const asciiBannerGeneratorService =
      new DefaultAsciiBannerGeneratorService();

    asciiBannerGeneratorService.registerFont("small", smallFont);

    const generated = await asciiBannerGeneratorService.generate(
      "foo",
      "small",
    );
    assertEquals(
      generated,
      "  _____    ___     ___  \n" +
        " |  ___|  / _ \\   / _ \\ \n" +
        " | |_    | | | | | | | |\n" +
        " |  _|   | |_| | | |_| |\n" +
        " |_|      \\___/   \\___/ \n",
    );
  });
});
