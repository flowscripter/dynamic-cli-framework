import {
  type Prompt,
  type PromptResult,
  PromptType,
} from "../../../api/service/core/PrompterService.ts";
import type { PromptContext } from "./PromptContext.ts";
import promptSingleSelect from "./promptSingleSelect.ts";

export default function promptAcknowledge(
  ctx: PromptContext,
  promptDef: Prompt,
): Promise<PromptResult> {
  const yesNo: Prompt = {
    name: promptDef.name,
    promptText: promptDef.promptText,
    description: promptDef.description,
    type: PromptType.SINGLE_SELECT,
    defaultOption: promptDef.defaultOption ?? {
      displayValue: "No",
      returnedValue: false,
    },
    options: [
      { displayValue: "Yes", returnedValue: true },
      { displayValue: "No", returnedValue: false },
    ],
  };
  return promptSingleSelect(ctx, yesNo);
}
