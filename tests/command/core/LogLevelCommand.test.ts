import { assertEquals, Buffer, describe, it } from "../../test_deps.ts";
import { Level } from "../../../src/api/service/core/Printer.ts";
import DefaultContext from "../../../src/runtime/DefaultContext.ts";
import LogLevelCommand from "../../../src/command/core/LogLevelCommand.ts";
import PrinterService from "../../../src/service/core/PrinterService.ts";
import { LIFECYCLE_SERVICE_ID } from "../../../src/api/service/core/Lifecycle.ts";
import DefaultLifecycle from "../../../src/service/core/DefaultLifecycle.ts";
import { getCLIConfig } from "../../fixtures/CLIConfig.ts";

describe("LogLevelCommand", () => {
  it("LogLevelCommand works", async () => {
    const buffer = new Buffer();
    const printerService = new PrinterService(100, buffer, buffer);

    const context = new DefaultContext(getCLIConfig());

    const lifecycle = new DefaultLifecycle();

    context.addServiceInstance(LIFECYCLE_SERVICE_ID, lifecycle);

    await printerService.init(context);

    const logLevelCommand = new LogLevelCommand(printerService, 100);

    assertEquals(printerService.printer!.getLevel(), Level.INFO);

    await logLevelCommand.execute({ "level": "ERROR" }, context);

    assertEquals(printerService.printer!.getLevel(), Level.ERROR);

    DefaultLifecycle.shutdown();
  });
});
