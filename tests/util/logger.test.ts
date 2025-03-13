import { describe, test } from "bun:test";
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
});
