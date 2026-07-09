import type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { Option } from "@flowscripter/dynamic-cli-framework-api";
import type { Positional } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import {
  type ArgumentValues,
  ArgumentValueTypeName,
} from "@flowscripter/dynamic-cli-framework-api";
import { COMPLETION_SERVICE_ID, ShellType } from "@flowscripter/dynamic-cli-framework-api";
import type DefaultCompletionService from "../DefaultCompletionService.ts";
import { PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";

export class CompletionCompleteSubCommand implements SubCommand {
  readonly name = "complete";
  readonly description = "Generate completions for shell integration";
  readonly enableConfiguration = false;
  readonly disableGenericHelpDisplay = true;

  readonly options: ReadonlyArray<Option> = [];

  readonly positionals: ReadonlyArray<Positional> = [
    {
      name: "shell",
      type: ArgumentValueTypeName.STRING,
      allowableValues: Object.values(ShellType),
      description: "Shell type",
    },
    {
      name: "args",
      type: ArgumentValueTypeName.STRING,
      isVarargMultiple: true,
      isVarargOptional: true,
      description: "Shell-specific completion context arguments",
    },
  ];

  async execute(context: Context, argumentValues: ArgumentValues): Promise<void> {
    const completionService = context.getServiceById(
      COMPLETION_SERVICE_ID,
    ) as DefaultCompletionService;
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;

    const shellType = argumentValues.shell as ShellType;
    const args = (argumentValues.args || []) as string[];

    const completionContext = completionService.parseCompletionContext(shellType, args);
    const completions = await completionService.generateCompletions(
      shellType,
      completionContext.line,
      completionContext.cursorPosition,
    );

    const output = completionService.formatCompletions(shellType, completions);
    if (output.length > 0) {
      await printerService.print(output + "\n");
    }
  }
}
