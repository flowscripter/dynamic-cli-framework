import { describe, expect, test } from "bun:test";
import NoBannerCommand from "../../../../src/service/banner/command/NoBannerCommand.ts";
import DefaultContext from "../../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../../fixtures/CLIConfig.ts";
import BannerServiceProvider from "../../../../src/service/banner/BannerServiceProvider.ts";

describe("NoBannerCommand tests", () => {
  test("No banner works", async () => {
    const bannerServiceProvider = new BannerServiceProvider(100);
    const noBannerCommand = new NoBannerCommand(bannerServiceProvider, 110);

    expect(bannerServiceProvider.printBanner).toBeTrue();

    await noBannerCommand.execute(
      new DefaultContext(getCLIConfig()),
      true,
    );

    expect(bannerServiceProvider.printBanner).toBeFalse();
  });
});
