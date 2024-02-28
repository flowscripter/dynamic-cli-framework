import { assertEquals } from "../../test_deps.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";
import AsciiBannerGeneratorServiceProvider from "../../../src/service/asciiBannerGenerator/AsciiBannerGeneratorServiceProvider.ts";

Deno.test("AsciiBannerGeneratorServiceProvider provide and initService works", async () => {
  const asciiBannerGeneratorServiceProvider =
    new AsciiBannerGeneratorServiceProvider(
      100,
    );
  const cliConfig = getCLIConfig();
  const context = new DefaultContext(cliConfig);

  const serviceInfo = await asciiBannerGeneratorServiceProvider.provide(
    cliConfig,
  );
  assertEquals(serviceInfo.commands.length, 0);

  await asciiBannerGeneratorServiceProvider.initService(context);
});
