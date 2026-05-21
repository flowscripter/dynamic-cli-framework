import type { ArgumentSingleValueType } from "../../argument/ArgumentValueTypes.ts";

export const PROMPTER_SERVICE_ID =
  "@flowscripter/dynamic-cli-framework/prompter-service";

export enum PromptType {
  SINGLE_SELECT = 0,
  MULTI_SELECT = 1,
  ACKNOWLEDGE = 2,
  TOGGLE = 3,
  TEXT = 4,
}

export interface PromptOption {
  readonly displayValue: string;
  readonly returnedValue: ArgumentSingleValueType;
  readonly min?: number;
  readonly max?: number;
  readonly validate?: (
    value: ArgumentSingleValueType,
  ) => string | undefined;
}

export interface Prompt {
  readonly name: string;
  readonly promptText: string;
  readonly type: PromptType;
  readonly description?: string;
  readonly defaultOption?: PromptOption;
  readonly options: ReadonlyArray<PromptOption>;
}

export interface PromptResult {
  readonly name: string;
  readonly value:
    | ArgumentSingleValueType
    | ReadonlyArray<ArgumentSingleValueType>;
}

export default interface PrompterService {
  promptEnabled: boolean;

  prompt(prompt: Prompt): Promise<PromptResult>;

  promptAll(
    prompts: ReadonlyArray<Prompt>,
  ): Promise<ReadonlyArray<PromptResult>>;
}
