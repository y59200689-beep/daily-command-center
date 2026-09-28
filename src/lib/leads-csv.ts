export const leadCsvColumns = ["name", "company", "email", "phone", "source", "status", "potential_value", "currency", "notes", "last_contact_at", "next_follow_up_at"] as const;
export type LeadCsvRow = Record<(typeof leadCsvColumns)[number], string>;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ""; let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field); if (row.some(value => value.trim())) rows.push(row);
      row = []; field = "";
    } else field += char;
  }
  if (quoted) throw new Error("A quoted cell is not closed. Check the CSV file and try again.");
  row.push(field); if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

export function readLeadsCsv(text: string): { rows: LeadCsvRow[]; errors: string[] } {
  const [header, ...body] = parseCsv(text);
  if (!header) return { rows: [], errors: ["The CSV file is empty."] };
  const columns = header.map(value => value.trim().toLowerCase());
  const missing = leadCsvColumns.filter(value => !columns.includes(value));
  if (missing.length) return { rows: [], errors: [`Missing columns: ${missing.join(", ")}. Download the template for the expected format.`] };
  const errors: string[] = []; const rows: LeadCsvRow[] = [];
  body.forEach((values, index) => {
    const row = Object.fromEntries(leadCsvColumns.map(column => [column, (values[columns.indexOf(column)] ?? "").trim()])) as LeadCsvRow;
    const line = index + 2;
    if (values.length !== columns.length) errors.push(`Row ${line}: expected ${columns.length} cells, found ${values.length}.`);
    if (!row.name) errors.push(`Row ${line}: name is required.`);
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push(`Row ${line}: email is invalid.`);
    if (row.potential_value && (!/^\d+(?:\.\d{1,2})?$/.test(row.potential_value) || Number(row.potential_value) > 999999999999.99)) errors.push(`Row ${line}: potential_value must be a non-negative amount.`);
    if (row.currency && !["USD", "MAD"].includes(row.currency.toUpperCase())) errors.push(`Row ${line}: currency must be USD or MAD.`);
    if (row.source && !["referral", "instagram", "website", "email", "whatsapp_manual", "networking", "existing_client", "other"].includes(row.source)) errors.push(`Row ${line}: source is not supported.`);
    if (row.status && !["new", "contacted", "qualified", "unqualified", "converted", "lost"].includes(row.status)) errors.push(`Row ${line}: status is not supported.`);
    for (const key of ["last_contact_at", "next_follow_up_at"] as const) if (row[key] && Number.isNaN(Date.parse(row[key]))) errors.push(`Row ${line}: ${key} must be an ISO date or date and time.`);
    rows.push(row);
  });
  if (!rows.length) errors.push("Add at least one lead row below the header.");
  if (rows.length > 500) errors.push("Import up to 500 leads at a time.");
  return { rows, errors };
}

export function leadCsvTemplate() { return `${leadCsvColumns.join(",")}\r\n`; }
