import type { ShutdownService, ShutdownTask } from "@flowscripter/dynamic-cli-framework-api";
import PriorityTaskList from "../../runtime/lifecycle/PriorityTaskList.ts";
import { shutdownState } from "./ShutdownState.ts";

export default class DefaultShutdownService implements ShutdownService {
  static readonly taskList = new PriorityTaskList<ShutdownTask>();

  registerTask(task: ShutdownTask): void {
    DefaultShutdownService.taskList.add(task);
  }

  enterLongRunningMode(): void {
    shutdownState.longRunningMode = true;
  }

  leaveLongRunningMode(): void {
    shutdownState.longRunningMode = false;
  }

  get isShutdownRequested(): boolean {
    return shutdownState.shutdownRequested;
  }
}
