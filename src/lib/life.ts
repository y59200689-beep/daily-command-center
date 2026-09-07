export type LifeTrip = { id: string; title: string; destination_country: string | null; destination_city: string | null; start_date: string | null; end_date: string | null; status: string; budget: number | null; currency: string };
export type LifeDocument = { id: string; label: string; expires_at: string | null; archived_at?: string | null };

export function documentExpiryStatus(expiresAt: string | null, today = new Date().toISOString().slice(0, 10)) {
  if (!expiresAt) return "no_expiry" as const;
  const days = Math.floor((Date.parse(`${expiresAt}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (days < 0) return "expired" as const;
  if (days <= 60) return "expires_soon" as const;
  return "valid" as const;
}

export function documentIsValidThrough(expiresAt: string | null, through: string | null) {
  // An unknown expiry cannot be asserted as valid for travel; the user can still
  // keep such a document as an optional reference, but it does not satisfy a
  // required trip-document link.
  return Boolean(expiresAt && through && expiresAt >= through);
}

export function tripReadiness(input: { trip: LifeTrip; documentLinks: Array<{ required: boolean; document: LifeDocument | null }>; visas: Array<{ status: string }>; reservations: Array<{ type: string; status: string }>; requiredTasks: Array<{ status: string }> }, today = new Date().toISOString().slice(0, 10)) {
  const reasons: string[] = [];
  const departureDays = input.trip.start_date ? Math.floor((Date.parse(`${input.trip.start_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000) : null;
  const travelEnd = input.trip.end_date ?? input.trip.start_date ?? today;
  const missingDocuments = input.documentLinks.filter((link) => link.required && (!link.document || !documentIsValidThrough(link.document.expires_at, travelEnd)));
  if (missingDocuments.length) reasons.push(`${missingDocuments.length} required document${missingDocuments.length === 1 ? " is" : "s are"} missing or not valid.`);
  if (input.visas.some((visa) => ["preparing", "appointment_booked", "submitted", "additional_documents_requested"].includes(visa.status))) reasons.push("Visa application still needs review.");
  const bookingTypes = new Set(input.reservations.filter((reservation) => !["canceled"].includes(reservation.status)).map((reservation) => reservation.type));
  if (!bookingTypes.has("flight") && departureDays !== null && departureDays <= 30) reasons.push("No flight booking is recorded.");
  if (!bookingTypes.has("hotel") && !bookingTypes.has("riad") && !bookingTypes.has("apartment") && departureDays !== null && departureDays <= 30) reasons.push("No stay reservation is recorded.");
  const openTasks = input.requiredTasks.filter((task) => !["completed", "cancelled"].includes(task.status)).length;
  if (openTasks) reasons.push(`${openTasks} trip task${openTasks === 1 ? " remains" : "s remain"}.`);
  const status = reasons.length === 0 ? "ready" : departureDays !== null && departureDays <= 14 ? "at_risk" : "needs_attention";
  return { status, reasons, departureDays };
}

export type LifeSignal = { id: string; title: string; message: string; route: string; priority: number; kind: string };
export function rankLifeSignals(signals: LifeSignal[], maximum = 3) { return [...signals].sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title)).slice(0, maximum); }

export type CurrencyAmount = { currency: string | null | undefined; amount: number | string | null | undefined };

/**
 * Keeps personal/trip money honest: values are only totalled within their own
 * currency.  Consumers can use the result for a budget, a receipt list, or a
 * renewal without implying that we know an FX rate.
 */
export function totalsByCurrency(items: CurrencyAmount[]) {
  return items.reduce<Record<string, number>>((totals, item) => {
    const amount = Number(item.amount);
    const currency = (item.currency || "MAD").toUpperCase();
    if (Number.isFinite(amount)) totals[currency] = (totals[currency] ?? 0) + amount;
    return totals;
  }, {});
}

export function remainingTripBudget(budget: number | string | null | undefined, currency: string | null | undefined, expenses: CurrencyAmount[]) {
  if (budget == null || !currency) return null;
  const total = totalsByCurrency(expenses)[currency.toUpperCase()] ?? 0;
  return Number(budget) - total;
}

export function nextRoutineDate(days: number[], today = new Date()) {
  if (!days.length) return null;
  // Work from the supplied calendar date in UTC so server/client timezone
  // formatting cannot move a weekday across a boundary.
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  // “Next” is deliberately a future occurrence. The current day remains due in
  // the routine view, while this helper avoids describing an already-in-progress
  // day as the next scheduled occurrence.
  for (let offset = 1; offset <= 7; offset += 1) { const candidate = new Date(date); candidate.setUTCDate(date.getUTCDate() + offset); if (days.includes(candidate.getUTCDay())) return candidate.toISOString().slice(0, 10); }
  return null;
}
