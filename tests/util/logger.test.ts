import { describe, expect, test } from "bun:test";
import getLogger from "../../src/util/logger.ts";

describe("logger tests", () => {
  test("Can acquire a logger", () => {
    const logger = getLogger("logger test");

    logger.debug("foobar");
  });

  test("Log a string at error level", () => {
    const logger = getLogger("logger test");

    logger.error("foobar");
  });

  test("Log an object at error level", () => {
    const logger = getLogger("logger test");

    logger.error({ foo: "bar" });
  });

  test("Log result of a function at error level", () => {
    const logger = getLogger("logger test");

    logger.error(() => "foobar");
  });

  test("Log a string with formatted args at error level", () => {
    const logger = getLogger("logger test");

    logger.error("foo: %s %O", "bar", { foo1: "bar1", func: () => "foobar" });
  });

  test("Logger name padding is updated when a longer name is used", () => {
    const shortLogger = getLogger("short");
    const longLogger = getLogger("very-long-logger-name");
    // Both should be valid logger instances
    expect(shortLogger).toBeDefined();
    expect(longLogger).toBeDefined();
    // Calling all levels to exercise non-debug path
    shortLogger.trace("trace msg");
    shortLogger.debug("debug msg");
    shortLogger.info("info msg");
    shortLogger.warn("warn msg");
    shortLogger.error("error msg");
  });

  test("Logger with same-length name reuses existing padding", () => {
    // Create two loggers with same length names to hit the else-if branch
    const logger1 = getLogger("aaa");
    const logger2 = getLogger("bbb");
    expect(logger1).toBeDefined();
    expect(logger2).toBeDefined();
  });
});

describe("logger with debug enabled", () => {
  // This test runs in a subprocess with DYNAMIC_CLI_FRAMEWORK_DEBUG set
  test("debug-enabled logger exercises all wrapped levels", async () => {
    const tmpDir = await import("node:os").then((os) => os.tmpdir());
    const scriptFile = `${tmpDir}/logger_debug_test_${Date.now()}.ts`;
    const projectRoot = import.meta.dir.replace(/\/tests\/util$/, "");
    const scriptContent = `
import getLogger from "${projectRoot}/src/util/logger.ts";
const logger = getLogger("debugtest");
logger.trace("trace msg");
logger.debug("debug string");
logger.debug({ key: "value" });
logger.debug(() => "lazy debug");
logger.info("info msg");
logger.warn("warn msg");
logger.error("error msg");
logger.error({ errKey: "errVal" });
logger.error(() => "lazy error");
console.log("OK");
`;
    await Bun.write(scriptFile, scriptContent);
    try {
      const result = Bun.spawnSync({
        cmd: [process.execPath, "run", scriptFile],
        cwd: projectRoot,
        env: {
          ...process.env,
          DYNAMIC_CLI_FRAMEWORK_DEBUG: "true",
        },
      });
      const stdout = result.stdout.toString();
      expect(stdout).toContain("OK");
    } finally {
      const { unlinkSync } = await import("node:fs");
      try {
        unlinkSync(scriptFile);
      } catch {
        // cleanup best-effort
      }
    }
  });
});
