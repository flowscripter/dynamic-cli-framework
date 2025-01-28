import type ShutdownService from "../../api/service/core/ShutdownService.ts";

export default class DefaultShutdownService implements ShutdownService {
  static readonly callbacks: Array<() => Promise<void>> = [];

  addShutdownListener(callback: () => Promise<void>): void {
    DefaultShutdownService.callbacks.push(callback);
  }
}
