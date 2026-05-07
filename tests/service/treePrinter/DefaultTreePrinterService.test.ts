import { describe, expect, test } from "bun:test";
import DefaultTreePrinterService from "../../../src/service/treePrinter/DefaultTreePrinterService.ts";

describe("DefaultTreePrinterService tests", () => {
  test("Single root, no children", () => {
    const service = new DefaultTreePrinterService();
    service.colorEnabled = false;

    expect(service.print({ label: "Root" })).toEqual("Root");
  });

  test("Root with string children uses correct connectors", () => {
    const service = new DefaultTreePrinterService();
    service.colorEnabled = false;

    const result = service.print({
      label: "Root",
      children: ["Alpha", "Beta", "Gamma"],
    });

    const lines = result.split("\n");
    expect(lines[0]).toEqual("Root");
    expect(lines[1]).toEqual("├── Alpha");
    expect(lines[2]).toEqual("├── Beta");
    expect(lines[3]).toEqual("└── Gamma");
  });

  test("Root with TreeNode children uses correct connectors", () => {
    const service = new DefaultTreePrinterService();
    service.colorEnabled = false;

    const result = service.print({
      label: "Root",
      children: [
        { label: "Child1", children: ["Leaf1", "Leaf2"] },
        { label: "Child2" },
      ],
    });

    const lines = result.split("\n");
    expect(lines[0]).toEqual("Root");
    expect(lines[1]).toEqual("├── Child1");
    expect(lines[2]).toEqual("│   ├── Leaf1");
    expect(lines[3]).toEqual("│   └── Leaf2");
    expect(lines[4]).toEqual("└── Child2");
  });

  test("Mixed children (strings and nodes at same level)", () => {
    const service = new DefaultTreePrinterService();
    service.colorEnabled = false;

    const result = service.print({
      label: "Root",
      children: [
        "StringChild",
        { label: "NodeChild", children: ["Nested"] },
        "Last",
      ],
    });

    const lines = result.split("\n");
    expect(lines[0]).toEqual("Root");
    expect(lines[1]).toEqual("├── StringChild");
    expect(lines[2]).toEqual("├── NodeChild");
    expect(lines[3]).toEqual("│   └── Nested");
    expect(lines[4]).toEqual("└── Last");
  });

  test("Deep nesting propagates continuation chars correctly", () => {
    const service = new DefaultTreePrinterService();
    service.colorEnabled = false;

    const result = service.print({
      label: "Root",
      children: [
        {
          label: "L1",
          children: [
            {
              label: "L2",
              children: ["L3a", "L3b"],
            },
            "L2sibling",
          ],
        },
        "RootSibling",
      ],
    });

    const lines = result.split("\n");
    expect(lines[0]).toEqual("Root");
    expect(lines[1]).toEqual("├── L1");
    expect(lines[2]).toEqual("│   ├── L2");
    expect(lines[3]).toEqual("│   │   ├── L3a");
    expect(lines[4]).toEqual("│   │   └── L3b");
    expect(lines[5]).toEqual("│   └── L2sibling");
    expect(lines[6]).toEqual("└── RootSibling");
  });

  test("Last child uses └── and others use ├──", () => {
    const service = new DefaultTreePrinterService();
    service.colorEnabled = false;

    const result = service.print({
      label: "Root",
      children: ["A", "B", "C"],
    });

    const lines = result.split("\n");
    expect(lines[1]!.startsWith("├── ")).toBe(true);
    expect(lines[2]!.startsWith("├── ")).toBe(true);
    expect(lines[3]!.startsWith("└── ")).toBe(true);
  });

  test("colorEnabled=true wraps labels via colorFunction", () => {
    const service = new DefaultTreePrinterService();
    service.colorEnabled = true;
    service.colorFunction = (text, _color) => `[${text}]`;

    const result = service.print({
      label: "Root",
      children: ["Child"],
    });

    const lines = result.split("\n");
    expect(lines[0]).toEqual("[Root]");
    expect(lines[1]).toEqual("└── [Child]");
  });

  test("colorEnabled=false returns plain text", () => {
    const service = new DefaultTreePrinterService();
    service.colorEnabled = false;
    service.colorFunction = (text, _color) => `[${text}]`;

    const result = service.print({
      label: "Root",
      children: ["Child"],
    });

    const lines = result.split("\n");
    expect(lines[0]).toEqual("Root");
    expect(lines[1]).toEqual("└── Child");
  });
});
