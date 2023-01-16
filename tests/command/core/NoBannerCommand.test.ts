import { assertEquals, describe, it } from "../../test_deps.ts";
import NoBannerCommand from "../../../src/command/core/NoBannerCommand.ts";
import BannerCommand from "../../../src/command/core/BannerCommand.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";

describe("NoBannerCommand", () => {
  it("No banner works", async () => {
    const bannerCommand = new BannerCommand(100);
    const noBannerCommand = new NoBannerCommand(bannerCommand, 110);

    assertEquals(bannerCommand.printBanner, true);

    await noBannerCommand.execute(
      { "no-banner": true },
      new DefaultContext(getCLIConfig()),
    );

    assertEquals(bannerCommand.printBanner, false);
  });
});
