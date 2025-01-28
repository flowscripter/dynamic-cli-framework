import { Buffer } from "@std/streams";
import Terminal from "../../../../src/service/printer/terminal/Terminal.ts";
import Spinner from "../../../../src/service/printer/terminal/Spinner.ts";
import { expectBufferStringEquals, sleep } from "../../../fixtures/util.ts";

Deno.test("Spinner works", async () => {
  const buffer = new Buffer();
  const terminal = new Terminal(buffer.writable);
  const spinner = new Spinner(terminal);

  await spinner.show();
  await sleep(250);
  await spinner.hide();

  expectBufferStringEquals(buffer, "⠋⠙");
});

Deno.test("Calling show and hide multiple times works", async () => {
  const buffer = new Buffer();
  const terminal = new Terminal(buffer.writable);
  const spinner = new Spinner(terminal);

  await spinner.show();
  await sleep(50);
  await spinner.show();
  await sleep(50);
  await spinner.hide();
  await sleep(50);
  await spinner.hide();
});

Deno.test("Updating the spinner message works", async () => {
  const buffer = new Buffer();
  const terminal = new Terminal(buffer.writable);
  const spinner = new Spinner(terminal);

  await spinner.show();
  await sleep(150);
  await spinner.show("foo");
  await sleep(120);
  await spinner.show("bar");
  await sleep(120);
  await spinner.show();
  await sleep(120);
  await spinner.hide();

  expectBufferStringEquals(buffer, "⠋⠙ foo⠹ bar⠸⠼");
});
