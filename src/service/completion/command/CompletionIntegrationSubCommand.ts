import process from "node:process";
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
import { Icon, PRINTER_SERVICE_ID } from "../../../api/service/core/PrinterService.ts";
import type PrinterService from "../../../api/service/core/PrinterService.ts";

export class CompletionIntegrationSubCommand implements SubCommand {
  readonly name = "integration";
  readonly description = "Install shell completion integration";
  readonly enableConfiguration = false;

  readonly options: ReadonlyArray<Option> = [
    {
      name: "config-path",
      type: ArgumentValueTypeName.STRING,
      isOptional: true,
      description: "Path to shell configuration file",
    },
  ];

  readonly positionals: ReadonlyArray<Positional> = [
    {
      name: "shell",
      type: ArgumentValueTypeName.STRING,
      allowableValues: Object.values(ShellType),
      description: "Shell type to configure",
    },
  ];

  async execute(context: Context, argumentValues: ArgumentValues): Promise<void> {
    const completionService = context.getServiceById(
      COMPLETION_SERVICE_ID,
    ) as DefaultCompletionService;
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;

    const shellType = argumentValues.shell as ShellType;
    const configPathArg = argumentValues["config-path"] as string | undefined;

    const isValid = await completionService.validateShellEnvironment(shellType);
    if (!isValid) {
      await printerService.warn(
        `Shell '${shellType}' was not detected in the current environment. Proceeding anyway.\n`,
        Icon.ALERT,
      );
    }

    const configPath = configPathArg || completionService.getDefaultConfigPath(shellType);
    const cliName = context.cliConfig.name;
    const bootstrapScript = completionService.getBootstrapScript(
      shellType,
      cliName,
      process.execPath,
    );

    const beginMarker = `# BEGIN ${cliName} completion`;
    const endMarker = `# END ${cliName} completion`;
    const block = `${beginMarker}\n${bootstrapScript}\n${endMarker}`;

    let existingContent = "";
    try {
      existingContent = await Bun.file(configPath).text();
    } catch {
      // File doesn't exist yet
    }

    let newContent: string;
    const beginIdx = existingContent.indexOf(beginMarker);
    const endIdx = existingContent.indexOf(endMarker);
    if (beginIdx !== -1 && endIdx !== -1) {
      newContent =
        existingContent.substring(0, beginIdx) +
        block +
        existingContent.substring(endIdx + endMarker.length);
    } else {
      const separator =
        existingContent.length > 0 && !existingContent.endsWith("\n")
          ? "\n\n"
          : existingContent.length > 0
            ? "\n"
            : "";
      newContent = existingContent + separator + block + "\n";
    }

    await Bun.write(configPath, newContent);

    await printerService.info(
      `Shell completion installed for ${shellType}. Restart your shell or run 'source ${configPath}' to activate.\n`,
    );
  }
}
