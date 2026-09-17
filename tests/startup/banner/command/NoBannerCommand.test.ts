import { describe, expect, test } from "bun:test";
import NoBannerCommand, {
  type BannerState,
} from "../../../../src/startup/banner/command/NoBannerCommand.ts";
import DefaultContext from "../../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../../fixtures/CLIConfig.ts";

describe("NoBannerCommand tests", () => {
  test("No banner works", async () => {
    const state: BannerState = { printBanner: true };
    const noBannerCommand = new NoBannerCommand(state, 110);

    expect(state.printBanner).toBeTrue();

    await noBannerCommand.execute(new DefaultContext(getCLIConfig()), true);

    expect(state.printBanner).toBeFalse();
  });
});
