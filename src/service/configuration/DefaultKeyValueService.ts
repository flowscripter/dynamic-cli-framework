import type KeyValueService from "../../api/service/core/KeyValueService.ts";

export default class DefaultKeyValueService implements KeyValueService {
  #keyValueData: Map<string, string> | undefined;
  #dirty = false;

  public setKeyValueData(keyValueData: Map<string, string>) {
    if (this.#keyValueData) {
      throw new Error(
        "Attempt to overwrite key-value data, it should be cleared first",
      );
    }
    this.#keyValueData = keyValueData;
    this.#dirty = false;
  }

  public clearKeyValueData() {
    this.#keyValueData = undefined;
    this.#dirty = false;
  }

  public isDirty(): boolean {
    return this.#dirty;
  }

  public getKey(key: string): string {
    if (this.#keyValueData === undefined) {
      throw new Error("Attempt to access undefined key-value data");
    }
    const value = this.#keyValueData.get(key);
    if (value === undefined) {
      throw new Error("Attempt to access unknown key");
    }

    return value;
  }

  public hasKey(key: string): boolean {
    if (this.#keyValueData === undefined) {
      throw new Error("Attempt to access undefined key-value data");
    }
    return this.#keyValueData.has(key);
  }

  public setKey(key: string, value: string): void {
    if (this.#keyValueData === undefined) {
      throw new Error("Attempt to access undefined key-value data");
    }
    this.#keyValueData.set(key, value);
    this.#dirty = true;
  }

  public deleteKey(key: string): void {
    if (this.#keyValueData === undefined) {
      throw new Error("Attempt to access undefined key-value data");
    }
    this.#keyValueData.delete(key);
    this.#dirty = true;
  }
}
