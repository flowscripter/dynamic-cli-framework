import { Buffer, describe, it } from "../../../test_deps.ts";

import Progress from "../../../../src/service/printer/terminal/Progress.ts";
import { sleep } from "../../../fixtures/util.ts";

describe("Progress", () => {
  it("Progress works", async () => {
    const buffer = new Buffer();
    const progress = new Progress(buffer);

    const handle = await progress.add("foo", "bar", 100, 0);
    await sleep(150);
    progress.update(handle, 50, "bar2");
    await sleep(150);
    progress.update(handle, 150, "bar3");
    await sleep(150);
    await progress.hide(handle);
  });

  it("Multiple progress works", async () => {
    const buffer = new Buffer();
    const progress = new Progress(buffer);

    const handle1 = await progress.add("foo1", "bar2", 100, 0);
    const handle2 = await progress.add("foo2", "bar2", 200, 0);
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
