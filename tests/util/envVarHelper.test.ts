import { assertEquals } from "../test_deps.ts";
import { getCLIConfig } from "../fixtures/CLIConfig.ts";
import {
  getGlobalCommand,
  getSubCommandWithComplexOptions,
  getSubCommandWithOption,
  getSubCommandWithPositional,
} from "../fixtures/Command.ts";
import {
  getGlobalCommandValueFromEnvVars,
  getSubCommandValuesFromEnvVars,
} from "../../src/util/envVarHelper.ts";
import { ArgumentValueTypeName } from "../../src/api/argument/ArgumentValueTypes.ts";

Deno.test("getGlobalCommandValuesFromEnvVars works", () => {
  try {
    let command = getGlobalCommand("blah", true);

    assertEquals(
      getGlobalCommandValueFromEnvVars(getCLIConfig(), command),
      undefined,
    );

    command = getGlobalCommand("blah", true, false, true);

    assertEquals(
      getGlobalCommandValueFromEnvVars(getCLIConfig(), command),
      undefined,
    );

    Deno.env.set("FOO_BLAH", "foo");

    assertEquals(
      getGlobalCommandValueFromEnvVars(getCLIConfig(), command),
      "foo",
    );

    command = getGlobalCommand("blah", true, false, true, "FOO_BAR");

    assertEquals(
      getGlobalCommandValueFromEnvVars(getCLIConfig(), command),
      undefined,
    );

    Deno.env.set("FOO_BAR", "foo");

    assertEquals(
      getGlobalCommandValueFromEnvVars(getCLIConfig(), command),
      "foo",
    );
  } finally {
    Deno.env.delete("FOO_BLAH_VALUE");
    Deno.env.delete("FOO_BAR");
  }
});

Deno.test("getSubCommandValuesFromEnvVars works for simple option", () => {
  try {
    let command = getSubCommandWithOption("blah", true, false);

    assertEquals(
      getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      undefined,
    );

    command = getSubCommandWithOption(
      "blah",
      true,
      false,
      false,
      ArgumentValueTypeName.STRING,
      undefined,
      true,
    );

    assertEquals(
      getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      undefined,
    );

    Deno.env.set("FOO_BLAH_FOO", "bar");

    assertEquals(
      getSubCommandValuesFromEnvVars(getCLIConfig(), command),
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

    assertEquals(
      getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      undefined,
    );

    Deno.env.set("FOO_BAR", "bar");

    assertEquals(
      getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      { foo: "bar" },
    );
  } finally {
    Deno.env.delete("FOO_BLAH_FOO");
    Deno.env.delete("FOO_BAR");
  }
});

Deno.test("getSubCommandValuesFromEnvVars works for positional", () => {
  try {
    let command = getSubCommandWithPositional("blah", true, false);

    assertEquals(
      getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      undefined,
    );

    command = getSubCommandWithPositional(
      "blah",
      true,
      false,
      ArgumentValueTypeName.STRING,
      true,
    );

    assertEquals(
      getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      undefined,
    );

    Deno.env.set("FOO_BLAH_FOO", "bar");

    assertEquals(
      getSubCommandValuesFromEnvVars(getCLIConfig(), command),
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

    assertEquals(
      getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      undefined,
    );

    Deno.env.set("FOO_BAR", "bar");

    assertEquals(
      getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      { foo: "bar" },
    );
  } finally {
    Deno.env.delete("FOO_BLAH_FOO");
    Deno.env.delete("FOO_BAR");
  }
});

Deno.test("getSubCommandValuesFromEnvVars works for complex option", () => {
  try {
    const command = getSubCommandWithComplexOptions(true, true);

    assertEquals(
      getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      undefined,
    );

    Deno.env.set("FOO_SUBCOMMAND_ALPHA_0_BETA_0_GAMMA", "bar1");
    Deno.env.set("FOO_SUBCOMMAND_ALPHA_0_BETA_0_DELTA_0", "bar2");

    assertEquals(
      getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      { alpha: [{ beta: [{ delta: ["bar2"], gamma: "bar1" }] }] },
    );
  } finally {
    Deno.env.delete("FOO_SUBCOMMAND_ALPHA_0_BETA_0_GAMMA");
    Deno.env.delete("FOO_SUBCOMMAND_ALPHA_0_BETA_0_DELTA_0");
  }
});

Deno.test("getSubCommandValuesFromEnvVars ignores partially matched complex option", () => {
  try {
    const command = getSubCommandWithComplexOptions(true);

    assertEquals(
      getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      undefined,
    );

    Deno.env.set("FOO_SUBCOMMAND_ALPHA_0_BETA_0_GAMMA", "bar1");
    Deno.env.set("FOO_SUBCOMMAND_ALPHA_0_BETA_0_DELTA_0", "bar2");

    assertEquals(
      getSubCommandValuesFromEnvVars(getCLIConfig(), command),
      undefined,
    );
  } finally {
    Deno.env.delete("FOO_SUBCOMMAND_ALPHA_0_BETA_0_GAMMA");
    Deno.env.delete("FOO_SUBCOMMAND_ALPHA_0_BETA_0_DELTA_0");
  }
});
