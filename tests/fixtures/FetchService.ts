import type { FetchOptions, FetchService } from "@flowscripter/dynamic-cli-framework-api";

export function getFetchService(
  handler: (input: string | URL, options?: FetchOptions) => Response | Promise<Response>,
): FetchService {
  return {
    fetch: (input, options) => Promise.resolve(handler(input, options)),
  };
}
