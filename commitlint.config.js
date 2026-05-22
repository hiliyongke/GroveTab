/**
 * Commitlint 配置（Conventional Commits 规范）
 * https://www.conventionalcommits.org/
 *
 * 提交信息格式：<type>(<scope>): <subject>
 *   - type: feat | fix | docs | style | refactor | perf | test | build | ci | chore | revert
 *   - scope: 可选，标注影响范围（如 newtab、popup、sw 等）
 *   - subject: 简短描述（结尾不加句号）
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
    "subject-case": [0],
    "subject-max-length": [2, "always", 100],
    "header-max-length": [2, "always", 120],
  },
};
