import { assertEquals } from "@std/assert";
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

Deno.test("getConfigurationKey works for global argument", () => {
  let command = getGlobalCommand("blah", true);

  assertEquals(
    getGlobalCommandArgumentConfigurationKey(
      getCLIConfig(),
      command,
      command.argument!,
    ),
    undefined,
  );

  command = getGlobalCommand("blah", true, false, true);

  assertEquals(
    getGlobalCommandArgumentConfigurationKey(
      getCLIConfig(),
      command,
      command.argument!,
    ),
    "FOO_BLAH",
  );

  command = getGlobalCommand("blah", true, false, true, "FOO_BAR");

  assertEquals(
    getGlobalCommandArgumentConfigurationKey(
      getCLIConfig(),
      command,
      command.argument!,
    ),
    "FOO_BAR",
  );
});

Deno.test("getConfigurationKey works for positional argument", () => {
  let command = getSubCommandWithPositional("blah", true, true);

  assertEquals(
    getSubCommandArgumentConfigurationKey(getCLIConfig(), command, [
      command.positionals![0],
    ]),
    undefined,
  );

  command = getSubCommandWithPositional(
    "blah",
    true,
    false,
    ArgumentValueTypeName.BOOLEAN,
    true,
  );

  assertEquals(
    getSubCommandArgumentConfigurationKey(getCLIConfig(), command, [
      command.positionals![0],
    ]),
    "FOO_BLAH_FOO",
  );

  command = getSubCommandWithPositional(
    "blah",
    true,
    true,
    ArgumentValueTypeName.BOOLEAN,
    true,
  );

  assertEquals(
    getSubCommandArgumentConfigurationKey(getCLIConfig(), command, [
      command.positionals![0],
    ]),
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

  assertEquals(
    getSubCommandArgumentConfigurationKey(getCLIConfig(), command, [
      command.positionals![0],
    ]),
    "FOO_BAR[_<index>]",
  );
});

Deno.test("getConfigurationKey works for simple option argument", () => {
  let command = getSubCommandWithOption("blah", true, false, true);

  assertEquals(
    getSubCommandArgumentConfigurationKey(
      getCLIConfig(),
      command,
      [command.options![0] as Option],
    ),
    undefined,
  );

  command = getSubCommandWithOption(
    "blah",
    true,
    false,
    false,
    ArgumentValueTypeName.BOOLEAN,
    undefined,
    true,
  );

  assertEquals(
    getSubCommandArgumentConfigurationKey(
      getCLIConfig(),
      command,
      [command.options![0] as Option],
    ),
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

  assertEquals(
    getSubCommandArgumentConfigurationKey(
      getCLIConfig(),
      command,
      [command.options![0] as Option],
    ),
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

  assertEquals(
    getSubCommandArgumentConfigurationKey(
      getCLIConfig(),
      command,
      [command.options![0] as Option],
    ),
    "FOO_BAR[_<index>]",
  );
});

Deno.test("getConfigurationKey works for complex option argument", () => {
  let command = getSubCommandWithComplexOptions();

  let arg0 = command.options![0] as ComplexOption;
  let arg1 = arg0.properties[0] as ComplexOption;
  let arg2 = arg1.properties[0] as Option;

  assertEquals(
    getSubCommandArgumentConfigurationKey(
      getCLIConfig(),
      command,
      [
        arg0 as unknown as SubCommandArgument,
        arg1 as unknown as SubCommandArgument,
        arg2 as unknown as SubCommandArgument,
      ],
    ),
    undefined,
  );

  command = getSubCommandWithComplexOptions(true, true);

  arg0 = command.options![0] as ComplexOption;
  arg1 = arg0.properties[0] as ComplexOption;
  arg2 = arg1.properties[0] as Option;

  assertEquals(
    getSubCommandArgumentConfigurationKey(
      getCLIConfig(),
      command,
      [
        arg0 as unknown as SubCommandArgument,
        arg1 as unknown as SubCommandArgument,
        arg2 as unknown as SubCommandArgument,
      ],
    ),
    "FOO_SUBCOMMAND_ALPHA[_<index>]_BETA[_<index>]_GAMMA",
  );

  arg2 = arg1.properties[1] as Option;

  assertEquals(
    getSubCommandArgumentConfigurationKey(
      getCLIConfig(),
      command,
      [
        arg0 as unknown as SubCommandArgument,
        arg1 as unknown as SubCommandArgument,
        arg2 as unknown as SubCommandArgument,
      ],
    ),
    "FOO_SUBCOMMAND_ALPHA[_<index>]_BETA[_<index>]_DELTA[_<index>]",
  );

  arg0 = command.options![1] as ComplexOption;
  arg1 = arg0.properties[0] as ComplexOption;

  assertEquals(
    getSubCommandArgumentConfigurationKey(
      getCLIConfig(),
      command,
      [
        arg0 as unknown as SubCommandArgument,
        arg1 as unknown as SubCommandArgument,
      ],
    ),
    "FOO_SUBCOMMAND_EPSILON_FOO_BAR_A",
  );

  command = getSubCommandWithComplexOptions(true, true, true);

  arg0 = command.options![1] as ComplexOption;
  arg1 = arg0.properties[1] as ComplexOption;

  assertEquals(
    getSubCommandArgumentConfigurationKey(
      getCLIConfig(),
      command,
      [
        arg0 as unknown as SubCommandArgument,
        arg1 as unknown as SubCommandArgument,
      ],
    ),
    "FOO_SUBCOMMAND_EPSILON_FOO_BAR_B[_<index>]",
  );
});
