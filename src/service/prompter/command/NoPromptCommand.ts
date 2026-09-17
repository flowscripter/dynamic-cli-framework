import type { GlobalModifierCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { GlobalCommandArgument } from "@flowscripter/dynamic-cli-framework-api";
import { type SingleValueType, ValueTypeName } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { PrompterService } from "@flowscripter/dynamic-cli-framework-api";
import { PROMPTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";

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

  public constructor(executePriority: number) {
    this.executePriority = executePriority;
  }

  public execute(context: Context, argumentValue: SingleValueType): Promise<void> {
    const prompterService = context.getServiceById(PROMPTER_SERVICE_ID) as PrompterService;
    prompterService.promptEnabled = !(argumentValue as boolean);

    return Promise.resolve();
  }
}
