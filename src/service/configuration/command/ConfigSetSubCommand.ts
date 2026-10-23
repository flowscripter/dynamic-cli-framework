import {
  ARGUMENT_PROMPTER_SERVICE_ID,
  PRINTER_SERVICE_ID,
  ValueTypeName,
  Icon,
  type ArgumentPrompterService,
  type ComplexOption,
  type Context,
  type Option,
  type Positional,
  type PrinterService,
  type SingleValueType,
  type SubCommand,
  type Values,
} from "@flowscripter/dynamic-cli-framework-api";
import type ConfigurationServiceProvider from "../ConfigurationServiceProvider.ts";
import type { DeferredCustomValidation } from "../../../runtime/values/argumentValueValidation.ts";
import { isComplexOption } from "../../../runtime/argument/ArgumentTypeGuards.ts";
import {
  applyChanges,
  containsSecret,
  isOverriddenByEnvVar,
  prepareChange,
  prepareGlobalValue,
  resolveOptionPath,
  setAtPath,
  type ConfigChange,
  type ConfigTarget,
} from "../configTargets.ts";

type Raw = Record<string, unknown>;

async function readStdin(): Promise<string> {
  return await Bun.stdin.text();
}

/**
 * Member of the `config` group which sets a default value for an option of a configurable command.
 *
 * Values are validated against the option declared by the target command (type, allowable values,
 * range and custom validators) but the target's required checks are not applied.
 */
export default class ConfigSetSubCommand implements SubCommand {
  readonly name = "set";
  readonly description = "Set a default value for an option of a command";
  readonly options: ReadonlyArray<Option> = [
    {
      name: "command",
      type: ValueTypeName.STRING,
      description: "The command (or <group>:<member>) to set a default for",
      isOptional: true,
      validate: (value) => this.#validateCommand(value as string),
    },
    {
      name: "option",
      type: ValueTypeName.STRING,
      description:
        "The option to set, for nested or array options a path such as 'address[1].port'. Omit for a global command.",
      isOptional: true,
      validate: (value, ctx) => {
        const target = this.#targetOf(ctx.values);
        if (target === undefined) {
          return undefined;
        }
        if (target.argument !== undefined) {
          return `command '${target.key}' has no options: omit --option`;
        }
        const resolved = resolveOptionPath(target, value as string);
        return typeof resolved === "string" ? this.#withValidOptions(target, resolved) : undefined;
      },
    },
    {
      name: "value",
      type: ValueTypeName.STRING,
      description:
        "The value to set. Arrays and complex options take a JSON value. Prefer a prompt or --value-stdin for SECRET options.",
      isOptional: true,
      validate: (value, ctx) => {
        const target = this.#targetOf(ctx.values);
        if (target === undefined) {
          return undefined;
        }
        const values = ctx.values as Raw;
        const result = this.#prepare(
          target,
          values["option"] as string | undefined,
          value as string,
        );
        return typeof result === "string" ? result : undefined;
      },
    },
    {
      name: "value-stdin",
      type: ValueTypeName.BOOLEAN,
      description: "Read the value from stdin instead of --value",
      isOptional: true,
      validate: (value, ctx) =>
        value === true && (ctx.values as Raw)["value"] !== undefined
          ? "cannot be combined with --value"
          : undefined,
    },
  ];
  readonly positionals: ReadonlyArray<Positional> = [];

  readonly #provider: ConfigurationServiceProvider;
  readonly #readStdin: () => Promise<string>;

  public constructor(
    provider: ConfigurationServiceProvider,
    readStdinFn: () => Promise<string> = readStdin,
  ) {
    this.#provider = provider;
    this.#readStdin = readStdinFn;
  }

  #validateCommand(command: string): string | undefined {
    const targets = this.#provider.getConfigTargets();
    return targets.has(command)
      ? undefined
      : `unknown or non-configurable command, valid commands: ${[...targets.keys()].join(", ")}`;
  }

  #targetOf(values: unknown): ConfigTarget | undefined {
    const command = (values as Raw)["command"];
    return typeof command === "string" ? this.#provider.getConfigTargets().get(command) : undefined;
  }

  #withValidOptions(target: ConfigTarget, message: string): string {
    return `${message}, valid options: ${target.options.map((o) => o.name).join(", ")}`;
  }

  /**
   * Validate and convert a raw value and apply it to a copy of the stored defaults (running the
   * target's custom validators).
   */
  #prepare(
    target: ConfigTarget,
    option: string | undefined,
    raw: string,
  ): { change?: ConfigChange; value?: SingleValueType; isSecret: boolean } | string {
    const deferred: Array<DeferredCustomValidation> = [];
    if (target.argument !== undefined) {
      if (option !== undefined) {
        return `command '${target.key}' has no options: omit --option`;
      }
      return prepareGlobalValue(target, raw, deferred);
    }
    if (option === undefined) {
      return "--option is required with --value";
    }
    const change = prepareChange(target, option, raw, deferred);
    if (typeof change === "string") {
      return change;
    }
    const applied = applyChanges(
      target,
      this.#provider.defaultsData.get(target.key) as Values | undefined,
      [change],
      deferred,
    );
    return typeof applied === "string" ? applied : { change, isSecret: change.isSecret };
  }

  async #promptFor(
    context: Context,
    args: ReadonlyArray<Option | ComplexOption>,
    missing: string,
  ): Promise<Values> {
    if (context.doesServiceExist(ARGUMENT_PROMPTER_SERVICE_ID)) {
      const prompter = context.getServiceById(
        ARGUMENT_PROMPTER_SERVICE_ID,
      ) as ArgumentPrompterService;
      const values = await prompter.promptForArguments(args);
      if (values !== undefined) {
        return values;
      }
    }
    throw new Error(`${missing} (prompting is not available)`);
  }

  async execute(context: Context, argumentValues: Values): Promise<void> {
    const printer = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
    const targets = this.#provider.getConfigTargets();
    const commandNames = [...targets.keys()];

    let commandKey = argumentValues["command"] as string | undefined;
    if (commandKey === undefined) {
      const prompted = await this.#promptFor(
        context,
        [
          {
            name: "command",
            description: "Command to configure",
            type: ValueTypeName.STRING,
            allowableValues: commandNames,
          },
        ],
        `--command is required, valid commands: ${commandNames.join(", ")}`,
      );
      commandKey = prompted["command"] as string;
    }
    const target = targets.get(commandKey);
    if (target === undefined) {
      throw new Error(`Unknown or non-configurable command '${commandKey}'`);
    }

    const optionPath = argumentValues["option"] as string | undefined;
    let raw = argumentValues["value"] as string | undefined;
    if (argumentValues["value-stdin"] === true) {
      if (context.isTty.stdin) {
        throw new Error("--value-stdin requires the value to be piped to stdin, or use the prompt");
      }
      raw = (await this.#readStdin()).replace(/\r?\n$/, "");
      if (raw === "") {
        throw new Error("No value was provided on stdin");
      }
      if (target.argument === undefined && optionPath === undefined) {
        throw new Error("--option is required with --value-stdin");
      }
    }

    const deferred: Array<DeferredCustomValidation> = [];
    const changes: Array<ConfigChange> = [];
    let globalValue: SingleValueType | undefined;
    let globalIsSecret = false;

    if (target.argument !== undefined) {
      if (optionPath !== undefined) {
        throw new Error(`Command '${target.key}' has no options: omit --option`);
      }
      if (raw === undefined) {
        const prompted = await this.#promptFor(
          context,
          [
            {
              description: `Value for ${target.key}`,
              ...target.argument,
              name: "value",
              isOptional: false,
            } as Option,
          ],
          "--value is required",
        );
        globalValue = prompted["value"] as SingleValueType;
        globalIsSecret = target.argument.type === ValueTypeName.SECRET;
      } else {
        const result = prepareGlobalValue(target, raw, deferred);
        if (typeof result === "string") {
          throw new Error(result);
        }
        globalValue = result.value;
        globalIsSecret = result.isSecret;
        await this.#warnIfSecretArgument(context, printer, globalIsSecret, argumentValues);
      }
    } else if (optionPath === undefined && raw !== undefined) {
      throw new Error("--option is required with --value");
    } else if (optionPath === undefined) {
      const mandatory = target.options.filter(
        (o) => o.isOptional !== true && o.defaultValue === undefined,
      );
      if (mandatory.length > 0) {
        const prompted = await this.#promptFor(
          context,
          mandatory,
          `--value is required, mandatory options: ${mandatory.map((o) => o.name).join(", ")}`,
        );
        for (const option of mandatory) {
          changes.push(this.#promptedChange(option, prompted[option.name]!));
        }
      } else {
        const names = target.options.map((o) => o.name);
        const selected = await this.#promptFor(
          context,
          [
            {
              name: "option",
              description: "Option to set",
              type: ValueTypeName.STRING,
              allowableValues: names,
            },
          ],
          `--option is required, valid options: ${names.join(", ")}`,
        );
        const option = target.options.find((o) => o.name === selected["option"])!;
        const prompted = await this.#promptFor(
          context,
          [{ ...option, isOptional: false } as Option],
          "--value is required",
        );
        changes.push(this.#promptedChange(option, prompted[option.name]!));
      }
    } else {
      const resolved = resolveOptionPath(target, optionPath);
      if (typeof resolved === "string") {
        throw new Error(this.#withValidOptions(target, resolved));
      }
      if (raw === undefined) {
        const { leaf, steps } = resolved;
        const hasIndex = steps[steps.length - 1]!.index !== undefined;
        const prompted = await this.#promptFor(
          context,
          [{ ...leaf, isArray: hasIndex ? false : leaf.isArray, isOptional: false } as Option],
          "--value is required",
        );
        changes.push({
          ...this.#promptedChange(leaf, prompted[leaf.name]!),
          steps,
          path: optionPath,
        });
      } else {
        const change = prepareChange(target, optionPath, raw, deferred);
        if (typeof change === "string") {
          throw new Error(change);
        }
        changes.push(change);
        await this.#warnIfSecretArgument(context, printer, change.isSecret, argumentValues);
      }
    }

    const existing = this.#provider.defaultsData.get(target.key) as Values | undefined;
    if (target.argument === undefined) {
      const applied = applyChanges(target, existing, changes, deferred);
      if (typeof applied === "string") {
        throw new Error(applied);
      }
    }

    const secretChanges = changes.filter((c) => c.isSecret);
    const secrets =
      target.argument !== undefined
        ? globalIsSecret
          ? [{ key: target.key, value: globalValue as string }]
          : []
        : secretChanges.map((c) => ({ key: `${target.key}.${c.path}`, value: c.value as string }));

    await this.#provider.commitDefault(target.key, secrets, (sentinels) => {
      if (target.argument !== undefined) {
        return globalIsSecret ? sentinels[0] : globalValue;
      }
      const values = structuredClone(existing ?? {}) as Record<string, unknown>;
      for (const change of changes) {
        const secretIndex = secretChanges.indexOf(change);
        setAtPath(values, change.steps, secretIndex >= 0 ? sentinels[secretIndex] : change.value);
      }
      return values as Values;
    });

    for (const change of target.argument !== undefined ? [] : changes) {
      await printer.info(`Set default ${target.key}.${change.path}\n`);
      if (isOverriddenByEnvVar(this.#provider, context.cliConfig, target, change.steps)) {
        await printer.warn(
          `An environment variable overrides the default for ${target.key}.${change.path}\n`,
          Icon.ALERT,
        );
      }
    }
    if (target.argument !== undefined) {
      await printer.info(`Set default ${target.key}\n`);
      if (isOverriddenByEnvVar(this.#provider, context.cliConfig, target, [])) {
        await printer.warn(
          `An environment variable overrides the default for ${target.key}\n`,
          Icon.ALERT,
        );
      }
    }
  }

  #promptedChange(option: Option | ComplexOption, value: unknown): ConfigChange {
    if (containsSecret(option) && (isComplexOption(option) || option.isArray === true)) {
      throw new Error(
        `Option '${option.name}' contains SECRET values: set each secret property individually using --option`,
      );
    }
    return {
      steps: [{ name: option.name }],
      path: option.name,
      leaf: option,
      value,
      isSecret: !isComplexOption(option) && option.type === ValueTypeName.SECRET,
    };
  }

  async #warnIfSecretArgument(
    context: Context,
    printer: PrinterService,
    isSecret: boolean,
    argumentValues: Values,
  ): Promise<void> {
    if (isSecret && argumentValues["value-stdin"] !== true && context.isTty.stdin) {
      await printer.warn(
        "SECRET value passed as a plain argument. This is not recommended as it may be exposed via shell history " +
          "and process listings (and in debug logs). Use the prompt or --value-stdin instead.\n\n",
        Icon.ALERT,
      );
    }
  }
}
