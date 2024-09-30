/** @type {import('jest').Config} */
const config = {
  roots: ["<rootDir>/lib", "<rootDir>/tests"],
  transform: {
    "^.+\\.(js|jsx|mjs)$": "babel-jest",
  },
  testRegex: "(/tests/.*.(test|spec)).(mjs|jsx?|tsx?)$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node", "mjs"],
  coveragePathIgnorePatterns: ["(tests/.*.mock).(jsx?|tsx?)$"],
};

export default config;
