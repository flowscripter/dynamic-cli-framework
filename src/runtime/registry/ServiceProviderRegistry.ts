import type { ServiceProvider } from "../../api/service/ServiceProvider.ts";

/**
 * Interface used by a {@link CLI} to register {@link ServiceProvider} instances.
 */
export default interface ServiceProviderRegistry {
  /**
   * Return all {@link ServiceProvider} instances registered in order of descending {@link ServiceProvider.servicePriority}
   */
  getServiceProviders(): ReadonlyArray<ServiceProvider>;
}
