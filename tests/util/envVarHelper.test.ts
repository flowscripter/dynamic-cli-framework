import process from "node:process";
import { describe, expect, test } from "bun:test";
import { getCLIConfig } from "../fixtures/CLIConfig.ts";
import {
  getGlobalCommand,
  getGlobalModifierCommandWithArgument,
  getSubCommandWithComplexOptions,
  getSubCommandWithOption,
  getSubCommandWithPositional,
} from "../fixtures/Command.ts";
import {
  getGlobalCommandValueFromEnvVars,
  getSubCommandValuesFromEnvVars,
} from "../../src/util/envVarHelper.ts";
import { ArgumentValueTypeName } from "../../src/api/argument/ArgumentValueTypes.ts";

describe("envVarHelper tests", () => {
  test("getGlobalCommandValuesFromEnvVars works", () => {
    try {
      let command = getGlobalCommand("blah", true);

      expect(
        getGlobalCommandValueFromEnvVars(getCLIConfig(), command),
      ).toBeUndefined();

      command = getGlobalCommand("blah", true, false, true);

      expect(
        getGlobalCommandValueFromEnvVars(getCLIConfig(), command),
      ).toBeUndefined();

      process.env["FOO_BLAH"] = "foo";

      expect(
        getGlobalCommandValueFromEnvVars(getCLIConfig(), command),
      ).toEqual(
        "foo",
      );

      command = getGlobalCommand("blah", true, false, true, "FOO_BAR");

      expect(
        getGlobalCommandValueFromEnvVars(getCLIConfig(), command),
      ).toBeUndefined();

      process.env["FOO_BAR"] = "foo";

      expect(
        getGlobalCommandValueFromEnvVars(getCLIConfig(), command),
      ).toEqual(
        "foo",
      );

      command = getGlobalModifierCommandWithArgument(
        "FOO_BAR",
        "m",
        1,
        {
          type: ArgumentValueTypeName.BOOLEAN,
          configurationKey: "FOO_BAR",
        },
        true,
      );

      // any env var value should set boolean option to true
      process.env["FOO_BAR"] = "foo";

      expect(
        getGlobalCommandValueFromEnvVars(getCLIConfig(), command),
      ).toEqual(
        "true",
      );

      // empty env var value should set boolean option to false
      process.env["FOO_BAR"] = "";

      expect(
        getGlobalCommandValueFromEnvVars(getCLIConfig(), command),
      ).toEqual(
        "false",
      );

      // no env var value should not set boolean option to false
      delete process.env["FOO_BAR"];

      expect(
        getGlobalCommandValueFromEnvVars(getCLIConfig(), command),
      ).toBeUndefined();
    } finally {
      delete process.env["FOO_BLAH_VALUE"];
      delete process.env["FOO_BAR"];
    }
  });

  test("getSubCommandValuesFromEnvVars works for simple option", () => {
    try {
      let command = getSubCommandWithOption("blah", true, false);

      expect(
        getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      ).toBeUndefined();

      command = getSubCommandWithOption(
        "blah",
        true,
        false,
        false,
        ArgumentValueTypeName.STRING,
        undefined,
        true,
      );

      expect(
        getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      ).toBeUndefined();

      process.env["FOO_BLAH_FOO"] = "bar";

      expect(
        getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      ).toEqual(
        { foo: "bar" },
      );

      command = getSubCommandWithOption(
        "blah",
        true,
        false,
        false,
        ArgumentValueTypeName.STRING,
        undefined,
        true,
        "FOO_BAR",
      );

      expect(
        getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      ).toBeUndefined();

      process.env["FOO_BAR"] = "bar";

      expect(
        getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      ).toEqual(
        { foo: "bar" },
      );

      command = getSubCommandWithOption(
        "blah",
        true,
        false,
        false,
        ArgumentValueTypeName.BOOLEAN,
        undefined,
        true,
        "FOO_BAR",
      );

      // any env var value should set boolean option to true
      process.env["FOO_BAR"] = "foo";

      expect(
        getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      ).toEqual(
        { foo: "true" },
      );

      // empty env var value should set boolean option to false
      process.env["FOO_BAR"] = "";

      expect(
        getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      ).toEqual(
        { foo: "false" },
      );

      delete process.env["FOO_BAR"];

      // no env var value should not set boolean option to false
      expect(
        getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      ).toBeUndefined();
    } finally {
      delete process.env["FOO_BLAH_FOO"];
      delete process.env["FOO_BAR"];
    }
  });

  test("getSubCommandValuesFromEnvVars works for positional", () => {
    try {
      let command = getSubCommandWithPositional("blah", true, false);

      expect(
        getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      ).toBeUndefined();

      command = getSubCommandWithPositional(
        "blah",
        true,
        false,
        ArgumentValueTypeName.STRING,
        true,
      );

      expect(
        getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      ).toBeUndefined();

      process.env["FOO_BLAH_FOO"] = "bar";

      expect(
        getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      ).toEqual(
        { foo: "bar" },
      );

      command = getSubCommandWithPositional(
        "blah",
        true,
        false,
        ArgumentValueTypeName.STRING,
        true,
        "FOO_BAR",
      );

      expect(
        getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      ).toBeUndefined();

      process.env["FOO_BAR"] = "bar";

      expect(
        getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      ).toEqual(
        { foo: "bar" },
      );

      command = getSubCommandWithPositional(
        "blah",
        true,
        false,
        ArgumentValueTypeName.BOOLEAN,
        true,
        "FOO_BAR",
      );

      // any env var value should set boolean option to true
      process.env["FOO_BAR"] = "foo";

      expect(
        getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      ).toEqual(
        { foo: "true" },
      );

      // empty env var value should set boolean option to false
      process.env["FOO_BAR"] = "";

      expect(
        getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      ).toEqual(
        { foo: "false" },
      );

      // no env var value should not set boolean option to false
      delete process.env["FOO_BAR"];

      expect(
        getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      ).toBeUndefined();
    } finally {
      delete process.env["FOO_BLAH_FOO"];
      delete process.env["FOO_BAR"];
    }
  });

  test("getSubCommandValuesFromEnvVars works for complex option", () => {
    try {
      const command = getSubCommandWithComplexOptions(true, true);

      expect(
        getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      ).toBeUndefined();

      process.env["FOO_SUBCOMMAND_ALPHA_0_BETA_0_GAMMA"] = "bar1";
      process.env["FOO_SUBCOMMAND_ALPHA_0_BETA_0_DELTA_0"] = "bar2";

      expect(
        getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      ).toEqual(
        { alpha: [{ beta: [{ delta: ["bar2"], gamma: "bar1" }] }] },
      );
    } finally {
      delete process.env["FOO_SUBCOMMAND_ALPHA_0_BETA_0_GAMMA"];
      delete process.env["FOO_SUBCOMMAND_ALPHA_0_BETA_0_DELTA_0"];
    }
  });

  test("getSubCommandValuesFromEnvVars ignores partially matched complex option", () => {
    try {
      const command = getSubCommandWithComplexOptions(true);

      expect(
        getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      ).toBeUndefined();

      process.env["FOO_SUBCOMMAND_ALPHA_0_BETA_0_GAMMA"] = "bar1";
      process.env["FOO_SUBCOMMAND_ALPHA_0_BETA_0_DELTA_0"] = "bar2";

      expect(
        getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      ).toBeUndefined();
    } finally {
      delete process.env["FOO_SUBCOMMAND_ALPHA_0_BETA_0_GAMMA"];
      delete process.env["FOO_SUBCOMMAND_ALPHA_0_BETA_0_DELTA_0"];
    }
  });
});
