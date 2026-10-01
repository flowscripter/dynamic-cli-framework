/**
 * Priorities of the framework's built-in service providers, startup tasks and shutdown tasks.
 * Higher values run earlier (see {@link sortByPriority}). Service provider priorities also order
 * their `initService()` calls within the startup sequence: when a provider and a directly
 * registered startup task share a priority, the provider runs first.
 *
 * Consumer service providers and startup tasks (e.g. the banner task) choose their own
 * priorities relative to these.
 */

/** Shutdown service provider: first, so signal handling is in place before anything else. */
export const SHUTDOWN_SERVICE_PRIORITY = 100;

/** Startup service provider: no ordering dependency, as its `initService()` is a no-op. */
export const STARTUP_SERVICE_PRIORITY = 95;

/** Configuration service provider: reads the config file in its `initService()`. */
export const CONFIGURATION_SERVICE_PRIORITY = 90;

/** Key-value service provider: just below configuration, whose config-file read it depends on. */
export const KEY_VALUE_SERVICE_PRIORITY = 89;

/** Printer service provider. */
export const PRINTER_SERVICE_PRIORITY = 80;

/** Prompter service provider. */
export const PROMPTER_SERVICE_PRIORITY = 75;

/** Table generator service provider. */
export const TABLE_GENERATOR_SERVICE_PRIORITY = 70;

/** Argument prompter service provider: below the prompter it uses. */
export const ARGUMENT_PROMPTER_SERVICE_PRIORITY = 65;

/** Spawn service provider. */
export const SPAWN_SERVICE_PRIORITY = 58;

/** Fetch service provider. */
export const FETCH_SERVICE_PRIORITY = 57;

/** Upgrade service provider: below the spawn and fetch services it uses. */
export const UPGRADE_SERVICE_PRIORITY = 56;

/** Background startup task which refreshes the cached upgrade check result. */
export const UPGRADE_CHECK_STARTUP_TASK_PRIORITY = 56;

/** Image printer service provider. */
export const IMAGE_PRINTER_SERVICE_PRIORITY = 55;

/** Plugin service provider. */
export const PLUGIN_SERVICE_PRIORITY = 50;

/**
 * Startup task which prompts to enable automatic upgrades and performs them. It runs below
 * consumer startup tasks such as the banner (typically 45 or more) and above the completion
 * prompt.
 */
export const AUTO_UPGRADE_STARTUP_TASK_PRIORITY = 10;

/** Completion service provider, whose `initService()` prompts to enable shell completion. */
export const COMPLETION_SERVICE_PRIORITY = 5;

/** Shutdown tasks which clean up in-flight work (spinners, progress bars, spawns, fetches). */
export const CLEANUP_SHUTDOWN_TASK_PRIORITY = 0;

/** Shutdown task which flushes key-value data to the config file, after all other cleanup. */
export const KEY_VALUE_FLUSH_SHUTDOWN_TASK_PRIORITY = -100;
