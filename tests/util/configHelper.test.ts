import { describe, it } from "https://deno.land/std@0.161.0/testing/bdd.ts";
import { getConfigurationKey } from "../../src/util/configHelper.ts";
import { assertEquals } from "https://deno.land/std@0.163.0/testing/asserts.ts";
import { getCLIConfig } from "../fixtures/CLIConfig.ts";
import {
  getGlobalCommand,
  getPositionalSubCommand,
  getSubCommand,
} from "../fixtures/Command.ts";
import {
  ArgumentValueTypeName,
  ComplexValueTypeName,
} from "../../src/api/argument/ArgumentValueTypes.ts";
import { Argument, ComplexOption, Option, SubCommand } from "../../mod.ts";

function getSubCommandWithComplexOptions(
  enableConfiguration = false,
): SubCommand {
  return {
    name: "blah",
    enableConfiguration,
    options: [{
      name: "alpha",
      shortAlias: "a",
      type: ComplexValueTypeName.COMPLEX,
      isArray: true,
      properties: [{
        name: "beta",
        shortAlias: "b",
        type: ComplexValueTypeName.COMPLEX,
        isArray: true,
        properties: [{
          name: "gamma",
          shortAlias: "g",
          type: ArgumentValueTypeName.STRING,
        }, {
          name: "delta",
          shortAlias: "d",
          type: ArgumentValueTypeName.NUMBER,
          isArray: true,
        }],
      }],
    }, {
      name: "epsilon",
      shortAlias: "e",
      type: ComplexValueTypeName.COMPLEX,
      properties: [{
        name: "gamma",
        shortAlias: "g",
        type: ArgumentValueTypeName.STRING,
        configurationKey: "FOO_bar_A",
      }, {
        name: "delta",
        shortAlias: "d",
        type: ArgumentValueTypeName.NUMBER,
        configurationKey: "FOO_bar_B",
        isArray: true,
      }],
    }],
    positionals: [],
    execute: async (): Promise<void> => {},
  };
}

describe("configHelper", () => {
  it("getConfigurationKey works for global argument", () => {
    let command = getGlobalCommand("blah", true);

    assertEquals(
      getConfigurationKey(getCLIConfig(), command, [command.argument!]),
      undefined,
    );

    command = getGlobalCommand("blah", true, false, true);

    assertEquals(
      getConfigurationKey(getCLIConfig(), command, [command.argument!]),
      "FOO_BLAH_VALUE",
    );

    command = getGlobalCommand("blah", true, false, true, "FOO_BAR");

    assertEquals(
      getConfigurationKey(getCLIConfig(), command, [command.argument!]),
      "FOO_BAR",
    );
  });

  it("getConfigurationKey works for positional argument", () => {
    let command = getPositionalSubCommand("blah", true, true);

    assertEquals(
      getConfigurationKey(getCLIConfig(), command, [command.positionals![0]]),
      undefined,
    );

    command = getPositionalSubCommand(
      "blah",
      true,
      false,
      ArgumentValueTypeName.BOOLEAN,
      true,
    );

    assertEquals(
      getConfigurationKey(getCLIConfig(), command, [command.positionals![0]]),
      "FOO_BLAH_FOO",
    );

    command = getPositionalSubCommand(
      "blah",
      true,
      true,
      ArgumentValueTypeName.BOOLEAN,
      true,
    );

    assertEquals(
      getConfigurationKey(getCLIConfig(), command, [command.positionals![0]]),
      "FOO_BLAH_FOO[_<index>]",
    );

    command = getPositionalSubCommand(
      "blah",
      true,
      true,
      ArgumentValueTypeName.BOOLEAN,
      true,
      "FOO_bar",
    );

    assertEquals(
      getConfigurationKey(getCLIConfig(), command, [command.positionals![0]]),
      "FOO_BAR[_<index>]",
    );
  });

  it("getConfigurationKey works for simple option argument", () => {
    let command = getSubCommand("blah", true, false, true);

    assertEquals(
      getConfigurationKey(
        getCLIConfig(),
        command,
        [command.options![0] as Option],
      ),
      undefined,
    );

    command = getSubCommand(
      "blah",
      true,
      false,
      false,
      ArgumentValueTypeName.BOOLEAN,
      undefined,
      true,
    );

    assertEquals(
      getConfigurationKey(
        getCLIConfig(),
        command,
        [command.options![0] as Option],
      ),
      "FOO_BLAH_FOO",
    );

    command = getSubCommand(
      "blah",
      true,
      false,
      true,
      ArgumentValueTypeName.BOOLEAN,
      undefined,
      true,
    );

    assertEquals(
      getConfigurationKey(
        getCLIConfig(),
        command,
        [command.options![0] as Option],
      ),
      "FOO_BLAH_FOO[_<index>]",
    );

    command = getSubCommand(
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
      getConfigurationKey(
        getCLIConfig(),
        command,
        [command.options![0] as Option],
      ),
      "FOO_BAR[_<index>]",
    );
  });

  it("getConfigurationKey works for complex option argument", () => {
    let command = getSubCommandWithComplexOptions();

    let arg0 = command.options![0] as ComplexOption;
    let arg1 = (arg0).properties[0] as ComplexOption;
    let arg2 = (arg1).properties[0] as Option;

    assertEquals(
      getConfigurationKey(
        getCLIConfig(),
        command,
        [
          arg0 as unknown as Argument,
          arg1 as unknown as Argument,
          arg2 as unknown as Argument,
        ],
      ),
      undefined,
    );

    command = getSubCommandWithComplexOptions(true);

    assertEquals(
      getConfigurationKey(
        getCLIConfig(),
        command,
        [
          arg0 as unknown as Argument,
          arg1 as unknown as Argument,
          arg2 as unknown as Argument,
        ],
      ),
      "FOO_BLAH_ALPHA[_<index>]_BETA[_<index>]_GAMMA",
    );

    arg2 = (arg1).properties[1] as Option;

    assertEquals(
      getConfigurationKey(
        getCLIConfig(),
        command,
        [
          arg0 as unknown as Argument,
          arg1 as unknown as Argument,
          arg2 as unknown as Argument,
        ],
      ),
      "FOO_BLAH_ALPHA[_<index>]_BETA[_<index>]_DELTA[_<index>]",
    );

    arg0 = command.options![1] as ComplexOption;
    arg1 = (arg0).properties[0] as ComplexOption;

    assertEquals(
      getConfigurationKey(
        getCLIConfig(),
        command,
        [
          arg0 as unknown as Argument,
          arg1 as unknown as Argument,
        ],
      ),
      "FOO_BAR_A",
    );

    arg1 = (arg0).properties[1] as ComplexOption;

    assertEquals(
      getConfigurationKey(
        getCLIConfig(),
        command,
        [
          arg0 as unknown as Argument,
          arg1 as unknown as Argument,
        ],
      ),
      "FOO_BAR_B[_<index>]",
    );
  });
});
