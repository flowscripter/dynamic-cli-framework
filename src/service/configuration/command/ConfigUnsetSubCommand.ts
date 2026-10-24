import {
  ARGUMENT_PROMPTER_SERVICE_ID,
  PRINTER_SERVICE_ID,
  ValueTypeName,
  type ArgumentPrompterService,
  type Context,
  type Option,
  type Positional,
  type PrinterService,
  type SubCommand,
  type Values,
} from "@flowscripter/dynamic-cli-framework-api";
import type DefaultConfigurationService from "../DefaultConfigurationService.ts";
import { removeAtPath, resolveOptionPath } from "../configTargets.ts";

type Raw = Record<string, unknown>;

/**
 * Member of the `config` group which removes a stored default value (and any OS secret it refers to).
 */
export default class ConfigUnsetSubCommand implements SubCommand {
  readonly name = "unset";
  readonly description = "Remove a default value for an option of a command";
  readonly options: ReadonlyArray<Option> = [
    {
      name: "command",
      type: ValueTypeName.STRING,
      description: "The command (or <group>:<member>) to remove defaults from",
      isOptional: true,
      validate: (value) => {
        const targets = this.#configurationService.getConfigTargets();
        return targets.has(value as string) ||
          this.#configurationService.defaultsData.has(value as string)
          ? undefined
          : `unknown command, valid commands: ${[...targets.keys()].join(", ")}`;
      },
    },
    {
      name: "option",
      type: ValueTypeName.STRING,
      description:
        "The option (or option path) to remove. Omit to remove all defaults of the command.",
      isOptional: true,
      validate: (value, ctx) => {
        const target = this.#configurationService
          .getConfigTargets()
          .get((ctx.values as Raw)["command"] as string);
        if (target === undefined) {
          return undefined;
        }
        if (target.argument !== undefined) {
          return `command '${target.key}' has no options: omit --option`;
        }
        const resolved = resolveOptionPath(target, value as string);
        if (typeof resolved === "string") {
          return `${resolved}, valid options: ${target.options.map((o) => o.name).join(", ")}`;
        }
        return resolved.steps[resolved.steps.length - 1]!.index !== undefined
          ? "unsetting an array element is not supported: unset the whole option instead"
          : undefined;
      },
    },
  ];
  readonly positionals: ReadonlyArray<Positional> = [];

  readonly #configurationService: DefaultConfigurationService;

  public constructor(configurationService: DefaultConfigurationService) {
    this.#configurationService = configurationService;
  }

  async execute(context: Context, argumentValues: Values): Promise<void> {
    const printer = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
    const targets = this.#configurationService.getConfigTargets();

    let commandKey = argumentValues["command"] as string | undefined;
    if (commandKey === undefined) {
      const names = [...this.#configurationService.defaultsData.keys()];
      const prompter = context.doesServiceExist(ARGUMENT_PROMPTER_SERVICE_ID)
        ? (context.getServiceById(ARGUMENT_PROMPTER_SERVICE_ID) as ArgumentPrompterService)
        : undefined;
      const prompted =
        names.length > 0
          ? await prompter?.promptForArguments([
              {
                name: "command",
                description: "Command to remove defaults from",
                type: ValueTypeName.STRING,
                allowableValues: names,
              },
            ])
          : undefined;
      if (prompted === undefined) {
        throw new Error(`--command is required, commands with defaults: ${names.join(", ")}`);
      }
      commandKey = prompted["command"] as string;
    }

    const existing = this.#configurationService.defaultsData.get(commandKey);
    const optionPath = argumentValues["option"] as string | undefined;
    const target = targets.get(commandKey);
    if (optionPath !== undefined && target === undefined) {
      throw new Error(`Unknown or non-configurable command '${commandKey}'`);
    }

    let next: Values | undefined;
    let removed = existing !== undefined;
    if (optionPath !== undefined && existing !== undefined) {
      const resolved = resolveOptionPath(target!, optionPath);
      if (typeof resolved === "string") {
        throw new Error(resolved);
      }
      const values = structuredClone(existing) as Record<string, unknown>;
      removed = removeAtPath(values, resolved.steps);
      next = Object.keys(values).length > 0 ? (values as Values) : undefined;
    }
    if (!removed) {
      await printer.info(
        `Nothing to unset for ${commandKey}${optionPath ? `.${optionPath}` : ""}\n`,
      );
      return;
    }
    await this.#configurationService.commitDefault(commandKey, [], () => next);
    await printer.info(`Removed default ${commandKey}${optionPath ? `.${optionPath}` : ""}\n`);
  }
}
