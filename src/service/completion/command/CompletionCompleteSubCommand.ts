import type SubCommand from "../../../api/command/SubCommand.ts";
import type Option from "../../../api/argument/Option.ts";
import type Positional from "../../../api/argument/Positional.ts";
import type Context from "../../../api/Context.ts";
import {
  type ArgumentValues,
  ArgumentValueTypeName,
} from "../../../api/argument/ArgumentValueTypes.ts";
import { COMPLETION_SERVICE_ID, ShellType } from "../../../api/service/core/CompletionService.ts";
import type DefaultCompletionService from "../DefaultCompletionService.ts";
import { PRINTER_SERVICE_ID } from "../../../api/service/core/PrinterService.ts";
import type PrinterService from "../../../api/service/core/PrinterService.ts";

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
