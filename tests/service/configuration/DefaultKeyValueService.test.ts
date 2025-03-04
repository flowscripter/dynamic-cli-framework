import { describe, expect, test } from "bun:test";
import DefaultKeyValueService from "../../../src/service/configuration/DefaultKeyValueService.ts";

describe("DefaultKeyValueService Tests", () => {
  test("Setting data works", () => {
    const keyValueService = new DefaultKeyValueService();

    keyValueService.setKeyValueData(new Map([["foo", "bar"]]));

    expect(keyValueService.hasKey("foo")).toBeTrue();
    expect(keyValueService.getKey("foo")).toEqual("bar");
  });

  test("Cannot set data without clearing", () => {
    const keyValueService = new DefaultKeyValueService();

    keyValueService.setKeyValueData(new Map());
    expect(() => keyValueService.setKeyValueData(new Map())).toThrow();

    keyValueService.clearKeyValueData();
    keyValueService.setKeyValueData(new Map());
  });

  test("Cannot modify data before setting it", () => {
    const keyValueService = new DefaultKeyValueService();

    expect(() => keyValueService.setKey("foo", "bar")).toThrow();
    expect(() => keyValueService.hasKey("foo")).toThrow();
    expect(() => keyValueService.getKey("foo")).toThrow();
    expect(() => keyValueService.deleteKey("foo")).toThrow();

    keyValueService.setKeyValueData(new Map());

    keyValueService.setKey("foo", "bar");
    expect(keyValueService.hasKey("foo")).toBeTrue();
    expect(keyValueService.getKey("foo")).toEqual("bar");
    keyValueService.deleteKey("foo");
  });

  test("Dirty state is managed correctly", () => {
    const keyValueService = new DefaultKeyValueService();

    expect(keyValueService.isDirty()).toBeFalse();

    keyValueService.setKeyValueData(new Map());

    expect(keyValueService.isDirty()).toBeFalse();

    keyValueService.setKey("foo", "bar");

    expect(keyValueService.isDirty()).toBeTrue();

    keyValueService.clearKeyValueData();

    expect(keyValueService.isDirty()).toBeFalse();

    keyValueService.setKeyValueData(new Map([["foo", "bar"]]));

    expect(keyValueService.isDirty()).toBeFalse();

    keyValueService.deleteKey("foo");

    expect(keyValueService.isDirty()).toBeTrue();
  });
});
