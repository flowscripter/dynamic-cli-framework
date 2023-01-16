import { log } from "../../deps.ts";

let defaultLogger: log.Logger | undefined;

if (defaultLogger === undefined) {
  defaultLogger = await setupLogger();
}

async function setupLogger() {
  await log.setup({
    handlers: {
      console: new log.handlers.ConsoleHandler(
        (Deno.env.get("CLI_DEBUG") !== undefined) ? "DEBUG" : "ERROR",
        {
          formatter: "{levelName} [{loggerName}] {msg}",
        },
      ),
    },

    loggers: {
      default: {
        handlers: ["console"],
      },
    },
  });

  return log.getLogger();
}

export default function getLogger(name: string): log.Logger {
  const logger = log.getLogger(name);
  logger.level = log.LogLevels.DEBUG;
  logger.handlers.push(...log.getLogger().handlers);

  return logger;
}
