import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import DefaultFetchService from "../../../src/service/fetch/DefaultFetchService.ts";
import type { ShutdownService } from "@flowscripter/dynamic-cli-framework-api";

interface FakeShutdownServiceState {
  enterLongRunningModeCalls: number;
  leaveLongRunningModeCalls: number;
  listeners: Array<() => Promise<void>>;
}

function getFakeShutdownService(): {
  shutdownService: ShutdownService;
  state: FakeShutdownServiceState;
} {
  const state: FakeShutdownServiceState = {
    enterLongRunningModeCalls: 0,
    leaveLongRunningModeCalls: 0,
    listeners: [],
  };
  const shutdownService: ShutdownService = {
    addShutdownListener: (callback) => {
      state.listeners.push(callback);
    },
    enterLongRunningMode: () => {
      state.enterLongRunningModeCalls++;
    },
    leaveLongRunningMode: () => {
      state.leaveLongRunningModeCalls++;
    },
    isShutdownRequested: false,
  };
  return { shutdownService, state };
}

describe("DefaultFetchService tests", () => {
  let server: ReturnType<typeof Bun.serve>;
  let baseUrl: string;

  beforeEach(() => {
    server = Bun.serve({
      port: 0,
      fetch: (request) => {
        const url = new URL(request.url);
        if (url.pathname === "/slow") {
          return new Promise(() => {});
        }
        if (url.pathname === "/echo-method") {
          return new Response(request.method);
        }
        return new Response("ok");
      },
    });
    baseUrl = `http://localhost:${server.port}`;
  });

  afterEach(() => {
    server.stop(true);
  });

  test("fetch() throws if called before setDependencies()", () => {
    const service = new DefaultFetchService();

    expect(service.fetch(baseUrl)).rejects.toThrow(
      "DefaultFetchService.fetch() called before setDependencies()",
    );
  });

  test("fetch() resolves the Response for a successful request", async () => {
    const service = new DefaultFetchService();
    const { shutdownService } = getFakeShutdownService();
    service.setDependencies(shutdownService);

    const response = await service.fetch(baseUrl);

    expect(response.ok).toBe(true);
    expect(await response.text()).toEqual("ok");
  });

  test("fetch() passes through RequestInit fields such as method", async () => {
    const service = new DefaultFetchService();
    const { shutdownService } = getFakeShutdownService();
    service.setDependencies(shutdownService);

    const response = await service.fetch(`${baseUrl}/echo-method`, { method: "POST" });

    expect(await response.text()).toEqual("POST");
  });

  test("fetch() rejects with a TimeoutError DOMException when timeoutMs elapses", async () => {
    const service = new DefaultFetchService();
    const { shutdownService } = getFakeShutdownService();
    service.setDependencies(shutdownService);

    await expect(service.fetch(`${baseUrl}/slow`, { timeoutMs: 50 })).rejects.toMatchObject({
      name: "TimeoutError",
    });
  });

  test("fetch() does not enter long-running mode by default", async () => {
    const service = new DefaultFetchService();
    const { shutdownService, state } = getFakeShutdownService();
    service.setDependencies(shutdownService);

    await service.fetch(baseUrl);

    expect(state.enterLongRunningModeCalls).toEqual(0);
    expect(state.listeners.length).toEqual(0);
  });

  test("fetch() enters and leaves long-running mode and registers a shutdown listener when longRunning is true", async () => {
    const service = new DefaultFetchService();
    const { shutdownService, state } = getFakeShutdownService();
    service.setDependencies(shutdownService);

    await service.fetch(baseUrl, { longRunning: true });

    expect(state.enterLongRunningModeCalls).toEqual(1);
    expect(state.leaveLongRunningModeCalls).toEqual(1);
    expect(state.listeners.length).toEqual(1);
  });

  test("shutdown listener aborts an in-flight longRunning fetch with an AbortError", async () => {
    const service = new DefaultFetchService();
    const { shutdownService, state } = getFakeShutdownService();
    service.setDependencies(shutdownService);

    const pending = service.fetch(`${baseUrl}/slow`, { longRunning: true });
    // Wait for the fetch to register its shutdown listener before invoking it.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(state.listeners.length).toEqual(1);
    await state.listeners[0]!();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
