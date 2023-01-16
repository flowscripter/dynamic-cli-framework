export const LIFECYCLE_SERVICE_ID =
  "@flowscripter/dynamic-cli-framework/lifecyle";

/**
 * Interface allowing registration of callbacks for CLI lifecycle events.
 */
export default interface Lifecycle {
  /**
   * Register a callback method for CLI shutdown.
   */
  addShutdownListener(callback: () => void): void;
}
