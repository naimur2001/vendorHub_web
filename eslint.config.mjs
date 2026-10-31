import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Security rules (see "Security rules for every component" in the Notion build log).
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // XSS: never inject raw HTML or build code from strings.
      "react/no-danger": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
      "react/jsx-no-script-url": "error",

      // Links that open a new tab must not give the other site access to our page.
      "react/jsx-no-target-blank": ["error", { allowReferrer: false, enforceDynamicLinks: "always" }],

      // Tokens and session data never go into web storage.
      "no-restricted-globals": [
        "error",
        {
          name: "localStorage",
          message: "No web storage for session data. If truly needed for a harmless UI setting, disable this rule on that line with a reason.",
        },
        {
          name: "sessionStorage",
          message: "No web storage for session data. If truly needed for a harmless UI setting, disable this rule on that line with a reason.",
        },
      ],

      // Keep tokens and personal data out of the browser console.
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated from the backend's OpenAPI file:
    "src/lib/api/schema.d.ts",
  ]),
]);

export default eslintConfig;