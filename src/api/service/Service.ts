/**
 * Interface for a service.
 */
export default interface Service {
  /**
   * The ID for the service.
   */
  readonly id: string;

  /**
   * Used to determine the order in which multiple service instances will be initialised. Higher values
   * will run before lower values.
   */
  readonly initPriority: number;

  /**
   * Initialise the service.
   */
  init(): Promise<void> | void;
}
