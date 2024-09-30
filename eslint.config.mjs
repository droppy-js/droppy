import globals from "globals";

import js from "@eslint/js";

import babelParser from "@babel/eslint-parser";

export default [
  js.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,

        // TODO: remove when moved to ES modules in client
        $: "readonly",
        CodeMirror: "readonly",
        Mousetrap: "readonly",
        Handlebars: "readonly",
        _: "readonly",
        fileExtension: "readonly",
        screenfull: "readonly",
        Uppie: "readonly",
        PhotoSwipe: "readonly",
        PhotoSwipeUI_Default: "readonly",
        pdfjsLib: "readonly",
        Plyr: "readonly",
      },
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          babelrc: false,
          configFile: false,
          plugins: ["@babel/plugin-syntax-import-assertions"],
        },
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "warn",
    },
  },
  {
    ignores: ["packages/svgstore/tests"],
  },
];
