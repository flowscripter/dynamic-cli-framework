import { describe, it } from "../test_deps.ts";
import getLogger from "../../src/util/logger.ts";

describe("Logger", () => {
  it("Can acquire a logger", () => {
    const logger = getLogger("logger test");

    logger.debug("foobar");
  });
});
