import Service, { ServiceInstance } from "../../api/service/Service.ts";
import Printer, { PRINTER_SERVICE_ID } from "../../api/service/core/Printer.ts";
import Command from "../../api/command/Command.ts";
import DefaultPrinter from "./DefaultPrinter.ts";
import NoColorCommand from "../../command/core/NoColorCommand.ts";
import DarkModeCommand from "../../command/core/DarkModeCommand.ts";
import Lifecycle, {
  LIFECYCLE_SERVICE_ID,
} from "../../api/service/core/Lifecycle.ts";
import Context from "../../api/runtime/Context.ts";
import LogLevelCommand from "../../command/core/LogLevelCommand.ts";

/**
 * Exposes a {@link Printer} instance as a {@link Service}.
 */
export default class PrinterService implements Service {
  readonly initPriority: number;
  readonly stdoutWriter: Deno.Writer;
  readonly stderrWriter: Deno.Writer;
  printer?: Printer;

  /**
   * Create an instance of the service with the specified details.
   *
   * @param initPriority the priority of the service.
   * @param stdoutWriter the Writer to use for stdout output.
   * @param stderrWriter the Writer to use for stderr output.
   */
  public constructor(
    initPriority: number,
    stdoutWriter: Deno.Writer,
    stderrWriter: Deno.Writer,
  ) {
    this.initPriority = initPriority;
    this.stdoutWriter = stdoutWriter;
    this.stderrWriter = stderrWriter;
  }

  public init(context: Context): Promise<{
    readonly serviceInstances: ReadonlyArray<ServiceInstance>;
    readonly commands: ReadonlyArray<Command>;
  }> {
    const lifecycle = context.getServiceById(LIFECYCLE_SERVICE_ID) as Lifecycle;
    this.printer = new DefaultPrinter(
      this.stdoutWriter,
      this.stderrWriter,
      lifecycle,
    );
    const serviceInstances: Array<ServiceInstance> = [
      {
        serviceId: PRINTER_SERVICE_ID,
        instance: this.printer,
      },
    ];

    return Promise.resolve({
      serviceInstances,
      commands: [
        new DarkModeCommand(this, this.initPriority + 2),
        new NoColorCommand(this, this.initPriority + 1),
        new LogLevelCommand(this, this.initPriority),
      ],
    });
  }
}
