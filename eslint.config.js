import parser from "@typescript-eslint/parser";
export default [
  {
    files: ["**/*.{ts,tsx,js,mjs}"],
    languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: {
      "no-debugger": "error",
      "no-duplicate-case": "error",
      "no-unreachable": "error",
      "no-constant-binary-expression": "error",
      "no-fallthrough": "error",
      "no-dupe-keys": "error",
    },
  },
];
