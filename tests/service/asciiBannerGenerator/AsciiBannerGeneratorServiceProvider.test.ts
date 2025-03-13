import { describe, expect, test } from "bun:test";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";
import AsciiBannerGeneratorServiceProvider from "../../../src/service/asciiBannerGenerator/AsciiBannerGeneratorServiceProvider.ts";

describe("AsciiBannerGeneratorServiceProvider tests", () => {
  test("AsciiBannerGeneratorServiceProvider provide and initService works", async () => {
    const asciiBannerGeneratorServiceProvider =
      new AsciiBannerGeneratorServiceProvider(
        100,
      );
    const cliConfig = getCLIConfig();
    const context = new DefaultContext(cliConfig);

    const serviceInfo = await asciiBannerGeneratorServiceProvider.provide(
      cliConfig,
    );
    expect(serviceInfo.commands.length).toEqual(0);

    await asciiBannerGeneratorServiceProvider.initService(context);
  });
});
