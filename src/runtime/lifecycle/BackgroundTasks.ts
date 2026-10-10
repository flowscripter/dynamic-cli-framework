import getLogger from "../../util/logger.ts";

const logger = getLogger("BackgroundTasks");

/**
 * How long, at shutdown, to wait for in-flight "background" startup tasks before abandoning them.
 */
export const BACKGROUND_TASK_GRACE_PERIOD_MS = 1000;

interface InFlightTask {
  readonly id: string;
  readonly startedAt: number;
  settled: Promise<void>;
}

const inFlightTasks = new Set<InFlightTask>();

function elapsedMs(task: InFlightTask): number {
  return Math.round(performance.now() - task.startedAt);
}

/**
 * Start a background startup task without awaiting it, and track it so that
 * {@link awaitBackgroundTasks} can give it a chance to finish at shutdown. A rejection is
 * logged (at debug level) and never propagated.
 *
 * @param id the id of the startup task.
 * @param start starts the task.
 */
export function trackBackgroundTask(id: string, start: () => Promise<unknown>): void {
  const task: InFlightTask = { id, startedAt: performance.now(), settled: Promise.resolve() };
  logger.debug(() => `Background startup task '${id}' started`);
  task.settled = new Promise<unknown>((resolve) => resolve(start()))
    .then(
      () => {
        logger.debug(() => `Background startup task '${id}' completed in ${elapsedMs(task)}ms`);
      },
      (error: unknown) => {
        logger.debug(
          () => `Background startup task '${id}' failed after ${elapsedMs(task)}ms: ${error}`,
        );
      },
    )
    .finally(() => {
      inFlightTasks.delete(task);
    });
  inFlightTasks.add(task);
}

/**
 * Wait for the tracked background startup tasks, for at most `gracePeriodMs`. Tasks still running
 * once it expires are abandoned. Returns immediately if no tasks are in flight. Never rejects.
 *
 * @param gracePeriodMs the maximum time to wait.
 */
export async function awaitBackgroundTasks(
  gracePeriodMs: number = BACKGROUND_TASK_GRACE_PERIOD_MS,
): Promise<void> {
  if (inFlightTasks.size === 0) {
    return;
  }
  const pending = [...inFlightTasks];
  logger.debug(
    () =>
      `Waiting up to ${gracePeriodMs}ms for ${pending.length} in-flight background startup task(s)`,
  );
  for (const task of pending) {
    logger.debug(
      () => `Background startup task '${task.id}' still in flight after ${elapsedMs(task)}ms`,
    );
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, gracePeriodMs);
    // must not keep the process alive
    (timer as { unref?: () => void }).unref?.();
  });
  try {
    await Promise.race([Promise.all(pending.map((task) => task.settled)), expired]);
  } catch {
    // settled promises never reject; nothing to do
  } finally {
    clearTimeout(timer);
  }

  for (const task of pending) {
    if (inFlightTasks.has(task)) {
      inFlightTasks.delete(task);
      logger.debug(
        () =>
          `Background startup task '${task.id}' cancelled after ${elapsedMs(task)}ms: still running when the ${gracePeriodMs}ms grace period expired`,
      );
    }
  }
}
