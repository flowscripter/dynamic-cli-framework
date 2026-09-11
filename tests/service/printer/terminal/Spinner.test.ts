import { describe, expect, test } from "bun:test";
import Spinner, { SpinnerStyle } from "../../../../src/service/printer/terminal/Spinner.ts";
import { expectStringEquals, expectStringIncludes, sleep } from "../../../fixtures/util.ts";
import TtyTerminal from "../../../../src/terminal/TtyTerminal.ts";
import StreamString from "../../../fixtures/StreamString.ts";
import TtyStyler from "../../../../src/terminal/TtyStyler.ts";
import type Terminal from "../../../../src/terminal/Terminal.ts";

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("Spinner tests", () => {
  test("hiding before the show delay elapses renders nothing", async () => {
    const streamString = new StreamString();
    const terminal = new TtyTerminal(streamString.writeStream);
    const spinner = new Spinner(terminal, new TtyStyler(3));

    await spinner.show();
    await sleep(50);
    await spinner.hide();
    await sleep(100);

    expect(streamString.getString()).toBe("");
  });

  test("showing for longer than the show delay renders a frame", async () => {
    const streamString = new StreamString();
    const terminal = new TtyTerminal(streamString.writeStream);
    const spinner = new Spinner(terminal, new TtyStyler(3));

    await spinner.show();
    await sleep(250);
    await spinner.hide();

    expect(streamString.getString()).not.toBe("");
  });

  test("Spinner works", async () => {
    const streamString = new StreamString();
    const terminal = new TtyTerminal(streamString.writeStream);
    const spinner = new Spinner(terminal, new TtyStyler(3));

    await spinner.show();
    await sleep(350);
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
    await sleep(350);
    await spinner.hide();

    expectStringEquals(streamString.getString(), "★✶");
  });

  test("Changing spinner style resets to new frames", async () => {
    const streamString = new StreamString();
    const terminal = new TtyTerminal(streamString.writeStream);
    const spinner = new Spinner(terminal, new TtyStyler(3));

    spinner.spinnerStyle = SpinnerStyle.STAR;
    await spinner.show();
    await sleep(250);
    await spinner.hide();

    const starOutput = streamString.getString();
    expectStringIncludes(starOutput, "★");
  });

  test("pause() waits for an in-flight render tick before clearing the line", async () => {
    const calls: string[] = [];
    const clearLineGate = deferred<void>();
    let tickCount = 0;
    const terminal: Terminal = {
      clearLine: () => {
        calls.push("clearLine");
        // Only the very first tick's clearLine() is held back - everything else (including
        // pause()'s own clearLine()) resolves immediately.
        tickCount += 1;
        return tickCount === 1 ? clearLineGate.promise : Promise.resolve();
      },
      clearUpLines: () => Promise.resolve(),
      hideCursor: () => Promise.resolve(),
      showCursor: () => Promise.resolve(),
      write: () => {
        calls.push("write");
        return Promise.resolve();
      },
      columns: () => 80,
      rows: () => 24,
      isTty: () => true,
    };
    const spinner = new Spinner(terminal, new TtyStyler(3));

    await spinner.show();
    // Let the show delay elapse, the first tick fire, and reach (and block on) its clearLine() call.
    await sleep(220);
    expect(calls).toEqual(["clearLine"]);

    const pausePromise = spinner.pause();
    // pause() must not resolve while the tick it's racing against is still mid-flight.
    await sleep(50);
    expect(calls).toEqual(["clearLine"]);

    clearLineGate.resolve();
    await pausePromise;

    // The tick's write() must land before pause()'s own clearLine() - not after.
    expect(calls).toEqual(["clearLine", "write", "clearLine"]);
  });

  test("Default spinner style is BOX", async () => {
    const streamString = new StreamString();
    const terminal = new TtyTerminal(streamString.writeStream);
    const spinner = new Spinner(terminal, new TtyStyler(3));

    await spinner.show();
    await sleep(350);
    await spinner.hide();

    expectStringEquals(streamString.getString(), "⠋⠙");
  });
});
