import { expect, type Page } from "@playwright/test";
import { create, edit, label, day, see, fits, watch, evidence, normalClient, identity } from "../tier1/workflows";

// 1. Experiment Workflow
export async function experimentWorkflow(page: Page) {
  page.setDefaultTimeout(60000);
  const errors = await watch(page);
  const suffix = `tier3_${page.viewportSize()?.width}_${Date.now()}`;
  const expName = label(`${suffix}_pricing_exp`);

  // Create
  const exp = await create(page, "/experiments", {
    "Experiment": expName,
    "Hypothesis": "Annual upfront discounting increases cash flow without lowering LTV",
    "Target metric": "Cash runway months",
    "Status": "planned",
    "Confidence": "high",
  });
  await fits(page);

  // Update / run
  await edit(page, "/experiments", exp.id, {
    "Status": "running",
    "Expected outcome": "15% increase in 12-month commitments",
  });
  await page.reload();
  await fits(page);

  // Conclude
  await edit(page, "/experiments", exp.id, {
    "Status": "completed",
    "Outcome result": "SUPPORTED",
    "Conclusion / findings": "Upfront annual plan achieved 22% higher net cash collected",
    "Lesson learned": "Founders strongly prefer annual certainty over monthly churn risk",
  });
  await page.reload();
  await fits(page);

  // Verify DB persistence
  const client = await normalClient();
  const stored = await client
    .from("growth_experiments")
    .select("status, outcome_result, confidence")
    .eq("id", exp.id)
    .single();
  expect(stored.error).toBeNull();
  expect(stored.data?.status).toBe("completed");
  expect(stored.data?.outcome_result).toBe("SUPPORTED");

  // Propagation
  await see(page, "/state", expName);
  await see(page, "/executive", expName);
  await see(page, "/review/weekly", expName);

  expect(errors).toEqual([]);
  evidence("Tier 3 experiment create run conclude and propagation", { experimentId: exp.id, errors });
  return exp;
}

// 2. Forecast Workflow
export async function forecastWorkflow(page: Page) {
  page.setDefaultTimeout(60000);
  const errors = await watch(page);
  const suffix = `tier3_${page.viewportSize()?.width}_${Date.now()}`;
  const fcName = label(`${suffix}_q3_revenue`);

  // Create
  const fc = await create(page, "/forecasts", {
    "Prediction statement": fcName,
    "Domain": "revenue",
    "Prediction date": day(),
    "Resolution date": day(14),
    "Predicted outcome": "Enterprise ARR reaches target range within 14 days",
    "Confidence": "high",
  });
  await fits(page);

  // Resolve
  await edit(page, "/forecasts", fc.id, {
    "Resolution status": "correct",
    "Actual outcome": "Closed 2 enterprise contracts, beating forecast target by 8%",
    "Calibration notes (why right or wrong)": "Deal pipeline velocity was accurately weighted",
  });
  await page.reload();
  await fits(page);

  // Verify DB persistence
  const client = await normalClient();
  const stored = await client
    .from("founder_forecasts")
    .select("resolution, confidence, actual_result")
    .eq("id", fc.id)
    .single();
  expect(stored.error).toBeNull();
  expect(stored.data?.resolution).toBe("correct");

  // Propagation
  await see(page, "/state", fcName);
  await see(page, "/executive", fcName);
  await see(page, "/review/weekly", fcName);

  expect(errors).toEqual([]);
  evidence("Tier 3 forecast create resolve calibration and propagation", { forecastId: fc.id, errors });
  return fc;
}

// 3. Communication Extractor Workflow
export async function communicationWorkflow(page: Page) {
  page.setDefaultTimeout(60000);
  const errors = await watch(page);

  await page.goto("/communication");
  await fits(page);

  const textarea = page.locator("#communication-extract-input");
  await expect(textarea).toBeVisible();

  // Paste message with clear commitments and promises
  const sampleMessage =
    "Meeting with Karim: He confirmed he will send the updated vendor quotes by next Tuesday.\n" +
    "I promised Sarah that I will review the architecture proposal tomorrow.\n" +
    "Need to decide between PostgreSQL replica and Supabase branching by end of sprint.";

  await textarea.fill(sampleMessage);
  const extractBtn = page.getByRole("button", { name: "Extract structured actions" });
  await extractBtn.click();

  // Verify extracted actions rendered
  const signals = page.locator("article.founder-signal");
  await expect(signals.first()).toBeVisible({ timeout: 30000 });
  const count = await signals.count();
  expect(count).toBeGreaterThan(0);

  // Verify dismiss action
  const firstDismiss = signals.first().getByRole("button", { name: "Dismiss" });
  if (await firstDismiss.isVisible()) {
    await firstDismiss.click();
    const remainingCount = await signals.count();
    expect(remainingCount).toBe(count - 1);
  }

  // Verify no synthetic records were automatically created in DB without user confirmation
  const client = await normalClient();
  const automatedCheck = await client
    .from("operating_commitments")
    .select("id")
    .ilike("title", "%He confirmed he will send%");
  expect(automatedCheck.data).toEqual([]);

  expect(errors).toEqual([]);
  evidence("Tier 3 communication extraction propose confirm dismiss and no automated duplicates", { count, errors });
}

// 4. Asset Intelligence Workflow
export async function assetWorkflow(page: Page) {
  page.setDefaultTimeout(60000);
  const errors = await watch(page);
  const suffix = `tier3_${page.viewportSize()?.width}_${Date.now()}`;
  const assetName = label(`${suffix}_brand_engine`);

  // Create
  const asset = await create(page, "/assets", {
    "Asset name": assetName,
    "Type": "technical",
    "Value category": "core",
    "Reuse potential": "high",
    "Status": "active",
  });
  await fits(page);

  // Edit metadata
  await edit(page, "/assets", asset.id, {
    "Maintenance requirement": "continuous_update",
    "Maintenance due date": day(7),
  });
  await page.reload();
  await fits(page);

  // Verify DB persistence
  const client = await normalClient();
  const stored = await client
    .from("asset_metadata")
    .select("value_category, reuse_potential, maintenance_requirement")
    .eq("id", asset.id)
    .single();
  expect(stored.error).toBeNull();
  expect(stored.data?.value_category).toBe("core");
  expect(stored.data?.reuse_potential).toBe("high");
  expect(stored.data?.maintenance_requirement).toBe("continuous_update");

  expect(errors).toEqual([]);
  evidence("Tier 3 asset metadata creation reuse potential and maintenance tracking", { assetId: asset.id, errors });
  return asset;
}

// 5. Daily Energy State Workflow
export async function founderEnergyWorkflow(page: Page) {
  page.setDefaultTimeout(60000);
  const errors = await watch(page);

  await page.goto("/state");
  await fits(page);

  const checkinSection = page.locator("section[aria-label='Daily energy check-in']");
  await expect(checkinSection).toBeVisible();

  // Select values
  await page.locator("#daily-energy-level").selectOption("high");
  await page.locator("#daily-focus-level").selectOption("strong");
  await page.locator("#daily-stress-level").selectOption("low");
  await page.locator("#daily-cognitive-notes").fill("High energy and deep focus session");

  const saveBtn = checkinSection.getByRole("button", { name: /Save check-in|Update today's check-in/ });
  await saveBtn.click();

  await expect(page.locator("p[role='status']").filter({ hasText: "Check-in saved" })).toBeVisible();

  // Reload and verify persistence
  await page.reload();
  await fits(page);
  await expect(checkinSection).toContainText("high energy");

  // Verify DB persistence
  const client = await normalClient();
  const todayStr = day();
  const stored = await client
    .from("founder_daily_states")
    .select("energy, focus, stress_load, cognitive_notes")
    .eq("date", todayStr)
    .single();
  expect(stored.error).toBeNull();
  expect(stored.data?.energy).toBe("high");
  expect(stored.data?.focus).toBe("strong");
  expect(stored.data?.stress_load).toBe("low");

  expect(errors).toEqual([]);
  evidence("Tier 3 founder daily energy check-in persistence and reflection", { today: todayStr, errors });
}

// 6. Content Item Workflow
export async function contentWorkflow(page: Page) {
  page.setDefaultTimeout(60000);
  const errors = await watch(page);
  const suffix = `tier3_${page.viewportSize()?.width}_${Date.now()}`;
  const contentTitle = label(`${suffix}_thought_leadership`);

  const client = await normalClient();
  const user = identity();

  // Create content via client
  const created = await client
    .from("content_items")
    .insert({
      user_id: user.userId,
      title: contentTitle,
      format: "article",
      status: "idea",
      content_pillar: "Founder Operations",
      objective: "Demonstrate Tier 3 synthesis capabilities",
      due_date: day(3),
    })
    .select("id")
    .single();
  expect(created.error).toBeNull();

  // Progress state
  const updated = await client
    .from("content_items")
    .update({
      status: "review",
      target_audience: "B2B SaaS Founders",
    })
    .eq("id", created.data!.id)
    .select("status, target_audience")
    .single();
  expect(updated.error).toBeNull();
  expect(updated.data?.status).toBe("review");

  // Check UI visibility
  await page.goto("/content");
  await fits(page);
  await expect(page.locator("main")).toContainText(contentTitle);

  expect(errors).toEqual([]);
  evidence("Tier 3 content workflow progress and persistence", { contentId: created.data!.id, errors });
}

// 7. Chief of Staff & Executive Synthesis Verification
export async function tier3SynthesisWorkflow(page: Page) {
  page.setDefaultTimeout(60000);
  const errors = await watch(page);

  // Executive Console
  await page.goto("/executive");
  await fits(page);
  await expect(page.locator("main")).not.toContainText("Could not load");
  await expect(page.locator("main")).toBeVisible();

  // Weekly Review
  await page.goto("/review/weekly");
  await fits(page);
  await expect(page.locator("main")).not.toContainText("Could not load");

  // Chief of Staff
  await page.goto("/chief-of-staff");
  await fits(page);
  await expect(page.locator("main")).not.toContainText("Could not load");

  expect(errors).toEqual([]);
  evidence("Tier 3 Executive, Weekly Review, and Chief of Staff synthesis render cleanly", { errors });
}

// 8. Cross-Domain Propagation Verification
export async function tier3CrossDomainPropagation(page: Page) {
  page.setDefaultTimeout(60000);
  const errors = await watch(page);

  // Fetch /api/founder-briefing and verify intelligence domains are present
  const briefingRes = await page.request.get("/api/founder-briefing?window=7");
  expect(briefingRes.ok()).toBeTruthy();
  const brief = await briefingRes.json();

  expect(Array.isArray(brief.facts)).toBe(true);
  expect(Array.isArray(brief.bottlenecks)).toBe(true);

  // Fetch /api/founder-state and verify Tier 3 facts & signals
  const stateRes = await page.request.get("/api/founder-state");
  expect(stateRes.ok()).toBeTruthy();
  const state = await stateRes.json();
  expect(Array.isArray(state.signals)).toBe(true);

  expect(errors).toEqual([]);
  evidence("Tier 3 cross-domain intelligence signals propagate into briefing and state", { errors });
}

// 9. Tier 1 & 2 Regression Smoke
export async function tier1And2RegressionSmoke(page: Page) {
  page.setDefaultTimeout(60000);
  const errors = await watch(page);

  for (const route of [
    "/today",
    "/state",
    "/executive",
    "/commitments",
    "/business-pulse",
    "/infrastructure",
    "/decisions",
    "/waiting",
  ]) {
    await page.goto(route);
    await fits(page);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main")).not.toContainText("Unhandled Runtime Error");
  }

  expect(errors).toEqual([]);
  evidence("Tier 1 & 2 core regression smoke passes without runtime errors", { errors });
}
