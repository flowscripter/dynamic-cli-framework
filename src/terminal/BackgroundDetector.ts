import type { Buffer } from "node:buffer";

const OSC_11_QUERY = "\x1b]11;?\x1b\\";
const DA1_QUERY = "\x1b[c";
const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(0x07);
const OSC_11_REPLY = new RegExp(
  `${ESC}\\]11;rgb:([0-9a-fA-F]{1,4})/([0-9a-fA-F]{1,4})/([0-9a-fA-F]{1,4})(?:${BEL}|${ESC}\\\\)`,
);
const DA1_REPLY = new RegExp(`${ESC}\\[\\?[0-9;]*c`);

export const DEFAULT_DETECTION_TIMEOUT_MS = 150;

export interface DetectionInput {
  isTTY?: boolean;
  isRaw?: boolean;
  setRawMode?(mode: boolean): unknown;
  isPaused?(): boolean;
  resume(): unknown;
  pause(): unknown;
  on(event: "data", listener: (data: Buffer | string) => void): unknown;
  removeListener(event: "data", listener: (data: Buffer | string) => void): unknown;
}

export interface DetectionOutput {
  isTTY?: boolean;
  write(data: string): unknown;
}

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

function queryTerminal(
  input: DetectionInput,
  output: DetectionOutput,
  timeoutMs: number,
): Promise<boolean | undefined> {
  const wasRaw = input.isRaw === true;
  const wasPaused = input.isPaused?.() ?? false;

  return new Promise((resolve) => {
    let received = "";
    let timer: ReturnType<typeof setTimeout>;

    const finish = (): void => {
      clearTimeout(timer);
      input.removeListener("data", onData);
      if (!wasRaw) {
        input.setRawMode?.(false);
      }
      if (wasPaused) {
        input.pause();
      }
      resolve(parseOsc11Reply(received));
    };

    const onData = (data: Buffer | string): void => {
      received += data.toString();
      if (DA1_REPLY.test(received)) {
        finish();
      }
    };

    try {
      input.setRawMode?.(true);
      input.on("data", onData);
      input.resume();
      timer = setTimeout(finish, timeoutMs);
      output.write(OSC_11_QUERY + DA1_QUERY);
    } catch {
      finish();
    }
  });
}

/**
 * Detect whether the terminal background is dark.
 *
 * Checks COLORFGBG first and then queries the terminal for its background colour (OSC 11).
 * The query is skipped unless both the input and output are TTYs and is bounded by a timeout.
 *
 * @returns `true` for a dark background, `false` for a light background or `undefined` if not determinable.
 */
export async function detectDarkBackground(
  input: DetectionInput,
  output: DetectionOutput,
  env: Record<string, string | undefined>,
  timeoutMs: number = DEFAULT_DETECTION_TIMEOUT_MS,
): Promise<boolean | undefined> {
  if (input.isTTY !== true || output.isTTY !== true || env.TERM === "dumb") {
    return undefined;
  }
  const fromEnv = parseColorFgBg(env.COLORFGBG);
  if (fromEnv !== undefined) {
    return fromEnv;
  }
  return await queryTerminal(input, output, timeoutMs);
}
