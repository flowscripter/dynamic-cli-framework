import { Buffer, describe, it } from "../../../test_deps.ts";

import Spinner from "../../../../src/service/printer/terminal/Spinner.ts";
import { expectBufferStringEquals, sleep } from "../../../fixtures/util.ts";

describe("Spinner", () => {
  it("Spinner works", async () => {
    const buffer = new Buffer();
    const spinner = new Spinner(buffer);

    await spinner.show();
    await sleep(250);
    await spinner.hide();

    expectBufferStringEquals(buffer, "⠋⠙");
  });

  it("Calling show and hide multiple times works", async () => {
    const buffer = new Buffer();
    const spinner = new Spinner(buffer);

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

    expectBufferStringEquals(buffer, "⠋⠙ foo⠹ bar⠸ bar⠼");
  });
});
