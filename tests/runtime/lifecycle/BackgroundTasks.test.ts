import path from "node:path";
import { describe, expect, test } from "bun:test";
import {
  awaitBackgroundTasks,
  BACKGROUND_TASK_GRACE_PERIOD_MS,
  trackBackgroundTask,
} from "../../../src/runtime/lifecycle/BackgroundTasks.ts";

function controllable() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// the debug flag is read when the logger module loads, so debug output is checked in a subprocess
async function runDebugScript(body: string): Promise<string> {
  const modulePath = path.resolve(
    import.meta.dir,
    "../../../src/runtime/lifecycle/BackgroundTasks.ts",
  );
  const script = `
    import { awaitBackgroundTasks, trackBackgroundTask } from ${JSON.stringify(modulePath)};
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    ${body}
  `;
  const proc = Bun.spawn([process.execPath, "-e", script], {
    env: { ...process.env, DYNAMIC_CLI_FRAMEWORK_DEBUG: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  await proc.exited;
  return stdout + stderr;
}

describe("BackgroundTasks tests", () => {
  test("the grace period is a named constant", () => {
    expect(BACKGROUND_TASK_GRACE_PERIOD_MS).toEqual(2000);
  });

  test("returns immediately, without starting a timer, when nothing is in flight", async () => {
    const originalSetTimeout = globalThis.setTimeout;
    let timers = 0;
    globalThis.setTimeout = ((...args: Parameters<typeof setTimeout>) => {
      timers++;
      return originalSetTimeout(...args);
    }) as typeof setTimeout;
    try {
      await awaitBackgroundTasks(10_000);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
    expect(timers).toEqual(0);
  });

  test("a task finishing inside the grace period lands its side effect before the wait returns", async () => {
    let written = false;
    trackBackgroundTask("test/within", async () => {
      await sleep(30);
      written = true;
    });
    expect(written).toBeFalse();

    await awaitBackgroundTasks(1000);

    expect(written).toBeTrue();
  });

  test("a task exceeding the grace period is abandoned and the wait returns after the period", async () => {
    const task = controllable();
    let finished = false;
    trackBackgroundTask("test/exceeds", async () => {
      await task.promise;
      finished = true;
    });

    const start = performance.now();
    await awaitBackgroundTasks(50);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(40);
    expect(elapsed).toBeLessThan(900);
    expect(finished).toBeFalse();

    // abandoned tasks are no longer tracked
    const startAgain = performance.now();
    await awaitBackgroundTasks(5000);
    expect(performance.now() - startAgain).toBeLessThan(100);

    task.resolve();
  });

  test("a failing task does not reject the wait or other tasks", async () => {
    const failing = controllable();
    let otherWritten = false;
    trackBackgroundTask("test/failing", () => failing.promise);
    trackBackgroundTask("test/other", async () => {
      await sleep(20);
      otherWritten = true;
    });
    failing.reject(new Error("boom"));

    await awaitBackgroundTasks(1000);

    expect(otherWritten).toBeTrue();
  });

  test("a task whose start throws synchronously does not throw", async () => {
    expect(() =>
      trackBackgroundTask("test/throws", () => {
        throw new Error("sync boom");
      }),
    ).not.toThrow();

    await awaitBackgroundTasks(1000);
  });

  test("the grace timer does not keep the process alive", async () => {
    const modulePath = path.resolve(
      import.meta.dir,
      "../../../src/runtime/lifecycle/BackgroundTasks.ts",
    );
    const script = `
      import { awaitBackgroundTasks, trackBackgroundTask } from ${JSON.stringify(modulePath)};
      trackBackgroundTask("never", () => new Promise(() => {}));
      awaitBackgroundTasks(60000);
    `;
    const start = performance.now();
    const proc = Bun.spawn([process.execPath, "-e", script], { stdout: "pipe", stderr: "pipe" });
    await proc.exited;
    expect(performance.now() - start).toBeLessThan(20_000);
  });

  test("debug output names each task for start, completion, failure, in-flight and cancellation", async () => {
    const output = await runDebugScript(`
      trackBackgroundTask("task/completes", async () => { await sleep(20); });
      trackBackgroundTask("task/fails", async () => { await sleep(20); throw new Error("kaboom"); });
      trackBackgroundTask("task/hangs", () => new Promise(() => {}));
      await awaitBackgroundTasks(200);
    `);

    expect(output).toContain("Background startup task 'task/completes' started");
    expect(output).toContain("Background startup task 'task/fails' started");
    expect(output).toContain("Background startup task 'task/hangs' started");
    expect(output).toMatch(/Waiting up to 200ms for 3 in-flight background startup task\(s\)/);
    expect(output).toMatch(/'task\/completes' still in flight after \d+ms/);
    expect(output).toMatch(/'task\/completes' completed in \d+ms/);
    expect(output).toMatch(/'task\/fails' failed after \d+ms: Error: kaboom/);
    expect(output).toMatch(
      /'task\/hangs' cancelled after \d+ms: still running when the 200ms grace period expired/,
    );
    expect(output).not.toMatch(/'task\/completes' cancelled/);
    expect(output).not.toMatch(/'task\/fails' cancelled/);
  });
});
