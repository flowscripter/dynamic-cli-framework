import type Context from "../api/Context.ts";
import type CLIConfig from "../api/CLIConfig.ts";

/**
 * Default implementation of a {@link Context}.
 */
export default class DefaultContext implements Context {
  readonly #serviceInstancesById: Map<string, unknown> = new Map();

  public constructor(readonly cliConfig: CLIConfig) {
  }

  public addServiceInstance(id: string, serviceInstance: unknown) {
    if (this.#serviceInstancesById.has(id)) {
      throw new Error(
        `Service ID: ${id} duplicates the ID of an existing service`,
      );
    }
    this.#serviceInstancesById.set(id, serviceInstance);
  }

  public getServiceById(id: string): unknown {
    if (!this.#serviceInstancesById.has(id)) {
      throw new Error(`Service with ID: ${id} does not exist`);
    }
    return this.#serviceInstancesById.get(id);
  }

  public doesServiceExist(id: string): boolean {
    return this.#serviceInstancesById.has(id);
  }
}
