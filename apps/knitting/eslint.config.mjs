import { nextConfig } from "@knitting/config-eslint/next";

/** @type {import("eslint").Linter.Config[]} */
export default [
  { ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"] },
  ...nextConfig,
];
