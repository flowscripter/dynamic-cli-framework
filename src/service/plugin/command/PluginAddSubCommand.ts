import type { SubCommand } from "@flowscripter/dynamic-cli-framework-api";
import type { Context } from "@flowscripter/dynamic-cli-framework-api";
import type { Values } from "@flowscripter/dynamic-cli-framework-api";
import { ValueTypeName } from "@flowscripter/dynamic-cli-framework-api";
import type { PrinterService } from "@flowscripter/dynamic-cli-framework-api";
import { Icon, PRINTER_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import { PLUGIN_SERVICE_ID } from "@flowscripter/dynamic-cli-framework-api";
import type { PluginService } from "@flowscripter/dynamic-cli-framework-api";
import type { VersionedPluginDescriptor } from "@flowscripter/dynamic-plugin-framework";
import { getPluginId } from "./getPluginId.ts";
import { parsePluginSpecifier } from "./parsePluginSpecifier.ts";

export class PluginAddSubCommand implements SubCommand {
  readonly name = "add";
  readonly description = "Install a remote plugin";
  readonly enableConfiguration = false;
  readonly options = [];
  readonly positionals = [
    {
      name: "pluginId",
      description: "Plugin ID to install (e.g. @scope/name or @scope/name@version)",
      type: ValueTypeName.STRING,
    },
  ];

  async execute(context: Context, argumentValues: Values): Promise<void> {
    const printerService = context.getServiceById(PRINTER_SERVICE_ID) as PrinterService;
    const pluginService = context.getServiceById(PLUGIN_SERVICE_ID) as PluginService;

    const { pluginId, version } = parsePluginSpecifier(argumentValues["pluginId"] as string);
    const searchLabel = version ? `${pluginId}@${version}` : pluginId;
    await printerService.showSpinner(`Searching for plugin: ${searchLabel}`);

    let descriptor: VersionedPluginDescriptor | undefined;
    for await (const d of pluginService.search({ text: pluginId })) {
      if (getPluginId(d) === pluginId || d.pluginId === pluginId) {
        descriptor = d;
        break;
      }
    }
    await printerService.hideSpinner();

    if (descriptor && version) {
      // search only ever returns the latest version - substitute the explicitly requested
      // version so install() is asked for the correct one.
      descriptor = { ...descriptor, version };
    }

    if (!descriptor) {
      // Search did not find an exact match - attempt direct install by plugin ID.
      // This handles cases where the package exists on the registry but is not
      // returned by search (e.g. recently published or low search ranking).
      await printerService.info(
        `Plugin not found via search, attempting direct install of ${searchLabel}...\n`,
        Icon.INFORMATION,
      );
      const parts = pluginId.startsWith("@") ? pluginId.slice(1).split("/") : [undefined, pluginId];
      const scope = pluginId.startsWith("@") ? `@${parts[0]}` : undefined;
      const name = pluginId.startsWith("@") ? parts[1]! : pluginId;
      descriptor = {
        pluginId,
        scope,
        name,
        version: version ?? "latest",
        extensionPoints: [],
      };
    }

    const installLabel =
      descriptor.version && descriptor.version !== "latest"
        ? `${descriptor.pluginId}@${descriptor.version}`
        : descriptor.pluginId;

    // Confirm the package (and specific version/tag, if requested) actually exists on the
    // remote marketplace before invoking the package manager - so a non-existent plugin or
    // version is reported clearly instead of failing later (and less clearly) inside
    // `bun add`/`npm install`.
    const versionToCheck = descriptor.version === "latest" ? undefined : descriptor.version;
    if (!(await pluginService.checkAvailable(descriptor.pluginId, versionToCheck))) {
      throw new Error(
        versionToCheck
          ? `Version ${versionToCheck} of plugin ${descriptor.pluginId} was not found in the configured plugin registry`
          : `Plugin ${descriptor.pluginId} was not found in the configured plugin registry`,
      );
    }

    await printerService.showSpinner(`Installing ${installLabel}...`);
    await pluginService.install(descriptor);

    // Look up the actually-installed version rather than trusting `descriptor.version`: when no
    // version was requested and the plugin wasn't found via search (direct-install fallback),
    // `descriptor.version` is still the literal placeholder "latest", not a real version number.
    let installedVersion = descriptor.version;
    for await (const installed of pluginService.listInstalled()) {
      if (installed.pluginId === descriptor.pluginId) {
        installedVersion = installed.version;
        break;
      }
    }
    await printerService.hideSpinner();

    await printerService.print(
      `Plugin ${descriptor.pluginId}@${installedVersion} installed.\n`,
      Icon.SUCCESS,
    );
  }
}
