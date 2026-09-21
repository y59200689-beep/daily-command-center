import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shell = readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
const domains = readFileSync(new URL("../src/features/domains/domain-page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/app/product-system.css", import.meta.url), "utf8");
const operations = readFileSync(new URL("../src/features/operations/operations-home.tsx", import.meta.url), "utf8");
const entityRoute = readFileSync(new URL("../src/app/api/entities/[domain]/route.ts", import.meta.url), "utf8");

test("mobile navigation exposes every workspace area and retains contextual links", () => {
  assert.match(shell, /mobile-area-switcher/);
  for (const area of ["Home", "Plan", "Business", "Operate", "Intelligence", "Personal"]) assert.match(shell, new RegExp(`label: "${area}"`));
  assert.match(shell, /aria-current=\{active \? "page"/);
  assert.match(shell, /aria-label="Close navigation"/);
});

test("tasks own horizontal scrolling without widening the page", () => {
  assert.match(css, /\.workspace,\.workspace__content,\.domain-page \{ min-width:0; \}/);
  assert.match(css, /\.task-list-frame \{[^}]*max-width:100%;[^}]*overflow-x:auto/);
  assert.match(css, /\.task-board \{[^}]*max-width:100%/);
  assert.match(css, /@media \(max-width:767px\)[\s\S]*\.task-list-frame \{ width:100%; margin-inline:0/);
  assert.doesNotMatch(css, /\.task-board \{ margin-inline:-/);
});

test("tasks provide grouped list, board, server filters, sorting, and cancelled access", () => {
  assert.match(domains, /Tasks grouped by status/);
  assert.match(domains, /aria-pressed=\{taskView === "list"\}/);
  assert.match(domains, /aria-label="Sort tasks"/);
  assert.match(domains, /const columns = \["inbox", "planned", "in_progress", "waiting", "blocked", "completed", "cancelled"\]/);
  assert.match(entityRoute, /status: request\.nextUrl\.searchParams\.get\("status"\)/);
  assert.match(entityRoute, /sort: request\.nextUrl\.searchParams\.get\("sort"\)/);
});

test("task detail and operations use purpose-built compact workspaces", () => {
  assert.match(domains, /className="task-detail-workspace"/);
  assert.match(domains, /Task properties/);
  assert.match(css, /\.modal--task/);
  assert.doesNotMatch(operations, /Documented operating procedures & versions/);
  assert.match(operations, />Review operations</);
  assert.match(css, /\.operations-nav-strip \{ display:flex/);
});
