import { assertEquals, assertThrows } from "@std/assert";
import DefaultKeyValueService from "../../../src/service/configuration/DefaultKeyValueService.ts";

Deno.test("Setting data works", () => {
  const keyValueService = new DefaultKeyValueService();

  keyValueService.setKeyValueData(new Map([["foo", "bar"]]));

  assertEquals(keyValueService.hasKey("foo"), true);
  assertEquals(keyValueService.getKey("foo"), "bar");
});

Deno.test("Cannot set data without clearing", () => {
  const keyValueService = new DefaultKeyValueService();

  keyValueService.setKeyValueData(new Map());
  assertThrows(() => keyValueService.setKeyValueData(new Map()));

  keyValueService.clearKeyValueData();
  keyValueService.setKeyValueData(new Map());
});

Deno.test("Cannot modify data before setting it", () => {
  const keyValueService = new DefaultKeyValueService();

  assertThrows(() => keyValueService.setKey("foo", "bar"));
  assertThrows(() => keyValueService.hasKey("foo"));
  assertThrows(() => keyValueService.getKey("foo"));
  assertThrows(() => keyValueService.deleteKey("foo"));

  keyValueService.setKeyValueData(new Map());

  keyValueService.setKey("foo", "bar");
  assertEquals(keyValueService.hasKey("foo"), true);
  assertEquals(keyValueService.getKey("foo"), "bar");
  keyValueService.deleteKey("foo");
});

Deno.test("Dirty state is managed correctly", () => {
  const keyValueService = new DefaultKeyValueService();

  assertEquals(keyValueService.isDirty(), false);

  keyValueService.setKeyValueData(new Map());

  assertEquals(keyValueService.isDirty(), false);

  keyValueService.setKey("foo", "bar");

  assertEquals(keyValueService.isDirty(), true);

  keyValueService.clearKeyValueData();

  assertEquals(keyValueService.isDirty(), false);

  keyValueService.setKeyValueData(new Map([["foo", "bar"]]));

  assertEquals(keyValueService.isDirty(), false);

  keyValueService.deleteKey("foo");

  assertEquals(keyValueService.isDirty(), true);
});
