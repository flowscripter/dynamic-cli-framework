import { assertEquals, describe, it } from "../../test_deps.ts";
import ShutdownServiceProvider from "../../../src/service/shutdown/ShutdownServiceProvider.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";

describe("ShutdownServiceProvider", () => {
  it("ShutdownServiceProvider provide works", async () => {
    const shutdownServiceProvider = new ShutdownServiceProvider(100);
    const serviceInfo = await shutdownServiceProvider.provide(getCLIConfig());
    assertEquals(serviceInfo.commands.length, 0);

    ShutdownServiceProvider.shutdown();
  });
});
