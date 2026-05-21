import type GlobalModifierCommand from "../../../api/command/GlobalModifierCommand.ts";
import type GlobalCommandArgument from "../../../api/argument/GlobalCommandArgument.ts";
import {
  type ArgumentSingleValueType,
  ArgumentValueTypeName,
} from "../../../api/argument/ArgumentValueTypes.ts";
import type Context from "../../../api/Context.ts";
import type PrompterServiceProvider from "../PrompterServiceProvider.ts";

export default class NoPromptCommand implements GlobalModifierCommand {
  readonly name = "no-prompt";
  readonly description = "Disable interactive prompting";
  readonly enableConfiguration = true;
  readonly argument: GlobalCommandArgument = {
    type: ArgumentValueTypeName.BOOLEAN,
    defaultValue: false,
    configurationKey: "NO_PROMPT",
  };
  readonly executePriority: number;

  readonly #prompterServiceProvider: PrompterServiceProvider;

  public constructor(
    prompterServiceProvider: PrompterServiceProvider,
    executePriority: number,
  ) {
    this.#prompterServiceProvider = prompterServiceProvider;
    this.executePriority = executePriority;
  }

  public execute(
    _context: Context,
    argumentValue: ArgumentSingleValueType,
  ): Promise<void> {
    this.#prompterServiceProvider.prompterService.promptEnabled =
      !(argumentValue as boolean);

    return Promise.resolve();
  }
}
