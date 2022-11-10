import {
  assertEquals,
  Buffer,
  colors,
  describe,
  it,
} from "../../../test_deps.ts";

import Spinner from "../../../../src/service/core/util/Spinner.ts";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function expectBufferString(actual: Buffer, expected: string) {
  const decoder = new TextDecoder();
  assertEquals(colors.stripColor(decoder.decode(actual.bytes())), expected);
}

describe("Spinner", () => {
  it("Spinner works", async () => {
    const buffer = new Buffer();
    const spinner = new Spinner(buffer);

    await spinner.show();
    await sleep(250);
    await spinner.hide();

    expectBufferString(buffer, "\r⠋\r⠙\r");
  });

  it("Calling show and hide multiple times works", async () => {
    const spinner = new Spinner(Deno.stderr);

    await spinner.show();
    await sleep(50);
    await spinner.show();
    await sleep(50);
    await spinner.hide();
    await sleep(50);
    await spinner.hide();
  });

  it("Updating the spinner message works", async () => {
    const buffer = new Buffer();
    const spinner = new Spinner(buffer);

    await spinner.show();
    await sleep(150);
    await spinner.show("foo");
    await sleep(150);
    await spinner.show("bar");
    await sleep(150);
    await spinner.show();
    await sleep(150);
    await spinner.hide();

    expectBufferString(buffer, "\r⠋\r⠙ foo\r⠹ bar\r⠸ bar\r⠼\r");
  });
});
