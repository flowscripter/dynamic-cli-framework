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

export default {
  languages,
  parsers,
  printers,
};
