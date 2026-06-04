import type ShutdownService from "../../api/service/core/ShutdownService.ts";
import { shutdownState } from "./ShutdownState.ts";

export default class DefaultShutdownService implements ShutdownService {
  static readonly callbacks: Array<() => Promise<void>> = [];

  addShutdownListener(callback: () => Promise<void>): void {
    DefaultShutdownService.callbacks.push(callback);
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
