import { assertEquals } from "@std/assert";
import ShutdownServiceProvider from "../../../src/service/shutdown/ShutdownServiceProvider.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";

Deno.test("ShutdownServiceProvider provide works", async () => {
  const shutdownServiceProvider = new ShutdownServiceProvider(100);
  const serviceInfo = await shutdownServiceProvider.provide(getCLIConfig());
  assertEquals(serviceInfo.commands.length, 0);

  await ShutdownServiceProvider.shutdown();
});
