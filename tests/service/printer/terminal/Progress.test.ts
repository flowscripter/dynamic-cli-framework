import { describe, test } from "bun:test";
import Progress from "../../../../src/service/printer/terminal/Progress.ts";
import { sleep } from "../../../fixtures/util.ts";
import TtyTerminal from "../../../../src/service/printer/terminal/TtyTerminal.ts";
import StreamString from "../../../fixtures/StreamString.ts";
import TtyStyler from "../../../../src/service/printer/terminal/TtyStyler.ts";

describe("Progress tests", () => {
  test("Progress works", async () => {
    const streamString = new StreamString();
    const terminal = new TtyTerminal(streamString.writeStream);
    const progress = new Progress(terminal, new TtyStyler(3));

    const handle = progress.add("foo", "bar", 100, 0);
    await sleep(150);
    progress.update(handle, 50, "bar2");
    await sleep(150);
    progress.update(handle, 150, "bar3");
    await sleep(150);
    await progress.hide(handle);
  });

  test("Multiple progress works", async () => {
    const streamString = new StreamString();
    const terminal = new TtyTerminal(streamString.writeStream);
    const progress = new Progress(terminal, new TtyStyler(3));

    const handle1 = progress.add("foo1", "bar2", 100, 0);
    const handle2 = progress.add("foo2", "bar2", 200, 0);
    await sleep(150);
    progress.update(handle1, 50, "bar3");
    await sleep(150);
    progress.update(handle2, 100, "bar4");
    await sleep(150);
    progress.update(handle1, 50, "bar3");
    progress.update(handle2, 200, "bar5 very long string now");
    await sleep(150);
    await progress.hideAll();
  });
});
