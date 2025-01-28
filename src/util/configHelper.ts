import type Command from "../api/command/Command.ts";
import type CLIConfig from "../api/CLIConfig.ts";
import type Option from "../api/argument/Option.ts";
import type Positional from "../api/argument/Positional.ts";
import type SubCommandArgument from "../api/argument/SubCommandArgument.ts";
import type GlobalCommandArgument from "../api/argument/GlobalCommandArgument.ts";

function getKeySegment(segment: string, isCustom = false, isArray = false) {
  let keySegment = segment;
  if (!isCustom) {
    keySegment = keySegment.replace("-", "_").toUpperCase();
    if (keySegment[0].match(/[0-9]/)) {
      keySegment = `_${keySegment}`;
    }
  }
  if (isArray) {
    return `${keySegment}[_<index>]`;
  }
  return keySegment;
}

/**
 * Determine the configuration key for the specified {@link SubCommandArgument}.
 *
 * @param cliConfig the {@link CLIConfig} to use for determining the default configuration key.
 * @param command the {@link Command} to use for determining the default configuration key.
 * @param argumentAncestry a list of {@link SubCommandArgument} instances from the root command arguments to a leaf argument.
 * Apart from {@link ComplexOption} instances this will always only have a single entry.
 */
export function getSubCommandArgumentConfigurationKey(
  cliConfig: CLIConfig,
  command: Command,
  argumentAncestry: Array<SubCommandArgument>,
): string | undefined {
  if (
    (command.enableConfiguration === undefined) ||
    (command.enableConfiguration !== true)
  ) {
    return undefined;
  }
  if (argumentAncestry.length === 0) {
    return undefined;
  }

  const keySegments: Array<string> = [];
  const firstArgument = argumentAncestry[0];
  if (firstArgument.configurationKey === undefined) {
    keySegments.push(getKeySegment(cliConfig.name));
    keySegments.push(getKeySegment(command.name));
  }

  argumentAncestry.forEach((argument) => {
    const isArray = (argument as Option).isArray ||
      (argument as Positional).isVarargMultiple;
    keySegments.push(
      getKeySegment(
        argument.configurationKey || argument.name,
        argument.configurationKey !== undefined,
        isArray,
      ),
    );
  });

  return keySegments.join("_");
}

/**
 * Determine the configuration key for the specified {@link GlobalCommandArgument}.
 *
 * @param cliConfig the {@link CLIConfig} to use for determining the default configuration key.
 * @param command the {@link Command} to use for determining the default configuration key.
 * @param globalCommandArgument the {@link GlobalCommandArgument}.
 */
export function getGlobalCommandArgumentConfigurationKey(
  cliConfig: CLIConfig,
  command: Command,
  globalCommandArgument: GlobalCommandArgument,
): string | undefined {
  if (
    (command.enableConfiguration === undefined) ||
    (command.enableConfiguration !== true)
  ) {
    return undefined;
  }

  const keySegments: Array<string> = [];
  if (globalCommandArgument.configurationKey === undefined) {
    keySegments.push(getKeySegment(cliConfig.name));
    keySegments.push(getKeySegment(command.name));
  } else {
    keySegments.push(getKeySegment(globalCommandArgument.configurationKey));
  }

  return keySegments.join("_");
}
