import type { ParseResult } from "../../ParseResult.ts";

export const ARGUMENT_PROMPTER_SERVICE_ID =
  "@flowscripter/dynamic-cli-framework/argument-prompter-service";

export default interface ArgumentPrompterService {
  promptForMissingArguments(parseResult: ParseResult): Promise<ParseResult>;
}
