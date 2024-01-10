import ShutdownService from "../../api/service/core/ShutdownService.ts";

export default class DefaultShutdownService implements ShutdownService {
  static readonly callbacks: Array<() => void> = [];

  addShutdownListener(callback: () => void): void {
    DefaultShutdownService.callbacks.push(callback);
  }
}
