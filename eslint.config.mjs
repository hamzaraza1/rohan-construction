import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: [".next/**", ".next-*/**", "node_modules/**", "storage/**"] },
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // decimal.js treats +0 as positive, which silently breaks "is anything owed?" checks.
          selector: "CallExpression[callee.property.name=/^(isPositive|isPos)$/]",
          message: "Decimal.isPositive() is true for zero. Use .greaterThan(0).",
        },
      ],
    },
  },
];

export default config;
