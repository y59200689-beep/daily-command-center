import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(new URL("../src/app/product-system.css", import.meta.url), "utf8");

test("Phase 4 CSS Design System: unified context headers, view switchers, filter bars, and card surfaces", () => {
  // Task context header actions styling
  assert.match(css, /\.task-context-header__actions a\b/);
  assert.match(css, /\.task-context-header__actions a:hover\b/);

  // View switch and filter pill styling
  assert.match(css, /\.view-switch \{/);
  assert.match(css, /\.view-switch button/);
  assert.match(css, /\.filter-bar \{/);
  assert.match(css, /\.filter-pill \{/);
  assert.match(css, /\.filter-pill\[aria-pressed="true"\]/);

  // Standard card component
  assert.match(css, /\.card \{/);

  // Responsive breakpoints and overflow protection
  assert.match(css, /@media \(max-width:767px\)/);
  assert.match(css, /\.workspace,\.workspace__content,\.domain-page \{ min-width:0; \}/);
  assert.match(css, /\.task-list-frame \{[^}]*max-width:100%;[^}]*overflow-x:auto/);
});

test("Phase 4 CSS Design System: responsive mobile touch targets and header collapsing", () => {
  assert.match(css, /\.task-context-header__actions (?:button|\.button)[^}]*min-height:\s*40px/);
  assert.match(css, /@media \(max-width:767px\)[\s\S]*\.task-context-header \{[^}]*flex-wrap:\s*wrap;/);
  assert.match(css, /@media \(max-width:767px\)[\s\S]*\.task-context-header__actions \{[^}]*flex-wrap:\s*wrap;/);
});

test("Phase 4 Operations module: all child views use semantic headers, breadcrumbs, and clean actions", () => {
  const dir = join(process.cwd(), "src/features/operations");
  const files = ["quality-center.tsx", "process-list.tsx", "operations-calendar.tsx", "runbooks-view.tsx", "systems-registry.tsx", "runs-list.tsx", "sop-library.tsx"];
  for (const file of files) {
    const content = readFileSync(join(dir, file), "utf8");
    assert.match(content, /<main className="domain-page operations-page"/, `${file} missing semantic main container`);
    assert.match(content, /className="task-context-header"/, `${file} missing task-context-header`);
    assert.match(content, /className="task-context-header__breadcrumb"/, `${file} missing breadcrumb navigation`);
    assert.doesNotMatch(content, /style=\{\{\s*display:\s*"inline-flex",\s*alignItems:\s*"center"/, `${file} contains legacy ad-hoc inline styles`);
  }
});

test("Phase 4 Success module: all child views use semantic containers, view switches, and unified filter bars", () => {
  const dir = join(process.cwd(), "src/features/success");
  const files = [
    "client-risks-view.tsx",
    "renewals-view.tsx",
    "portfolio-health-view.tsx",
    "check-ins-view.tsx",
    "retention-review-view.tsx",
    "client-success-profile.tsx",
    "waiting-view.tsx",
  ];
  for (const file of files) {
    const content = readFileSync(join(dir, file), "utf8");
    assert.match(content, /<main className="domain-page success-page"/, `${file} missing semantic main container`);
    assert.match(content, /className="task-context-header"/, `${file} missing task-context-header`);
    assert.match(content, /className="task-context-header__breadcrumb"/, `${file} missing breadcrumb navigation`);
    assert.doesNotMatch(content, /style=\{\{\s*display:\s*"inline-flex",\s*alignItems:\s*"center"/, `${file} contains legacy ad-hoc inline styles`);
  }
});

test("Phase 4 Team module: all child views use semantic containers and context headers", () => {
  const dir = join(process.cwd(), "src/features/team");
  const files = [
    "people-list.tsx",
    "ownership-map.tsx",
    "delegations-view.tsx",
    "one-on-one-view.tsx",
    "responsibilities-view.tsx",
    "team-review.tsx",
    "team-risks.tsx",
  ];
  for (const file of files) {
    const content = readFileSync(join(dir, file), "utf8");
    assert.match(content, /<main className="domain-page team-page"/, `${file} missing semantic main container`);
    assert.match(content, /className="task-context-header"/, `${file} missing task-context-header`);
    assert.match(content, /className="task-context-header__breadcrumb"/, `${file} missing breadcrumb navigation`);
  }
});

test("Phase 4 Founder, Commerce, Learning, and Life modules: semantic containers and headers", () => {
  const founderDir = join(process.cwd(), "src/features/founder");
  for (const file of ["founder-development.tsx", "founder-marketing.tsx", "founder-products.tsx", "supplier-orders.tsx"]) {
    const content = readFileSync(join(founderDir, file), "utf8");
    assert.match(content, /<main className="domain-page founder-page"/, `${file} missing semantic main container`);
    assert.match(content, /className="task-context-header"/, `${file} missing task-context-header`);
  }

  const commerceHome = readFileSync(join(process.cwd(), "src/features/commerce/commerce-home.tsx"), "utf8");
  assert.match(commerceHome, /className="task-context-header"/);
  assert.doesNotMatch(commerceHome, /style=\{\{\s*display:\s*"inline-flex",\s*alignItems:\s*"center"/);

  const learningHome = readFileSync(join(process.cwd(), "src/features/learning/learning-home.tsx"), "utf8");
  assert.match(learningHome, /<main className="domain-page learning-page/);
  assert.match(learningHome, /className="task-context-header"/);
  assert.doesNotMatch(learningHome, /style=\{\{\s*display:\s*"inline-flex",\s*alignItems:\s*"center"/);

  const lifeDir = join(process.cwd(), "src/features/life");
  for (const file of ["travel-workspace.tsx", "documents-workspace.tsx"]) {
    const content = readFileSync(join(lifeDir, file), "utf8");
    assert.match(content, /<main className="domain-page life-page"/, `${file} missing semantic main container`);
    assert.match(content, /className="task-context-header"/, `${file} missing task-context-header`);
  }
});
