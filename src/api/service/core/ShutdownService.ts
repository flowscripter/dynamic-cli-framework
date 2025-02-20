export const SHUTDOWN_SERVICE_ID =
  "@flowscripter/dynamic-cli-framework/shutdown-service";

/**
 * Service allowing registration of callbacks for CLI shutdown.
 */
export default interface ShutdownService {
  /**
   * Register a callback method for CLI shutdown.
   */
  addShutdownListener(callback: () => Promise<void>): void;
}
