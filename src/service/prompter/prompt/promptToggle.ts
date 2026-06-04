import {
  type Prompt,
  type PromptResult,
  PromptType,
} from "../../../api/service/core/PrompterService.ts";
import type { PromptContext } from "./PromptContext.ts";
import promptSingleSelect from "./promptSingleSelect.ts";

export default function promptToggle(
  ctx: PromptContext,
  promptDef: Prompt,
): Promise<PromptResult> {
  const trueFalse: Prompt = {
    name: promptDef.name,
    promptText: promptDef.promptText,
    description: promptDef.description,
    type: PromptType.SINGLE_SELECT,
    defaultOption: promptDef.defaultOption ?? {
      displayValue: "False",
      returnedValue: false,
    },
    options: promptDef.options.length > 0 ? promptDef.options : [
      { displayValue: "True", returnedValue: true },
      { displayValue: "False", returnedValue: false },
    ],
  };
  return promptSingleSelect(ctx, trueFalse);
}
