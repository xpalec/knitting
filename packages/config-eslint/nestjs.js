import globals from "globals";
import { baseConfig } from "./base.js";

/**
 * ESLint for NestJS APIs (Node + TS).
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const nestjsConfig = [
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
