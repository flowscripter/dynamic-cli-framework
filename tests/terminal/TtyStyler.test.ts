import { describe, expect, test } from "bun:test";
import TtyStyler from "../../src/terminal/TtyStyler.ts";

describe("TtyStyler tests", () => {
  test("colorLevel 0 returns plain text from colorText", () => {
    const styler = new TtyStyler(0);
    styler.colorEnabled = true;

    expect(styler.colorText("hello", 0x268bd2)).toEqual("hello");
  });

  test("colorLevel 0 returns plain text from backgroundColorText", () => {
    const styler = new TtyStyler(0);
    styler.colorEnabled = true;

    expect(styler.backgroundColorText("hello", 0x268bd2)).toEqual("hello");
  });

  test("colorLevel 3 still colors text when colorLevel 0 is not set", () => {
    const styler = new TtyStyler(3);
    styler.colorEnabled = true;

    expect(styler.colorText("hello", 0x268bd2)).not.toEqual("hello");
  });

  test("colorLevel 0 returns plain text from italicText", () => {
    const styler = new TtyStyler(0);
    styler.colorEnabled = true;

    expect(styler.italicText("hello")).toEqual("hello");
  });

  test("colorEnabled false returns plain text from italicText", () => {
    const styler = new TtyStyler(3);
    styler.colorEnabled = false;

    expect(styler.italicText("hello")).toEqual("hello");
  });

  test("colorLevel 3 still italicizes text when colorEnabled", () => {
    const styler = new TtyStyler(3);
    styler.colorEnabled = true;

    expect(styler.italicText("hello")).not.toEqual("hello");
  });
});
