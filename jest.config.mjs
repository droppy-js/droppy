/** @type {import('jest').Config} */
const config = {
  projects: ["<rootDir>/packages/*/jest.config.mjs"],
  coverageDirectory: "<rootDir>/coverage/",
};

export default config;
