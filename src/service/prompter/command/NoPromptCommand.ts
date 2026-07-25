import type { GlobalModifierCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommandArgument } from "@flowscripter/dynamic-cli-framework-api";
import { type SingleValueType, ValueTypeName } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type PrompterServiceProvider from "../PrompterServiceProvider.ts";

export default class NoPromptCommand implements GlobalModifierCommand {
  readonly name = "no-prompt";
  readonly description = "Disable interactive prompting";
  readonly enableConfiguration = true;
  readonly argument: GlobalCommandArgument = {
    type: ValueTypeName.BOOLEAN,
    defaultValue: false,
    configurationKey: "NO_PROMPT",
  };
  readonly executePriority: number;

  readonly #prompterServiceProvider: PrompterServiceProvider;

  public constructor(prompterServiceProvider: PrompterServiceProvider, executePriority: number) {
    this.#prompterServiceProvider = prompterServiceProvider;
    this.executePriority = executePriority;
  }

  public execute(_context: Context, argumentValue: SingleValueType): Promise<void> {
    this.#prompterServiceProvider.prompterService.promptEnabled = !(argumentValue as boolean);

    return Promise.resolve();
  }
}
