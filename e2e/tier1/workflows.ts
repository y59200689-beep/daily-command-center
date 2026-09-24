import { expect, type Page, type Locator } from "@playwright/test";
import { readFileSync, appendFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { getE2ETarget } from "../../scripts/e2e/target.mjs";
import { snapshotRegistry } from "../../scripts/e2e/registry.mjs";

export const identity = () => JSON.parse(readFileSync(".playwright-auth/user-meta.json", "utf8"));
export const label = (name: string) => `TIER1_E2E_${identity().runId}_${name}`;
export const day = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
export async function normalClient() {
 const state = JSON.parse(readFileSync(".playwright-auth/user.json", "utf8"));
 const target = getE2ETarget();
 const client = createServerClient(target.url, target.anonKey, { cookies: { getAll: () => state.cookies, setAll: () => {} } });
 const { data, error } = await client.auth.getUser();
 expect(error).toBeNull(); expect(data.user?.id).toBe(identity().userId);
 return client;
}
export async function fill(form: Locator, fields: Record<string, string | boolean>) {
 for (const [name, value] of Object.entries(fields)) {
   const escaped = name.replaceAll("?", "[?]").replaceAll("(", "[(]").replaceAll(")", "[)]");
   const namePattern = new RegExp(`^${escaped}(?: [*]| ?Optional)?$`);
   const field = form.getByRole("combobox", { name: namePattern }).or(form.getByRole("textbox", { name: namePattern })).or(form.getByRole("spinbutton", { name: namePattern })).or(form.getByRole("button", { name: namePattern })).or(form.getByLabel(namePattern));
   if (typeof value === "boolean") await field.setChecked(value);
   else if (await field.evaluate(el => el.tagName) === "SELECT") await field.selectOption(value);
   else if (await field.evaluate(el => el.tagName) === "BUTTON") {
     await field.click();
     const dateName = new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
     await form.getByRole("dialog", { name: "Calendar date picker" }).getByRole("button", { name: dateName, exact: true }).click();
   }
   else await field.fill(value);
 }
}
export async function save(page: Page, button = "Save record") {
 const response = page.waitForResponse(r => r.url().includes("/api/") && ["POST", "PATCH", "DELETE"].includes(r.request().method()));
 await page.getByRole("button", { name: button, exact: true }).click();
 const res = await response; const body = await res.json();
 expect(res.ok(), JSON.stringify(body)).toBeTruthy();
 snapshotRegistry();
 return body.record;
}
export async function create(page: Page, route: string, fields: Record<string, string | boolean>) {
 await page.goto(route);
 await page.getByRole("button", { name: "Add record", exact: true }).first().click();
 await fill(page.getByRole("dialog"), fields);
 const row = await save(page);
 await expect(page.getByRole("dialog")).toBeHidden();
 return row;
}
export async function edit(page: Page, route: string, id: string, fields: Record<string, string | boolean>) {
 await page.goto(`${route}?record=${id}`);
 await expect(page.getByRole("dialog")).toBeVisible({ timeout: 60000 });
 await fill(page.getByRole("dialog"), fields);
 const row = await save(page);
 await expect(page.getByRole("dialog")).toBeHidden();
 return row;
}
export async function fits(page: Page) {
 const size = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
 expect(size.content, `${page.url()} horizontal overflow`).toBeLessThanOrEqual(size.width + 1);
}
export async function revealDetails(page: Page) {
 await expect(page.locator("main")).not.toContainText(/Loading review…|Loading decision|Assembling briefing…/, { timeout: 30000 });
 const closed = page.locator("main details:not([open]) > summary");
 while (await closed.count()) await closed.first().click();
}
export async function see(page: Page, route: string, title: string) {
 await page.goto(route);
 await expect(page.locator("main")).not.toContainText("Assembling briefing…", { timeout: 30000 });
 await revealDetails(page);
 await expect(page.locator("main").getByText(title, { exact: false }).first()).toBeVisible({ timeout: 60000 });
 await fits(page);
}
export async function watch(page: Page) {
 await page.addInitScript(() => {
  const original = console.error;
  console.error = (...args) => original(...args, new Error("E2E console origin").stack);
 });
 const errors: string[] = [];
 page.on("pageerror", e => errors.push(e.message));
 page.on("console", m => {
  if (m.type() === "warning" && /\.woff2.*was preloaded using link preload but not used/.test(m.text())) { evidence("benign unused font preload warning", m.text()); return; }
  if (["error", "warning"].includes(m.type()) && !/Download the React DevTools/.test(m.text())) errors.push(`${m.type()}: ${m.text()}`);
 });
 page.on("response", r => { if (r.url().includes("/api/") && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
 return errors;
}
export function evidence(name: string, result: unknown) {
 appendFileSync(".playwright-auth/evidence.jsonl", JSON.stringify({ name, result }) + "\n", { mode: 0o600 });
}

export async function propagationWorkflow(page: Page, mobile: boolean) {
 page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(180000);
 const suffix = mobile ? `mobile_${page.viewportSize()?.width}` : "desktop";
 const errors = await watch(page);
 const decisionTitle = label(`${suffix}_attention_decision`), issueTitle = label(`${suffix}_high_issue`), riskTitle = label(`${suffix}_risk`);
 const decision = await create(page, "/decisions", { "Decision title": decisionTitle, "What is being decided?": "Controlled verification decision", Status: "proposed", Impact: "high", "Decision deadline": day(-1), "Review date": day(-1), "Founder decision required": true, Assumptions: "Synthetic owner only", "Expected outcome": "Persist and propagate", "Expected metric": "Successful reviews" });
 await edit(page, "/decisions", decision.id, { Rationale: "Edited context persists" });
 await page.reload(); await expect(page.getByRole("heading", { name: decisionTitle, exact: true })).toBeVisible();
 for (const route of ["/state", "/today", "/executive", "/review/weekly"]) await see(page, route, decisionTitle);
 const issue = await create(page, "/issues", { Issue: issueTitle, "What happened?": "Synthetic service interruption", "Reported severity": "critical", Impact: "critical", Urgency: "immediate", "Founder intervention required": true });
 const risk = await create(page, "/risks/register", { Risk: riskTitle, "Probability (1–5)": "2", "Impact (1–5)": "2", "Early warning signal": "Synthetic warning", Mitigation: "Controlled mitigation", Contingency: "Controlled fallback", Owner: label("owner") });
 const me = await create(page, "/commitments", { Promise: label(`${suffix}_waiting_me`), Who: label("counterpart"), Direction: "owed_by_me", Importance: "high", "Due date": day(-2) });
 await edit(page, "/commitments", me.id, { "Expected outcome": "Mobile and desktop edited promise" });
 await page.reload(); await expect(page.getByRole("heading", { name: me.title, exact: true })).toBeVisible();
 await page.goto("/waiting/manage"); await page.getByRole("button", { name: "Track request", exact: true }).first().click();
 await fill(page.getByRole("dialog"), { "Waiting for": label(`${suffix}_waiting_others`), Contact: label("supplier"), "Expected by": `${day(-2)}T10:00`, "Follow-up date": day(-1), Importance: "high", Direction: "owed_to_me", "Blocking revenue": "true", Impact: "Synthetic overdue blocker" });
 await expect(page.getByRole("dialog").locator("button button")).toHaveCount(0);
 await page.getByRole("button", { name: "Clear date", exact: true }).click();
 await fill(page.getByRole("dialog"), { "Follow-up date": day(-1) });
 const waiting = await save(page, "Save changes");
 await see(page, "/waiting", waiting.title);
 const others = page.locator("section").filter({ has: page.getByRole("heading", { name: "Who is waiting?" }) });
 await expect(others).toContainText(me.title);
 await expect(others).toContainText("overdue");
 for (const route of ["/state", "/executive", "/review/weekly"]) await see(page, route, issueTitle);
 for (const route of ["/state", "/today", "/waiting"]) await see(page, route, waiting.title);
 await page.goto("/changes");
 await save(page, "Save reviewed state");
 // Only the normal synthetic user's historical fixture is dated back to exercise the comparison window.
 const client = await normalClient();
 const historical = await client.from("executive_snapshots").update({ snapshot_date: day(-8) }).eq("user_id", identity().userId).eq("scope", "combined").select("id,snapshot_date");
 expect(historical.error).toBeNull(); expect(historical.data).toHaveLength(1); expect(historical.data![0].snapshot_date).toBe(day(-8)); snapshotRegistry();
 await edit(page, "/risks/register", risk.id, { "Probability (1–5)": "5", "Impact (1–5)": "5", Status: "monitoring" });
 for (const route of ["/state", "/executive", "/review/weekly"]) await see(page, route, riskTitle);
 await page.goto("/state");
 const signal = page.locator(".founder-signal").filter({ hasText: decisionTitle }).first();
 await signal.getByText("Why am I seeing this?", { exact: true }).click();
 await expect(signal).toContainText("Review date");
 await signal.getByRole("link").first().click(); await expect(page).toHaveURL(/decisions/);
 // The high-impact ownerless issue is a supported founder bottleneck with its source link.
 await page.goto("/executive");
 const bottlenecks = page.locator("section").filter({ has: page.getByRole("heading", { name: "Founder bottlenecks", exact: true }) });
 await expect(bottlenecks).toContainText(`${issueTitle}: no resolution owner`);
 await expect(bottlenecks).toContainText("An unresolved high-impact issue has no owner recorded");
 await bottlenecks.getByRole("link", { name: new RegExp(issueTitle) }).click(); await expect(page).toHaveURL(new RegExp(`/issues/${issue.id}`));
 await fits(page);
 await see(page, "/review/weekly", `${issueTitle}: no resolution owner`);
 await edit(page, "/issues", issue.id, { Status: "resolved", "Resolution / what did we do?": "Restored synthetic workflow" });
 await page.goto(`/issues/${issue.id}`); await revealDetails(page);
 await fill(page.locator("main"), { summary: "Synthetic resolution", "underlying cause": "Controlled failure condition", detection: "Browser check", resolution: "Restored synthetic workflow", prevention: "Keep regression coverage", "operational impact": "No real operation affected", "followup on": day(2), "Postmortem status": "completed" });
 await page.locator("details").filter({ has: page.locator("summary", { hasText: /^Learning$/ }) }).getByRole("textbox", { name: "lesson", exact: true }).fill(label("postmortem_lesson"));
 await save(page, "Save review");
 await save(page, "Create preventive task"); await save(page, "Create follow-up review");
 await page.getByText("Save as Operating Lesson", { exact: true }).click();
 await page.getByRole("button", { name: "Propose lesson", exact: true }).click();
 await expect(page.getByText("Proposed lesson is ready for review in Operating Memory.")).toBeVisible(); snapshotRegistry();
 await page.reload(); await revealDetails(page);
 await expect(page.getByRole("textbox", { name: "underlying cause", exact: true })).toHaveValue("Controlled failure condition");
 await fits(page);
 await page.goto(`/decisions/${decision.id}`); await revealDetails(page);
 await page.getByRole("button", { name: "Add option", exact: true }).click();
 await fill(page.locator("fieldset").last(), { label: label("selected_option"), description: "Controlled option", Selected: true });
 await page.getByLabel("Expected metric value", { exact: true }).fill("2");
 await page.getByRole("button", { name: "Review Decision", exact: true }).click();
 await fill(page.locator("main"), { "actual outcome": "Synthetic workflow verified", "Actual metric value": "3" });
 await page.locator("section").filter({ has: page.getByRole("heading", { name: "Compare expectation with outcome" }) }).getByRole("textbox", { name: "lesson", exact: true }).fill(label("decision_lesson"));
 await expect(page.getByText("Variance: 1", { exact: true })).toBeVisible();
 await save(page, "Save review");
 await page.getByText("Save as Operating Lesson", { exact: true }).click();
 await page.getByRole("button", { name: "Propose lesson", exact: true }).click();
 await expect(page.getByText("Proposed lesson is ready for review in Operating Memory.")).toBeVisible(); snapshotRegistry();
 await page.reload(); await revealDetails(page);
 await expect(page.getByRole("textbox", { name: "actual outcome", exact: true })).toHaveValue("Synthetic workflow verified");
 await expect(page.getByLabel("Selected", { exact: true })).toBeChecked();
 await expect(page.locator("main")).toContainText("Edited context persists");
 await expect(page.locator("main")).toContainText("Synthetic owner only");
 await expect(page.locator("main")).toContainText("Persist and propagate");
 await fits(page);
 await see(page, "/changes", issueTitle);
 await expect(page.locator("main")).toContainText("open → resolved");
 await expect(page.locator("main")).toContainText("review_due → validated");
 await expect(page.locator("main")).toContainText("probability 5; impact 5");
 await expect(page.locator("main")).not.toContainText("updated_at");
 await page.goto("/review/weekly"); await revealDetails(page);
 for (const heading of ["Outcomes", "Problems", "Decisions", "Risks", "Waiting For", "Founder Attention", "Lessons", "Next Week"]) await expect(page.locator("summary").filter({ hasText: new RegExp(`^${heading} ·`) })).toBeVisible();
 await save(page, "Start reflection from this evidence");
 await page.getByRole("link", { name: "Open saved reflection →" }).click(); await expect(page).toHaveURL(/learning\/retrospectives\//, { timeout: 180000 }); await fits(page);
 expect(errors, errors.join("\n")).toEqual([]);
 evidence(`${suffix} propagation/review`, "PASS");
}

export async function dependenciesAndCapture(page: Page) {
 const errors = await watch(page); page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(180000);
 const suffix = `capture_${page.viewportSize()?.width}`;
 for (const kind of ["task", "decision", "waiting", "issue", "risk"]) {
  await page.goto("/today");
  await page.getByRole("button", { name: /^(Capture|Quick capture)$/i }).first().click();
  const title = label(`${suffix}_${kind}`);
  await page.getByRole("dialog").getByLabel("Quick capture", { exact: true }).fill(`${kind} ${title}`);
  const captured = await save(page, kind === "issue" || kind === "risk" ? "Save to Inbox" : `Save ${kind[0].toUpperCase()}${kind.slice(1)}`);
  if (["issue", "risk"].includes(kind)) {
   await page.goto("/inbox");
   await page.locator("article.inbox-item").filter({ hasText: title.replaceAll("_", " ") }).getByRole("button", { name: "Clear", exact: true }).click();
   await expect(page.getByRole("dialog")).toBeVisible();
   await expect(page.getByRole("dialog").getByRole("textbox", { name: kind === "issue" ? /^Issue/ : /^Risk/ })).toHaveValue(title);
   await save(page);
   await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
   const inbox = await page.request.get(`/api/entities/inbox/${captured.id}`);
   expect((await inbox.json()).record.status).toBe("processed");
  } else {
   const route = kind === "task" ? "/tasks" : kind === "decision" ? "/decisions" : "/waiting";
   await see(page, route, kind === "task" ? title.replaceAll("_", " ") : title);
  }
 }
 const issueTitle = label(`${suffix}_dependency_issue`), riskTitle = label(`${suffix}_dependency_risk`);
 const issue = await create(page, "/issues", { Issue: issueTitle, "What happened?": "Synthetic dependency endpoint" });
 const risk = await create(page, "/risks/register", { Risk: riskTitle });
 await page.goto("/dependencies"); await page.getByRole("button", { name: "Add record", exact: true }).first().click();
 const dialog = page.getByRole("dialog");
 await fill(dialog, { "Source type": "risk", "Depends on type": "issue", "Search endpoint records": label(suffix) });
 await dialog.getByLabel("Source record", { exact: false }).selectOption({ label: riskTitle });
 await dialog.getByLabel("Depends on record", { exact: false }).selectOption({ label: issueTitle });
 await fill(dialog, { "Dependency label": label(`${suffix}_blocked`), State: "blocked", "Downstream impact": "Risk blocked by issue" });
 const dependency = await save(page);
 await page.goto(`/risks/register?record=${risk.id}`); await expect(page.getByRole("dialog")).toContainText(issueTitle); await fits(page);
 await page.goto(`/issues/${issue.id}`); await expect(page.locator(".founder-dependency-panel")).toContainText(riskTitle); await fits(page);
 await page.goto(`/dependencies?record=${dependency.id}`);
 page.once("dialog", d => d.accept());
 await save(page, "Delete record");
 await page.goto(`/issues/${issue.id}`); await expect(page.locator(".founder-dependency-panel")).toContainText("No downstream dependencies recorded");
 expect(errors, errors.join("\n")).toEqual([]);
 // Deliberately rejected input is inspected separately from unexpected API errors.
 await page.goto("/dependencies"); await page.getByRole("button", { name: "Add record", exact: true }).first().click();
 await fill(page.getByRole("dialog"), { "Source type": "issue", "Depends on type": "issue", "Search endpoint records": issueTitle });
 await page.getByLabel("Source record", { exact: false }).selectOption({ label: issueTitle });
 await page.getByLabel("Depends on record", { exact: false }).selectOption({ label: issueTitle });
 await fill(page.getByRole("dialog"), { "Dependency label": label("invalid_self_link") });
 const rejected = page.waitForResponse(r => r.url().endsWith("/api/operating/dependencies") && r.request().method() === "POST");
 await page.getByRole("button", { name: "Save record", exact: true }).click(); expect((await rejected).status()).toBe(400);
 await expect(page.getByRole("dialog").getByRole("alert")).toContainText("cannot depend on itself"); await fits(page);
 evidence(`${suffix} dependencies/capture`, "PASS");
}
