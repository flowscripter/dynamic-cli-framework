import type { Plugin } from "prettier";

const languages = [
  {
    name: "foo",
    parsers: ["foo"],
  },
];

const parsers = {
  foo: {
    astFormat: "foo",
    parse: () => "",
    locStart: () => 0,
    locEnd: () => 0,
  },
};

const printers = {
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
