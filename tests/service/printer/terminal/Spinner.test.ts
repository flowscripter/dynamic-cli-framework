import { describe, test } from "bun:test";
import Spinner, {
  SpinnerStyle,
} from "../../../../src/service/printer/terminal/Spinner.ts";
import {
  expectStringEquals,
  expectStringIncludes,
  sleep,
} from "../../../fixtures/util.ts";
import TtyTerminal from "../../../../src/terminal/TtyTerminal.ts";
import StreamString from "../../../fixtures/StreamString.ts";
import TtyStyler from "../../../../src/terminal/TtyStyler.ts";

describe("Spinner tests", () => {
  test("Spinner works", async () => {
    const streamString = new StreamString();
    const terminal = new TtyTerminal(streamString.writeStream);
    const spinner = new Spinner(terminal, new TtyStyler(3));

    await spinner.show();
    await sleep(250);
    await spinner.hide();

    expectStringEquals(streamString.getString(), "⠋⠙");
  });

  test("Calling show and hide multiple times works", async () => {
    const streamString = new StreamString();
    const terminal = new TtyTerminal(streamString.writeStream);
    const spinner = new Spinner(terminal, new TtyStyler(3));

    await spinner.show();
    await sleep(50);
    await spinner.show();
    await sleep(50);
    await spinner.hide();
    await sleep(50);
    await spinner.hide();
  });

  test("Updating the spinner message works", async () => {
    const streamString = new StreamString();
    const terminal = new TtyTerminal(streamString.writeStream);
    const spinner = new Spinner(terminal, new TtyStyler(3));

    await spinner.show();
    await sleep(150);
    await spinner.show("foo");
    await sleep(120);
    await spinner.show("bar");
    await sleep(120);
    await spinner.show();
    await sleep(120);
    await spinner.hide();

    expectStringIncludes(streamString.getString(), "foo");
    expectStringIncludes(streamString.getString(), "bar");
  });

  test("Star spinner style works", async () => {
    const streamString = new StreamString();
    const terminal = new TtyTerminal(streamString.writeStream);
    const spinner = new Spinner(terminal, new TtyStyler(3));

    spinner.spinnerStyle = SpinnerStyle.STAR;
    await spinner.show();
    await sleep(250);
    await spinner.hide();

    expectStringEquals(streamString.getString(), "★✶");
  });

  test("Changing spinner style resets to new frames", async () => {
    const streamString = new StreamString();
    const terminal = new TtyTerminal(streamString.writeStream);
    const spinner = new Spinner(terminal, new TtyStyler(3));

    spinner.spinnerStyle = SpinnerStyle.STAR;
    await spinner.show();
    await sleep(150);
    await spinner.hide();

    const starOutput = streamString.getString();
    expectStringIncludes(starOutput, "★");
  });

  test("Default spinner style is BOX", async () => {
    const streamString = new StreamString();
    const terminal = new TtyTerminal(streamString.writeStream);
    const spinner = new Spinner(terminal, new TtyStyler(3));

    await spinner.show();
    await sleep(250);
    await spinner.hide();

    expectStringEquals(streamString.getString(), "⠋⠙");
  });
});
