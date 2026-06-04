import process from "node:process";
import type { WriteStream } from "node:tty";

function parseVersion(versionString = ""): {
  major: number;
  minor: number;
  patch: number;
} {
  if (/^\d{3,4}$/.test(versionString)) {
    const match = /(\d{1,2})(\d{2})/.exec(versionString) ?? [];
    return {
      major: 0,
      minor: Number.parseInt(match[1] ?? "0", 10),
      patch: Number.parseInt(match[2] ?? "0", 10),
    };
  }

  const versions = (versionString ?? "").split(".").map((n) =>
    Number.parseInt(n, 10)
  );
  return {
    major: versions[0] ?? 0,
    minor: versions[1] ?? 0,
    patch: versions[2] ?? 0,
  };
}

export default function supportsHyperlinks(
  stream: WriteStream | undefined,
): boolean {
  const {
    CI,
    CURSOR_TRACE_ID,
    FORCE_HYPERLINK,
    TEAMCITY_VERSION,
    TERM_PROGRAM,
    TERM_PROGRAM_VERSION,
    VTE_VERSION,
    TERM,
  } = process.env;

  if (FORCE_HYPERLINK) {
    return !(FORCE_HYPERLINK.length > 0 &&
      Number.parseInt(FORCE_HYPERLINK, 10) === 0);
  }

  if (stream && !stream.isTTY) {
    return false;
  }

  if ("WT_SESSION" in process.env) {
    return true;
  }

  if (process.platform === "win32") {
    return false;
  }

  if (CI) {
    return false;
  }

  if (TEAMCITY_VERSION) {
    return false;
  }

  if (TERM_PROGRAM) {
    const version = parseVersion(TERM_PROGRAM_VERSION);

    switch (TERM_PROGRAM) {
      case "iTerm.app": {
        if (version.major === 3) {
          return version.minor >= 1;
        }
        return version.major > 3;
      }
      case "WezTerm": {
        if (/^0-unstable-\d{4}-\d{2}-\d{2}$/.test(TERM_PROGRAM_VERSION!)) {
          const date = TERM_PROGRAM_VERSION!.slice("0-unstable-".length);
          return date >= "2020-06-20";
        }
        return version.major >= 20200620;
      }
      case "vscode": {
        if (CURSOR_TRACE_ID) {
          return true;
        }
        return version.major > 1 ||
          (version.major === 1 && version.minor >= 72);
      }
      case "ghostty":
        return true;
      case "zed":
        return true;
    }
  }

  if (VTE_VERSION) {
    if (VTE_VERSION === "0.50.0") {
      return false;
    }
    const version = parseVersion(VTE_VERSION);
    return version.major > 0 || version.minor >= 50;
  }

  switch (TERM) {
    case "alacritty":
      return true;
    case "xterm-kitty":
      return true;
  }

  return false;
}
