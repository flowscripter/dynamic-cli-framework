import { assertEquals, describe, it } from "../../../test_deps.ts";
import NoBannerCommand from "../../../../src/service/banner/command/NoBannerCommand.ts";
import DefaultContext from "../../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../../fixtures/CLIConfig.ts";
import BannerServiceProvider from "../../../../src/service/banner/BannerServiceProvider.ts";

describe("NoBannerCommand", () => {
  it("No banner works", async () => {
    const bannerServiceProvider = new BannerServiceProvider(100);
    const noBannerCommand = new NoBannerCommand(bannerServiceProvider, 110);

    assertEquals(bannerServiceProvider.printBanner, true);

    await noBannerCommand.execute(
      new DefaultContext(getCLIConfig()),
      true,
    );

    assertEquals(bannerServiceProvider.printBanner, false);
  });
});
