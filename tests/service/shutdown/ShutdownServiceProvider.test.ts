import { describe, expect, test } from "bun:test";
import ShutdownServiceProvider from "../../../src/service/shutdown/ShutdownServiceProvider.ts";
import DefaultShutdownService from "../../../src/service/shutdown/DefaultShutdownService.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";

describe("ShutdownServiceProvider tests", () => {
  test("ShutdownServiceProvider getServiceInfo works", async () => {
    const shutdownServiceProvider = new ShutdownServiceProvider(100);
    const serviceInfo = await shutdownServiceProvider.getServiceInfo(getCLIConfig());
    expect(serviceInfo.commands.length).toEqual(0);

    await ShutdownServiceProvider.shutdown();
  });

  test("DefaultShutdownService interrupt() invokes the interrupt handler", () => {
    let interrupts = 0;
    const shutdownService = new DefaultShutdownService(() => {
      interrupts++;
    });

    shutdownService.interrupt();

    expect(interrupts).toEqual(1);
  });

  test("DefaultShutdownService interrupt() without a handler does nothing", () => {
    expect(() => new DefaultShutdownService().interrupt()).not.toThrow();
  });
});
