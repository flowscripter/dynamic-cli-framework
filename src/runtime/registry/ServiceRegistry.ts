import ServiceProvider from "../../api/service/ServiceProvider.ts";
// TODO: 11: move out of API
/**
 * Interface used by a {@link CLI} to register {@link ServiceProvider} instances.
 */
export default interface ServiceRegistry {
  /**
   * Return all {@link ServiceProvider} instances registered in order of descending {@link ServiceProvider.initPriority}
   */
  getServices(): ReadonlyArray<ServiceProvider>;
}
