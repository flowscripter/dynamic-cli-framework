import { describe, expect, test } from "bun:test";
import {
  getGlobalCommandArgumentConfigurationKey,
  getSubCommandArgumentConfigurationKey,
} from "../../src/util/configHelper.ts";
import { getCLIConfig } from "../fixtures/CLIConfig.ts";
import {
  getGlobalCommand,
  getSubCommandWithComplexOptions,
  getSubCommandWithOption,
  getSubCommandWithPositional,
} from "../fixtures/Command.ts";
import { ArgumentValueTypeName } from "../../src/api/argument/ArgumentValueTypes.ts";
import type ComplexOption from "../../src/api/argument/ComplexOption.ts";
import type Option from "../../src/api/argument/Option.ts";
import type SubCommandArgument from "../../src/api/argument/SubCommandArgument.ts";

describe("configHelper Tests", () => {
  test("getConfigurationKey works for global argument", () => {
    let command = getGlobalCommand("blah", true);

    expect(
      getGlobalCommandArgumentConfigurationKey(
        getCLIConfig(),
        command,
        command.argument!,
      ),
    ).toBeUndefined();

    command = getGlobalCommand("blah", true, false, true);

    expect(
      getGlobalCommandArgumentConfigurationKey(
        getCLIConfig(),
        command,
        command.argument!,
      ),
    ).toEqual(
      "FOO_BLAH",
    );

    command = getGlobalCommand("blah", true, false, true, "FOO_BAR");

    expect(
      getGlobalCommandArgumentConfigurationKey(
        getCLIConfig(),
        command,
        command.argument!,
      ),
      "FOO_BAR",
    );
  });

  test("getConfigurationKey works for positional argument", () => {
    let command = getSubCommandWithPositional("blah", true, true);

    expect(
      getSubCommandArgumentConfigurationKey(getCLIConfig(), command, [
        command.positionals![0],
      ]),
    ).toBeUndefined();

    command = getSubCommandWithPositional(
      "blah",
      true,
      false,
      ArgumentValueTypeName.BOOLEAN,
      true,
    );

    expect(
      getSubCommandArgumentConfigurationKey(getCLIConfig(), command, [
        command.positionals![0],
      ]),
    ).toEqual(
      "FOO_BLAH_FOO",
    );

    command = getSubCommandWithPositional(
      "blah",
      true,
      true,
      ArgumentValueTypeName.BOOLEAN,
      true,
    );

    expect(
      getSubCommandArgumentConfigurationKey(getCLIConfig(), command, [
        command.positionals![0],
      ]),
    ).toEqual(
      "FOO_BLAH_FOO[_<index>]",
    );

    command = getSubCommandWithPositional(
      "blah",
      true,
      true,
      ArgumentValueTypeName.BOOLEAN,
      true,
      "FOO_BAR",
    );

    expect(
      getSubCommandArgumentConfigurationKey(getCLIConfig(), command, [
        command.positionals![0],
      ]),
    ).toEqual(
      "FOO_BAR[_<index>]",
    );
  });

  test("getConfigurationKey works for simple option argument", () => {
    let command = getSubCommandWithOption("blah", true, false, true);

    expect(
      getSubCommandArgumentConfigurationKey(
        getCLIConfig(),
        command,
        [command.options![0] as Option],
      ),
    ).toBeUndefined();

    command = getSubCommandWithOption(
      "blah",
      true,
      false,
      false,
      ArgumentValueTypeName.BOOLEAN,
      undefined,
      true,
    );

    expect(
      getSubCommandArgumentConfigurationKey(
        getCLIConfig(),
        command,
        [command.options![0] as Option],
      ),
    ).toEqual(
      "FOO_BLAH_FOO",
    );

    command = getSubCommandWithOption(
      "blah",
      true,
      false,
      true,
      ArgumentValueTypeName.BOOLEAN,
      undefined,
      true,
    );

    expect(
      getSubCommandArgumentConfigurationKey(
        getCLIConfig(),
        command,
        [command.options![0] as Option],
      ),
    ).toEqual(
      "FOO_BLAH_FOO[_<index>]",
    );

    command = getSubCommandWithOption(
      "blah",
      true,
      false,
      true,
      ArgumentValueTypeName.BOOLEAN,
      undefined,
      true,
      "FOO_BAR",
    );

    expect(
      getSubCommandArgumentConfigurationKey(
        getCLIConfig(),
        command,
        [command.options![0] as Option],
      ),
    ).toEqual(
      "FOO_BAR[_<index>]",
    );
  });

  test("getConfigurationKey works for complex option argument", () => {
    let command = getSubCommandWithComplexOptions();

    let arg0 = command.options![0] as ComplexOption;
    let arg1 = arg0.properties[0] as ComplexOption;
    let arg2 = arg1.properties[0] as Option;

    expect(
      getSubCommandArgumentConfigurationKey(
        getCLIConfig(),
        command,
        [
          arg0 as unknown as SubCommandArgument,
          arg1 as unknown as SubCommandArgument,
          arg2 as unknown as SubCommandArgument,
        ],
      ),
    ).toBeUndefined();

    command = getSubCommandWithComplexOptions(true, true);

    arg0 = command.options![0] as ComplexOption;
    arg1 = arg0.properties[0] as ComplexOption;
    arg2 = arg1.properties[0] as Option;

    expect(
      getSubCommandArgumentConfigurationKey(
        getCLIConfig(),
        command,
        [
          arg0 as unknown as SubCommandArgument,
          arg1 as unknown as SubCommandArgument,
          arg2 as unknown as SubCommandArgument,
        ],
      ),
    ).toEqual(
      "FOO_SUBCOMMAND_ALPHA[_<index>]_BETA[_<index>]_GAMMA",
    );

    arg2 = arg1.properties[1] as Option;

    expect(
      getSubCommandArgumentConfigurationKey(
        getCLIConfig(),
        command,
        [
          arg0 as unknown as SubCommandArgument,
          arg1 as unknown as SubCommandArgument,
          arg2 as unknown as SubCommandArgument,
        ],
      ),
    ).toEqual(
      "FOO_SUBCOMMAND_ALPHA[_<index>]_BETA[_<index>]_DELTA[_<index>]",
    );

    arg0 = command.options![1] as ComplexOption;
    arg1 = arg0.properties[0] as ComplexOption;

    expect(
      getSubCommandArgumentConfigurationKey(
        getCLIConfig(),
        command,
        [
          arg0 as unknown as SubCommandArgument,
          arg1 as unknown as SubCommandArgument,
        ],
      ),
    ).toEqual(
      "FOO_SUBCOMMAND_EPSILON_FOO_BAR_A",
    );

    command = getSubCommandWithComplexOptions(true, true, true);

    arg0 = command.options![1] as ComplexOption;
    arg1 = arg0.properties[1] as ComplexOption;

    expect(
      getSubCommandArgumentConfigurationKey(
        getCLIConfig(),
        command,
        [
          arg0 as unknown as SubCommandArgument,
          arg1 as unknown as SubCommandArgument,
        ],
      ),
    ).toEqual(
      "FOO_SUBCOMMAND_EPSILON_FOO_BAR_B[_<index>]",
    );
  });
});
