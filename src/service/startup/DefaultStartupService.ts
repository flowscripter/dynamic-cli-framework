import type { StartupService, StartupTask } from "@flowscripter/dynamic-cli-framework-api";
import PriorityTaskList from "../../runtime/lifecycle/PriorityTaskList.ts";

export default class DefaultStartupService implements StartupService {
  readonly #taskList = new PriorityTaskList<StartupTask>();

  public registerTask(task: StartupTask): void {
    this.#taskList.add(task);
  }

  /**
   * Return all registered {@link StartupTask} instances, in descending priority order.
   */
  public getTasks(): ReadonlyArray<StartupTask> {
    return this.#taskList.sorted();
  }
}
