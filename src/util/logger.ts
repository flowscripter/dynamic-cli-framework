import * as log from "@std/log";
import { sprintf } from "@std/fmt/printf";
import { getEnvVarIfPermitted } from "./envVarHelper.ts";

let defaultLogger: log.Logger | undefined;

if (defaultLogger === undefined) {
  defaultLogger = await setupLogger();
}

async function setupLogger() {
  log.setup({
    handlers: {
      console: new log.ConsoleHandler(
        (await getEnvVarIfPermitted("CLI_DEBUG") !== undefined)
          ? "DEBUG"
          : "ERROR",
        {
          formatter: (logRecord) => {
            const { msg, args, levelName, loggerName } = logRecord;
            if (args.length === 0) {
              return `${levelName} [${loggerName}] ${msg}`;
            }
            return `${levelName} [${loggerName}] ${sprintf(msg, ...args)}`;
          },
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
