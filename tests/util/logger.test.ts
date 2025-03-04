import { describe, test } from "bun:test";
import getLogger from "../../src/util/logger.ts";

describe("logger Tests", () => {
  test("Can acquire a logger", () => {
    const logger = getLogger("logger test");

    logger.debug("foobar");
  });
});
