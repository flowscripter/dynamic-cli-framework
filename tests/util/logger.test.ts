import getLogger from "../../src/util/logger.ts";

Deno.test("Can acquire a logger", () => {
  const logger = getLogger("logger test");

  logger.debug("foobar");
});
