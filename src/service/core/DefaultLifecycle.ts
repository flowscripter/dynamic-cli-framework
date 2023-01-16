import Lifecycle from "../../api/service/core/Lifecycle.ts";

export default class DefaultLifecycle implements Lifecycle {
  static readonly callbacks: Array<() => void> = [];

  constructor() {
    Deno.addSignalListener("SIGINT", DefaultLifecycle.shutdown);
    window.onunload = DefaultLifecycle.shutdown;
  }

  addShutdownListener(callback: () => void): void {
    DefaultLifecycle.callbacks.push(callback);
  }

  static shutdown() {
    DefaultLifecycle.callbacks.forEach((callback) => callback());
    Deno.removeSignalListener("SIGINT", DefaultLifecycle.shutdown);
  }
}
