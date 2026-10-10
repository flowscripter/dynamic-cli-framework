// Runs a BaseCLI with a background startup task in its own process, since shutdown only flushes
// once per process. Usage: bun backgroundTaskCli.ts <configLocation> <taskId> <delayMs|never> <exitRequest|none> [cli args...]
import process from "node:process";
import { KEY_VALUE_SERVICE_ID, RunState } from "@flowscripter/dynamic-cli-framework-api";
import type { KeyValueService } from "@flowscripter/dynamic-cli-framework-api";
import BaseCLI from "../../src/cli/BaseCLI.ts";
import TtyTerminal from "../../src/terminal/TtyTerminal.ts";
import TtyStyler from "../../src/terminal/TtyStyler.ts";
import { getCLIConfig } from "./CLIConfig.ts";
import StreamString from "./StreamString.ts";
import { getSubCommand } from "./Command.ts";

const [configLocation, taskId, delay, exitRequest, ...cliArgs] = process.argv.slice(2) as [
  string,
  string,
  string,
  string,
  ...string[],
];

const stdout = new StreamString();
const stderr = new StreamString();
const baseCLI = new BaseCLI(
  getCLIConfig(),
  stdout.writableStream,
  stderr.writableStream,
  false,
  false,
  new TtyTerminal(stdout.writeStream),
  new TtyTerminal(stderr.writeStream),
  new TtyStyler(3),
  { enableRawMode() {}, disableRawMode() {}, readKey: () => Promise.resolve({}) },
  { configFileSupportEnabled: true, keyValueServiceEnabled: true },
);

baseCLI.addStartupTask({
  id: taskId,
  priority: 50,
  mode: "background",
  run: async (context) => {
    if (delay === "never") {
      await new Promise<void>(() => {});
    }
    await new Promise<void>((resolve) => setTimeout(resolve, Number(delay)));
    await (context.getServiceById(KEY_VALUE_SERVICE_ID) as KeyValueService).set("written", true);
  },
});
if (exitRequest === "exitRequest") {
  baseCLI.addStartupTask({
    id: "exit-task",
    priority: 10,
    run: () => Promise.resolve({ exitRequest: { runState: RunState.NO_COMMAND } }),
  });
}
const command = getSubCommand("command", [], []);
const failing = getSubCommand("fail", [], []);
failing.execute = () => Promise.reject(new Error("command failed"));
baseCLI.addCommand(command);
baseCLI.addCommand(failing);

const start = performance.now();
const runResult = await baseCLI.run(["--config", configLocation, ...cliArgs]);
process.stdout.write(
  JSON.stringify({ runState: runResult.runState, elapsed: performance.now() - start }),
);
