import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { assertSnapshot } from "@std/testing/snapshot";
import DefaultAsciiBannerGeneratorService from "../../../src/service/asciiBannerGenerator/DefaultAsciiBannerGeneratorService.ts";

// FIGlet font is converted to a JSON string and embedded in a simple JSON file: `{ "font": "<figlet font definition>" }`
import smallFont from "./small.flf.json" with { type: "json" };

Deno.test("standard font registered by default", () => {
  const asciiBannerGeneratorService = new DefaultAsciiBannerGeneratorService();

  assertEquals(asciiBannerGeneratorService.getRegisteredFonts(), [
    "standard",
  ]);
});

Deno.test("Cannot register a font if already registered", () => {
  const asciiBannerGeneratorService = new DefaultAsciiBannerGeneratorService();

  assertThrows(() =>
    asciiBannerGeneratorService.registerFont("standard", smallFont.font)
  );
});

Deno.test("Can register new font", () => {
  const asciiBannerGeneratorService = new DefaultAsciiBannerGeneratorService();

  asciiBannerGeneratorService.registerFont("small", smallFont.font);
  assertEquals(asciiBannerGeneratorService.getRegisteredFonts(), [
    "standard",
    "small",
  ]);
});

Deno.test("Cannot generate with unknown font", async () => {
  const asciiBannerGeneratorService = new DefaultAsciiBannerGeneratorService();

  await assertRejects(() =>
    asciiBannerGeneratorService.generate("foo", "small")
  );
});

Deno.test("Can generate with standard font", async (t) => {
  const asciiBannerGeneratorService = new DefaultAsciiBannerGeneratorService();

  asciiBannerGeneratorService.registerFont("small", smallFont.font);

  const generated = await asciiBannerGeneratorService.generate(
    "foo",
    "standard",
  );
  await assertSnapshot(t, generated);
});

Deno.test("Can generate with newly registered font", async (t) => {
  const asciiBannerGeneratorService = new DefaultAsciiBannerGeneratorService();

  asciiBannerGeneratorService.registerFont("small", smallFont.font);

  const generated = await asciiBannerGeneratorService.generate(
    "foo",
    "small",
  );
  await assertSnapshot(t, generated);
});
