import type { FetchService } from "@flowscripter/dynamic-cli-framework-api";
import type { FetchInterface } from "@flowscripter/dynamic-plugin-framework";

export interface FetchInterfaceAdapterOptions {
  timeoutMs?: number;
}

/**
 * Adapts a {@link FetchService} to dynamic-plugin-framework's {@link FetchInterface}, so plugin
 * manager/repository fetches respect the host CLI's shutdown handling and default timeout.
 */
export default class FetchInterfaceAdapter implements FetchInterface {
  readonly #fetchService: FetchService;
  readonly #timeoutMs: number | undefined;

  public constructor(fetchService: FetchService, options: FetchInterfaceAdapterOptions = {}) {
    this.#fetchService = fetchService;
    this.#timeoutMs = options.timeoutMs;
  }

  public async fetch(
    input: string,
    init?: RequestInit & { timeoutMs?: number },
  ): Promise<Response> {
    const { timeoutMs = this.#timeoutMs, ...requestInit } = init ?? {};
    return this.#fetchService.fetch(input, { ...requestInit, timeoutMs });
  }
}
