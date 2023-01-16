import Argument from "../api/argument/Argument.ts";
import Command from "../api/command/Command.ts";
import CLIConfig from "../api/CLIConfig.ts";
import Option from "../api/argument/Option.ts";
import Positional from "../api/argument/Positional.ts";

/**
 * Determine the configuration key for the specified {@link Argument}.
 *
 * @param cliConfig the {@link CLIConfig} to use for determining the default configuration key.
 * @param command the {@link CLIConfig} to use for determining the default configuration key.
 * @param argumentAncestry a list of {@link Argument} instances from the root command arguments to a leaf argument. Apart from {@link ComplexOption}
 * instances this will always only have a single entry.
 */
export function getConfigurationKey(
  cliConfig: CLIConfig,
  command: Command,
  argumentAncestry: Array<Argument>,
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
  const lastArgument = argumentAncestry[argumentAncestry.length - 1];
  if (lastArgument.configurationKey !== undefined) {
    const isArray = (lastArgument as Option).isArray ||
      (lastArgument as Positional).isVarargMultiple;

    return getKeySegment(lastArgument.configurationKey, isArray);
  }
  const keySegments: Array<string> = [];

  keySegments.push(getKeySegment(cliConfig.name));
  keySegments.push(getKeySegment(command.name));

  argumentAncestry.forEach((argument) => {
    const isArray = (argument as Option).isArray ||
      (argument as Positional).isVarargMultiple;

    keySegments.push(getKeySegment(argument.name, isArray));
  });

  return keySegments.join("_");
}

function getKeySegment(segment: string, isArray = false) {
  const keySegment = segment.replace("-", "_").toUpperCase();
  if (isArray) {
    return `${keySegment}[_<index>]`;
  }
  return keySegment;
}
