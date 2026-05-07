import process from "node:process";

type LoggerFunction = (
  message: object | (() => string) | string,
  ...optionalParams: unknown[]
) => void;

export interface Logger {
  trace: LoggerFunction;
  debug: LoggerFunction;
  info: LoggerFunction;
  warn: LoggerFunction;
  error: LoggerFunction;
}

const LEVEL_PADDINGS: Record<string, string> = {
  TRACE: "    ",
  DEBUG: "    ",
  INFO: "     ",
  WARN: "     ",
  ERROR: "    ",
};

const debugEnabled = process.env["DYNAMIC_CLI_FRAMEWORK_DEBUG"] !== undefined;

let maxLoggerNameLength = 0;

const LOGGER_NAME_PADDINGS: Record<string, string> = {};

function getDefaultLogger(): Logger {
  return {
    trace: () => {},
    debug: (message, ...optionalParams) => {
      console.debug(message, ...optionalParams);
    },
    info: (message, ...optionalParams) => {
      console.info(message, ...optionalParams);
    },
    warn: (message, ...optionalParams) => {
      console.warn(message, ...optionalParams);
    },
    error: (message, ...optionalParams) => {
      console.error(message, ...optionalParams);
    },
  };
}

function wrapDefaultLogger(
  loggerName: string,
  levelPadding: string,
  loggerFunction: LoggerFunction,
): LoggerFunction {
  return (message, ...optionalParams) => {
    if (message instanceof Function) {
      loggerFunction(
        `${levelPadding} [${loggerName}]${
          LOGGER_NAME_PADDINGS[loggerName]
        } ${message()}`,
        ...optionalParams,
      );
      return;
    }
    if (message instanceof Object) {
      loggerFunction(
        `${levelPadding} [${loggerName}]${LOGGER_NAME_PADDINGS[loggerName]} ${
          JSON.stringify(message)
        }`,
        ...optionalParams,
      );
      return;
    }
    loggerFunction(
      `${levelPadding} [${loggerName}]${
        LOGGER_NAME_PADDINGS[loggerName]
      } ${message}`,
      ...optionalParams,
    );
  };
}

/**
 * Retrieves a logger instance with the specified name. If the name length exceeds the current maximum logger name length,
 * it updates the padding for all existing logger names to ensure consistent formatting.
 *
 * @param loggerName The name of the logger to retrieve.
 * @returns A logger instance with the specified name.
 */
export default function getLogger(loggerName: string): Logger {
  const g = globalThis as Record<string, unknown>;
  if (g.defaultLogger === undefined) {
    g.defaultLogger = getDefaultLogger();
  }
  const defaultLogger = g.defaultLogger as Logger;

  if (loggerName.length > maxLoggerNameLength) {
    maxLoggerNameLength = loggerName.length;

    for (const key of Object.keys(LOGGER_NAME_PADDINGS)) {
      LOGGER_NAME_PADDINGS[key] = " ".repeat(maxLoggerNameLength - key.length);
    }

    LOGGER_NAME_PADDINGS[loggerName] = "";
  } else if (LOGGER_NAME_PADDINGS[loggerName] === undefined) {
    LOGGER_NAME_PADDINGS[loggerName] = " ".repeat(
      maxLoggerNameLength - loggerName.length,
    );
  }

  if (debugEnabled) {
    return {
      trace: wrapDefaultLogger(
        loggerName,
        LEVEL_PADDINGS.TRACE!,
        defaultLogger.trace,
      ),
      debug: wrapDefaultLogger(
        loggerName,
        LEVEL_PADDINGS.DEBUG!,
        defaultLogger.debug,
      ),
      info: wrapDefaultLogger(
        loggerName,
        LEVEL_PADDINGS.INFO!,
        defaultLogger.info,
      ),
      warn: wrapDefaultLogger(
        loggerName,
        LEVEL_PADDINGS.WARN!,
        defaultLogger.warn,
      ),
      error: wrapDefaultLogger(
        loggerName,
        LEVEL_PADDINGS.ERROR!,
        defaultLogger.error,
      ),
    };
  }
  return {
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: wrapDefaultLogger(
      loggerName,
      LEVEL_PADDINGS.ERROR!,
      defaultLogger.error,
    ),
  };
}
