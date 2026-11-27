import process from "node:process";
import type KeyReader from "./KeyReader.ts";
import type Terminal from "./Terminal.ts";
import { BEL, ESC, QUERY_BACKGROUND_COLOR, QUERY_DEVICE_ATTRIBUTES } from "./Ansi.ts";
import getLogger from "../util/logger.ts";

const logger = getLogger("BackgroundDetector");

const OSC_11_REPLY = new RegExp(
  `${ESC}\\]11;rgb:([0-9a-fA-F]{1,4})/([0-9a-fA-F]{1,4})/([0-9a-fA-F]{1,4})(?:${BEL}|${ESC}\\\\)`,
);
const DA1_REPLY = new RegExp(`${ESC}\\[\\?[0-9;]*c`);

export const DEFAULT_DETECTION_TIMEOUT_MS = 150;

/**
 * Parse the COLORFGBG environment variable value into a dark background flag.
 *
 * @returns `true` for a dark background, `false` for a light background or `undefined` if not determinable.
 */
export function parseColorFgBg(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parts = value.split(";");
  const background = parts[parts.length - 1]!;
  if (!/^\d{1,2}$/.test(background)) {
    return undefined;
  }
  const index = Number(background);
  if (index > 15) {
    return undefined;
  }
  return index <= 6 || index === 8;
}

/**
 * Parse an OSC 11 background colour reply into a dark background flag.
 *
 * @returns `true` for a dark background, `false` for a light background or `undefined` if no reply is present.
 */
export function parseOsc11Reply(data: string): boolean | undefined {
  const match = OSC_11_REPLY.exec(data);
  if (match === null) {
    return undefined;
  }
  const [r, g, b] = [match[1]!, match[2]!, match[3]!].map(
    (channel) => parseInt(channel, 16) / (16 ** channel.length - 1),
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5;
}

/**
 * Detect whether the terminal background is dark.
 *
 * Queries the terminal for its background colour (OSC 11) and falls back to COLORFGBG if the terminal
 * does not answer. The query reflects the current background, whereas COLORFGBG is set when the terminal
 * session starts and may no longer match it. Detection is skipped unless the terminal is a TTY and the
 * query is bounded by a timeout.
 *
 * @returns `true` for a dark background, `false` for a light background or `undefined` if not determinable.
 */
export async function detectDarkBackground(
  keyReader: KeyReader,
  terminal: Terminal,
  env: Record<string, string | undefined> = process.env,
  timeoutMs: number = DEFAULT_DETECTION_TIMEOUT_MS,
): Promise<boolean | undefined> {
  if (!terminal.isTty() || env.TERM === "dumb") {
    logger.debug("Skipping background detection: terminal is not a TTY or TERM is dumb");
    return undefined;
  }
  let reply = "";
  try {
    const pendingReply = keyReader.readRaw((received) => DA1_REPLY.test(received), timeoutMs);
    await terminal.write(QUERY_BACKGROUND_COLOR + QUERY_DEVICE_ATTRIBUTES);
    reply = await pendingReply;
  } catch (error) {
    logger.debug("Background colour query failed: %s", error);
  }
  const fromQuery = parseOsc11Reply(reply);
  logger.debug(
    () => `Background colour query reply: ${JSON.stringify(reply)}, dark background: ${fromQuery}`,
  );
  if (fromQuery !== undefined) {
    return fromQuery;
  }
  const fromEnv = parseColorFgBg(env.COLORFGBG);
  logger.debug(() => `COLORFGBG: ${JSON.stringify(env.COLORFGBG)}, dark background: ${fromEnv}`);
  return fromEnv;
}
