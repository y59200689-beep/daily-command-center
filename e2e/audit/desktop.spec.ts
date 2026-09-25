import { expect, test } from "@playwright/test";
import { label } from "../tier1/workflows";
import { snapshotRegistry } from "../../scripts/e2e/registry.mjs";

test("task creation and permanent deletion round trip", async ({ page }) => {
  test.setTimeout(180_000);
  const title = label("audit_task_create_delete");
  await page.goto("/tasks");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: /^Task Name/ }).fill(title);
  const createdResponse = page.waitForResponse((response) => response.url().includes("/api/entities/tasks") && response.request().method() === "POST");
  await dialog.getByRole("button", { name: "Create task" }).click();
  const created = await createdResponse;
  if (!created.ok()) console.log(`Task create response ${created.status()}: ${await created.text()}`);
  expect(created.ok()).toBeTruthy();
  const { record } = await created.json();
  snapshotRegistry();
  await page.goto("/tasks");
  await page.getByRole("button", { name: `Open ${title}` }).click();
  await expect(page.getByRole("dialog").getByRole("textbox", { name: /^Task Name/ })).toHaveValue(title);
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  const deletedResponse = page.waitForResponse((response) => response.url().includes(`/api/entities/tasks/${record.id}`) && response.request().method() === "DELETE");
  await page.getByRole("dialog").getByRole("button", { name: "Confirm permanent delete" }).click();
  expect((await deletedResponse).ok()).toBeTruthy();
  await expect(page.getByRole("dialog")).toBeHidden();
  const readBack = await page.request.get(`/api/entities/tasks/${record.id}`);
  expect(readBack.status()).toBe(404);
});
