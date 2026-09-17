import type { ServiceProvider, StartupTask } from "@flowscripter/dynamic-cli-framework-api";

/**
 * A consumer-facing registration item accepted by {@link launchMultiCommandCLI}/
 * {@link launchSingleCommandCLI}'s `serviceProviders` array: either a full {@link ServiceProvider}
 * or a plain {@link StartupTask} (e.g. a task built by `createBannerStartupTask()`).
 */
export type ServiceProviderOrStartupTask = ServiceProvider | StartupTask;

/**
 * Distinguish a {@link StartupTask} from a {@link ServiceProvider} in a
 * {@link ServiceProviderOrStartupTask} - a {@link StartupTask} has a `run()` method and no
 * `initService()`/`getServiceInfo()` methods.
 */
export function isStartupTask(value: ServiceProviderOrStartupTask): value is StartupTask {
  return typeof (value as StartupTask).run === "function";
}
