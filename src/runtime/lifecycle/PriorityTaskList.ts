/**
 * Common shape shared by {@link StartupTask} and {@link ShutdownTask}: a task with an optional
 * priority, used to order execution. Higher values run earlier. Undefined is treated as `0`.
 */
export interface PriorityTask {
  readonly priority?: number;
}

/**
 * Stably sort tasks by descending priority (default `0`). Tasks with the same priority keep
 * their relative order in the input array.
 */
export function sortByPriority<T extends PriorityTask>(tasks: ReadonlyArray<T>): Array<T> {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => (b.task.priority ?? 0) - (a.task.priority ?? 0) || a.index - b.index)
    .map((entry) => entry.task);
}

/**
 * Internal helper shared by {@link DefaultStartupService} and {@link DefaultShutdownService}:
 * accumulates registered tasks and returns them in priority order on demand.
 */
export default class PriorityTaskList<T extends PriorityTask> {
  readonly #tasks: Array<T> = [];

  public add(task: T): void {
    this.#tasks.push(task);
  }

  public sorted(): ReadonlyArray<T> {
    return sortByPriority(this.#tasks);
  }
}
