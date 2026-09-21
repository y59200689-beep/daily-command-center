import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(new URL("../src/app/product-system.css", import.meta.url), "utf8");

test("Phase 5 CSS Design System: breadcrumbs, title rows, and total badge tokens", () => {
  // Breadcrumb navigation styling
  assert.match(css, /\.task-context-header__breadcrumb\b/);
  assert.match(css, /\.task-context-header__breadcrumb a\b/);
  assert.match(css, /\.task-context-header__breadcrumb \.current/);

  // Title row layout
  assert.match(css, /\.task-context-header__title-row\b/);

  // Total badge and status variants
  assert.match(css, /\.task-context-header__total-badge\b/);
  assert.match(css, /\.task-context-header__total-badge--danger\b/);
  assert.match(css, /\.task-context-header__total-badge--warning\b/);

  // Operations row actions
  assert.match(css, /\.operations-row__actions\b/);
});

test("Phase 5 Operations module: quality-center and process-list use CSS classes without inline styles", () => {
  const qualityCenter = readFileSync(join(process.cwd(), "src/features/operations/quality-center.tsx"), "utf8");
  assert.match(qualityCenter, /task-context-header__total-badge--danger/);
  assert.match(qualityCenter, /className="operations-row__actions"/);
  assert.doesNotMatch(qualityCenter, /style=\{\{\s*background:\s*"rgba\(239,68,68/);
  assert.doesNotMatch(qualityCenter, /style=\{\{\s*display:\s*"flex",\s*alignItems:\s*"center"/);

  const processList = readFileSync(join(process.cwd(), "src/features/operations/process-list.tsx"), "utf8");
  assert.match(processList, /className="operations-row__actions"/);
  assert.doesNotMatch(processList, /style=\{\{\s*display:\s*"flex",\s*alignItems:\s*"center"/);
});

test("Phase 5 Badge polish: warning and danger badges use unified CSS classes", () => {
  const teamRisks = readFileSync(join(process.cwd(), "src/features/team/team-risks.tsx"), "utf8");
  assert.match(teamRisks, /task-context-header__total-badge--danger/);
  assert.doesNotMatch(teamRisks, /style=\{\{\s*background:\s*"rgba\(239,68,68/);

  const knowledgeReview = readFileSync(join(process.cwd(), "src/features/knowledge/knowledge-review.tsx"), "utf8");
  assert.match(knowledgeReview, /task-context-header__total-badge--warning/);
  assert.doesNotMatch(knowledgeReview, /style=\{\{\s*background:\s*"rgba\(245,158,11/);

  const learningHome = readFileSync(join(process.cwd(), "src/features/learning/learning-home.tsx"), "utf8");
  assert.match(learningHome, /task-context-header__total-badge--warning/);
  assert.doesNotMatch(learningHome, /style=\{\{\s*background:\s*"rgba\(251,191,36/);

  const chiefHome = readFileSync(join(process.cwd(), "src/features/chief-of-staff/chief-of-staff-home.tsx"), "utf8");
  assert.match(chiefHome, /task-context-header__total-badge--warning/);
  assert.doesNotMatch(chiefHome, /style=\{\{\s*background:\s*"rgba\(251,191,36/);

  const actionCenters = readFileSync(join(process.cwd(), "src/features/v4/action-centers.tsx"), "utf8");
  assert.match(actionCenters, /task-context-header__total-badge--warning/);
  assert.doesNotMatch(actionCenters, /style=\{\{\s*background:\s*"rgba\(245,158,11/);
});

test("Phase 5 Founder Products: recovery route to business settings is available", () => {
  const founderProducts = readFileSync(join(process.cwd(), "src/features/founder/founder-products.tsx"), "utf8");
  assert.match(founderProducts, /href="\/settings\/business"/);
  assert.match(founderProducts, /Set up company/);
});

test("Phase 5 Route Inventory: all 34 unblocked concrete routes have valid page entrypoints", () => {
  const unblockedRoutes = [
    "commerce",
    "control-tower",
    "founder/products",
    "growth/experiments",
    "growth/playbooks",
    "knowledge/collections",
    "life",
    "operations/processes",
    "operations/quality",
    "operations/runbooks",
    "operations/runs",
    "operations/sops",
    "operations/systems",
    "plan/90-days",
    "plan/month",
    "plan/quarter",
    "review/weekly",
    "strategy/scenarios",
    "success/check-ins",
    "success/journey",
    "success/portfolio",
    "success/renewals",
    "success/review",
    "success/risks",
    "team/1on1",
    "team/capacity",
    "team/delegations",
    "team/ownership",
    "team/people",
    "team/responsibilities",
    "team/review",
    "team/risks",
    "today",
    "travel",
  ];

  for (const route of unblockedRoutes) {
    const pagePath = join(process.cwd(), "src/app/(workspace)", route, "page.tsx");
    assert.ok(existsSync(pagePath), `Missing page route file: ${pagePath}`);
    const content = readFileSync(pagePath, "utf8");
    assert.match(content, /export default function/, `${pagePath} missing default export function`);
  }
});
