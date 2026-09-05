import type { WorkspaceSnapshot } from "@/lib/intelligence/types";
import { asNumber, asString, daysBetween, endOfWeek, startOfWeek } from "@/lib/intelligence/time";

export function getFinancialIntelligence(snapshot: WorkspaceSnapshot) {
  const weekEnd = endOfWeek(snapshot.today, asNumber(snapshot.profile?.week_starts_on, 1));
  const nextSeven = new Date(new Date(`${snapshot.today}T12:00:00Z`).getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const dueThisWeek = snapshot.invoices.filter((invoice) => invoice.due_date && asString(invoice.due_date) >= snapshot.today && asString(invoice.due_date) <= weekEnd && !["paid", "cancelled"].includes(asString(invoice.status)));
  const overdue = snapshot.invoices.filter((invoice) => invoice.due_date && asString(invoice.due_date) < snapshot.today && !["paid", "cancelled"].includes(asString(invoice.status)));
  const renewals = snapshot.subscriptions.filter((item) => item.status === "active" && item.next_billing_date && asString(item.next_billing_date) >= snapshot.today && asString(item.next_billing_date) <= nextSeven);
  const expectedThisWeek = dueThisWeek.reduce((sum, invoice) => sum + asNumber(invoice.amount_remaining), 0);
  const overdueAmount = overdue.reduce((sum, invoice) => sum + asNumber(invoice.amount_remaining), 0);
  const renewalsNext7Days = renewals.reduce((sum, item) => sum + asNumber(item.amount), 0);
  const insights: string[] = [];
  if (expectedThisWeek > 0) insights.push(`${expectedThisWeek.toLocaleString("en")} MAD is expected this week.`);
  if (overdueAmount > 0) insights.push(`${overdueAmount.toLocaleString("en")} MAD is overdue across ${overdue.length} invoice${overdue.length === 1 ? "" : "s"}.`);
  if (renewalsNext7Days > 0) insights.push(`Subscription renewals total ${renewalsNext7Days.toLocaleString("en")} MAD in the next 7 days.`);
  return { expectedThisWeek, overdueAmount, overdueCount: overdue.length, renewalsNext7Days, currency: "MAD", insights };
}

export function getContentIntelligence(snapshot: WorkspaceSnapshot) {
  const nextSeven = new Date(new Date(`${snapshot.today}T12:00:00Z`).getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const stuck = snapshot.content.filter((item) => item.status === "review" && daysBetween(asString(item.updated_at ?? item.created_at), snapshot.today) >= 3);
  const dueSoon = snapshot.content.filter((item) => item.due_date && asString(item.due_date) >= snapshot.today && asString(item.due_date) <= nextSeven && !["published", "archived"].includes(asString(item.status)));
  const scheduled = snapshot.content.filter((item) => item.status === "scheduled" && asString(item.scheduled_at ?? item.publish_date).slice(0, 10) >= snapshot.today && asString(item.scheduled_at ?? item.publish_date).slice(0, 10) <= nextSeven);
  const insights: string[] = [];
  if (stuck.length) insights.push(`${stuck.length} content item${stuck.length === 1 ? " is" : "s are"} stuck in Review.`);
  if (dueSoon.length) insights.push(`${dueSoon.length} unfinished content deadline${dueSoon.length === 1 ? " is" : "s are"} inside the next 7 days.`);
  if (!scheduled.length) insights.push("No content is currently scheduled for the next 7 days.");
  return { stuckInReview: stuck.length, dueSoon: dueSoon.length, scheduledNext7Days: scheduled.length, insights };
}

export function getFitnessIntelligence(snapshot: WorkspaceSnapshot) {
  const weekStart = startOfWeek(snapshot.today, asNumber(snapshot.profile?.week_starts_on, 1));
  const activities = snapshot.fitnessActivities.filter((item) => asString(item.date ?? item.activity_date) >= weekStart && asString(item.date ?? item.activity_date) <= snapshot.today);
  const insights = snapshot.fitnessTargets.flatMap((target) => {
    const matching = activities.filter((item) => item.activity_type === target.activity_type);
    const actual = asString(target.target_type) === "sessions" ? matching.length : matching.reduce((sum, item) => sum + asNumber(item[asString(target.target_type)]), 0);
    const remaining = Math.max(0, asNumber(target.target_value) - actual);
    if (!remaining) return [`Your ${asString(target.activity_type)} target is complete for this week.`];
    return [`Your ${asString(target.activity_type)} target needs ${remaining} more ${asString(target.target_type).replaceAll("_", " ")}.`];
  });
  return { insights };
}
