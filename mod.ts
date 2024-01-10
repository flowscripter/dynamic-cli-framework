// export type {
//   ArgumentSingleValueType,
//   ArgumentValueType,
//   PopulatedArgumentValues,
// } from "./src/api/argument/ArgumentValueTypes.ts";
// export type { default as Argument } from "./src/api/argument/Argument.ts";
// export type { default as ComplexOption } from "./src/api/argument/ComplexOption.ts";
// export type { default as GlobalCommandArgument } from "./src/api/argument/GlobalCommandArgument.ts";
// export type { default as Option } from "./src/api/argument/Option.ts";
// export type { default as Positional } from "./src/api/argument/Positional.ts";
// export type { default as SubCommandArgument } from "./src/api/argument/SubCommandArgument.ts";
// export type { default as Command } from "./src/api/command/Command.ts";
// export type { default as GlobalCommand } from "./src/api/command/GlobalCommand.ts";
// export type { default as GlobalModifierCommand } from "./src/api/command/GlobalModifierCommand.ts";
// export type { default as GroupCommand } from "./src/api/command/GroupCommand.ts";
// export type { default as SubCommand } from "./src/api/command/SubCommand.ts";
// export type { default as UsageExample } from "./src/api/command/UsageExample.ts";
// export type { default as Printer } from "./src/api/service/core/PrinterService.ts";
// export type { default as CommandRegistry } from "./src/runtime/registry/CommandRegistry.ts";
// export type { default as ServiceProviderRegistry } from "./src/runtime/registry/ServiceProviderRegistry.ts";
// export type { default as RunResult } from "./src/api/RunResult.ts";
// export type { InvalidArgument } from "./src/api/RunResult.ts";
// export type { default as Context } from "./src/api/Context.ts";
// export type { default as ServiceProvider } from "./src/api/service/ServiceProvider.ts";
// export type { default as CLI } from "./src/api/CLI.ts";
// export {
//   ArgumentValueTypeName,
//   ComplexValueTypeName,
// } from "./src/api/argument/ArgumentValueTypes.ts";
// export * from "./src/api/argument/ArgumentTypeGuards.ts";
// export * from "./src/api/command/CommandTypeGuards.ts";
// export * from "./src/cli/BaseCLI.ts";
// export {RunState} from "./src/api/RunResult.ts";
// export { default as BaseCLI } from "./src/cli/BaseCLI.ts";
// export {
//   MultiCommandCliHelpGlobalCommand, MultiCommandCliHelpSubCommand,
// } from "./src/command/MultiCommandCliHelpCommand.ts";
// export { SingleCommandCliHelpGlobalCommand } from "./src/command/SingleCommandCliHelpCommand.ts";

/*
import Context from "./src/api/Context.ts";
import SubCommand from "./src/api/command/SubCommand.ts";
import {
  ArgumentValues,
  ArgumentValueTypeName,
  ComplexValueTypeName,
} from "./src/api/argument/ArgumentValueTypes.ts";
import {
  default as Printer,
  PRINTER_SERVICE_ID,
} from "./src/api/service/core/PrinterService.ts";
import LifecycleService, {
  LIFECYCLE_SERVICE_ID,
} from "./src/api/service/core/LifecycleService.ts";
import { launchMultiCommandCLI, launchSingleCommandCLI } from "./src/launch.ts";

const command1: SubCommand = {
  name: "command1",
  description: "foo 1",
  enableConfiguration: true,
  options: [{
    name: "helloskskskskskskskskskskskskskskskskssk",
    type: ArgumentValueTypeName.STRING,
    shortAlias: "h",
    defaultValue: "lalalssa",
    isArray: true,
    isOptional: true,
  }, {
    name: "bool",
    type: ArgumentValueTypeName.BOOLEAN,
    shortAlias: "q",
    description: "face face",
    isOptional: true,
  }, {
    name: "foo2",
    description: "shit1",
    type: ComplexValueTypeName.COMPLEX,
    isArray: true,
    shortAlias: "j",
    isOptional: true,
    properties: [{
      name: "fooA",
      type: ComplexValueTypeName.COMPLEX,
      isArray: true,
      shortAlias: "j",
      isOptional: true,
      properties: [
        {
          name: "bingo",
          type: ArgumentValueTypeName.STRING,
          shortAlias: "b",
          description: "face face",
          defaultValue: "lalala",
          isArray: true,
          isOptional: true,
        },
        {
          name: "food",
          type: ComplexValueTypeName.COMPLEX,
          isArray: true,
          shortAlias: "t",
          isOptional: true,
          properties: [
            {
              name: "bindgos",
              type: ArgumentValueTypeName.STRING,
              shortAlias: "w",
              description: "face face",
              defaultValue: "lalala",
              isArray: true,
              isOptional: true,
            },
          ],
        },
        {
          name: "dingo",
          type: ArgumentValueTypeName.STRING,
          description: "djjdkcf fefefe",
          defaultValue: "jibber",
          isArray: true,
          isOptional: true,
        },
        {
          name: "fooz",
          type: ComplexValueTypeName.COMPLEX,
          isArray: true,
          shortAlias: "z",
          isOptional: true,
          properties: [
            {
              name: "bingos",
              type: ArgumentValueTypeName.STRING,
              shortAlias: "y",
              description: "face face",
              defaultValue: "lalala",
              isArray: true,
              isOptional: true,
            },
          ],
        },
      ],
    }, {
      name: "fooB",
      type: ArgumentValueTypeName.STRING,
      shortAlias: "b",
      description: "bingo pop",
      defaultValue: "shite",
      isArray: true,
      isOptional: true,
    }, {
      name: "fooC",
      type: ComplexValueTypeName.COMPLEX,
      isArray: true,
      shortAlias: "j",
      isOptional: true,
      properties: [
        {
          name: "bingo2",
          type: ArgumentValueTypeName.STRING,
          shortAlias: "f",
          description: "face face",
          defaultValue: "lalala",
          isArray: true,
          isOptional: true,
        },
        {
          name: "bool",
          type: ArgumentValueTypeName.BOOLEAN,
          shortAlias: "q",
          description: "face face",
          isOptional: true,
        },
        {
          name: "dingo3",
          type: ArgumentValueTypeName.STRING,
          shortAlias: "k",
          description: "djjdkcf fefefe",
          defaultValue: "jibber",
          allowableValues: ["jibber", "jabber"],
          isArray: true,
          isOptional: true,
        },
      ],
    }],
  }],
  positionals: [
    {
      name: "bool2",
      type: ArgumentValueTypeName.BOOLEAN,
      description: "face face",
      isVarargMultiple: true,
      isVarargOptional: true,
      configurationKey: "NICLK",
    },
  ],
  usageExamples: [
    {
      exampleArguments: "yes no",
      description: "this is the bomb",
      output: [
        "ssss",
        "and more shut",
      ],
    },
    {
      exampleArguments: "yes no",
      description: "this is the bomb",
      output: [
        "ssss",
        "and more shut",
      ],
    },
  ],
  async execute(
    _argumentValues: ArgumentValues,
    context: Context,
  ): Promise<void> {
    const printer = context.getServiceById(PRINTER_SERVICE_ID) as Printer;
    await printer.showSpinner("hello world");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await printer.warn("bang\n");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await printer.showSpinner("goodbye world");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await printer.hideSpinner();
    return Promise.resolve(undefined);
  },
};

const command2: SubCommand = {
  name: "command2",
  description: "foo 2",
  options: [],
  positionals: [],
  async execute(
    _argumentValues: ArgumentValues,
    context: Context,
  ): Promise<void> {
    const timers: Array<[number, (reason?: unknown) => void]> = [];
    const lifecycle = context.getServiceById(
      LIFECYCLE_SERVICE_ID,
    ) as LifecycleService;
    lifecycle.addShutdownListener(() => {
      try {
        timers.forEach((timer) => {
          clearTimeout(timer[0]);
          timer[1]();
        });
      } catch (_err) {console.error("ss")}
    });
    const printer = context.getServiceById(PRINTER_SERVICE_ID) as Printer;
    const handle1 = await printer.showProgressBar("sec", "1 waiting", 200, 2);
    const handle2 = await printer.showProgressBar("MB", "2 waiting", 200, 20);
    await new Promise((resolve, reject) =>
      timers.push([setTimeout(resolve, 1500), reject])
    );
    await printer.updateProgressBar(handle1, 10, "1 still waiting");
    await printer.updateProgressBar(handle2, 100, "2 still waiting");
    await new Promise((resolve, reject) =>
      timers.push([setTimeout(resolve, 1500), reject])
    ).catch((err) => console.error(`${JSON.stringify(err)}\n\n\n\n\n`));
    await printer.warn("bang\n");
    await new Promise((resolve, reject) =>
      timers.push([setTimeout(resolve, 1500), reject])
    );
    await printer.updateProgressBar(handle1, 15, "1 still waiting more");
    await printer.updateProgressBar(handle2, 150, "2 still waiting more");
    await new Promise((resolve, reject) =>
      timers.push([setTimeout(resolve, 1500), reject])
    );
    await printer.hideProgressBar(handle1);
    await new Promise((resolve, reject) =>
      timers.push([setTimeout(resolve, 500), reject])
    );
    await printer.warn("bang\n");
    await printer.hideProgressBar(handle2);
    await new Promise((resolve, reject) =>
      timers.push([setTimeout(resolve, 1500), reject])
    );
    await new Promise((resolve, reject) =>
      timers.push([setTimeout(resolve, 1500), reject])
    );
    return Promise.resolve().catch((_err) => console.error("ss"));
  },
};
// await launchMultiCommandCLI(
//   [command1, command2],
//   "description",
//   undefined,
//   "3.0.0",
// );

// await launchSingleCommandCLI(command1, "description");
*/
