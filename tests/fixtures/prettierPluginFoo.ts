import type { Parser, Plugin, Printer, SupportLanguage } from "prettier";

const languages: SupportLanguage[] = [
  {
    name: "foo",
    parsers: ["foo"],
  },
];

const parsers: Record<string, Parser> = {
  foo: {
    astFormat: "foo",
    parse: () => "",
    locStart: () => 0,
    locEnd: () => 0,
  },
};

const printers: Record<string, Printer> = {
  "foo": {
    print: () => "foo",
  },
};

const prettierPluginFoo: Plugin = {
  languages,
  parsers,
  printers,
};

export default prettierPluginFoo;
