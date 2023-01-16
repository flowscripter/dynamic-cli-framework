import Service from "../service/Service.ts";

/**
 * Interface used by a {@link CLI} to register {@link Service} instances.
 */
export default interface ServiceRegistry {
  /**
   * Return all {@link Service} instances registered in order of descending {@link Service.initPriority}
   */
  getServices(): ReadonlyArray<Service>;
}
