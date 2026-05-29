import { describe, it, expect } from "vitest";
import axe from "axe-core";

describe("axe-core 可访问性检查", () => {
  it("axe-core 库正确加载", () => {
    expect(axe).toBeDefined();
    expect(typeof axe.run).toBe("function");
  });

  it("axe-core 默认规则包含关键可访问性规则", () => {
    const rules = axe.getRules();
    const ruleIds = rules.map((r) => r.ruleId);

    // WCAG 2.1 A/AA 关键规则
    expect(ruleIds).toContain("color-contrast");
    expect(ruleIds).toContain("focus-order-semantics");
    expect(ruleIds).toContain("label");
    expect(ruleIds).toContain("aria-required-attr");
    expect(ruleIds).toContain("aria-roles");
  });

  it("axe-core 可以扫描简单 HTML", async () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <button>Click me</button>
      <input type="text" aria-label="Search" />
    `;
    document.body.appendChild(container);

    const results = await axe.run(container);

    // 无 critical/serious 级别问题
    const seriousIssues = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    expect(seriousIssues).toHaveLength(0);

    document.body.removeChild(container);
  });

  it("axe-core 可以检测缺失的 aria-label", async () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <input type="text" id="no-label" />
    `;
    document.body.appendChild(container);

    const results = await axe.run(container);

    // 应该有 label 相关的可访问性问题
    const labelViolations = results.violations.filter((v) => v.id === "label");

    expect(labelViolations.length).toBeGreaterThan(0);

    document.body.removeChild(container);
  });
});
