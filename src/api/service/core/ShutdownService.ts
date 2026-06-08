export const SHUTDOWN_SERVICE_ID = "@flowscripter/dynamic-cli-framework/shutdown-service";

/**
 * Service allowing registration of callbacks for CLI shutdown.
 */
export default interface ShutdownService {
  /**
   * Register a callback to be invoked during graceful shutdown.
   */
  addShutdownListener(callback: () => Promise<void>): void;

  /**
   * Enter long-running mode where the first Ctrl-C sets a cooperative flag
   * instead of exiting, and a third Ctrl-C forces exit.
   */
  enterLongRunningMode(): void;

  /**
   * Leave long-running mode, restoring default single Ctrl-C exit behavior.
   */
  leaveLongRunningMode(): void;

  /**
   * True once shutdown has been requested (e.g. first Ctrl-C in long-running mode).
   */
  readonly isShutdownRequested: boolean;
}
