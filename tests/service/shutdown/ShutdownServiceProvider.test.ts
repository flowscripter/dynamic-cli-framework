import { describe, expect, test } from "bun:test";
import ShutdownServiceProvider from "../../../src/service/shutdown/ShutdownServiceProvider.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";

describe("ShutdownServiceProvider Tests", () => {
  test("ShutdownServiceProvider provide works", async () => {
    const shutdownServiceProvider = new ShutdownServiceProvider(100);
    const serviceInfo = await shutdownServiceProvider.provide(getCLIConfig());
    expect(serviceInfo.commands.length).toEqual(0);

    await ShutdownServiceProvider.shutdown();
  });
});
