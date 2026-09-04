export function normalizeOptionalNumberInput(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : Number(trimmed);
  }
  return value;
}
