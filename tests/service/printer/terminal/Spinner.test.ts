import { describe, test } from "bun:test";
import Spinner from "../../../../src/service/printer/terminal/Spinner.ts";
import { expectStringEquals, sleep } from "../../../fixtures/util.ts";
import TtyTerminal from "../../../../src/service/printer/terminal/TtyTerminal.ts";
import StreamString from "../../../fixtures/StreamString.ts";
import TtyStyler from "../../../../src/service/printer/terminal/TtyStyler.ts";

describe("Spinner Tests", () => {
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

    expectStringEquals(streamString.getString(), "⠋⠙ foo⠹ bar⠸⠼");
  });
});
