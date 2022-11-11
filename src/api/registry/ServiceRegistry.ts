import Service from "../service/Service.ts";

/**
 * Interface used by a {@link CLI} to register {@link Service} instances.
 */
export default interface ServiceRegistry {
  /**
   * Return all {@link Service} instances registered in order of descending {@link Service.initPriority}
   */
  getServices(): ReadonlyArray<Service>;

  /**
   * Return the specified {@link Service}.
   *
   * @param id the ID of the {@link Service} to retrieve.
   */
  getServiceById(id: string): Service | undefined;
}
