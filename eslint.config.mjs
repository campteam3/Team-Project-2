import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 하위 세션이 쓰는 작업 폴더(git worktree)와 그 안의 빌드 결과물은 검사하지 않습니다 (차명근)
    ".claude/**",
  ]),
]);

export default eslintConfig;
