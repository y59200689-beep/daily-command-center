"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { leadCsvTemplate, readLeadsCsv, type LeadCsvRow } from "@/lib/leads-csv";

function downloadTemplate() {
  const blob = new Blob(["\uFEFF", leadCsvTemplate()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = "daily-command-leads-template.csv"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function toPayload(row: LeadCsvRow) {
  const optionalDate = (value: string) => value ? new Date(value).toISOString() : null;
  return { name: row.name, company: row.company || null, email: row.email || null, phone: row.phone || null,
    source: row.source || "other", status: row.status || "new", potential_value: row.potential_value || null,
    currency: row.currency.toUpperCase() || "USD", notes: row.notes || null,
    last_contact_at: optionalDate(row.last_contact_at), next_follow_up_at: optionalDate(row.next_follow_up_at) };
}

export function LeadsImport({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false), [rows, setRows] = useState<LeadCsvRow[]>([]), [filename, setFilename] = useState("");
  const [errors, setErrors] = useState<string[]>([]), [busy, setBusy] = useState(false), [done, setDone] = useState(0), [imported, setImported] = useState(0);
  async function readFile(file?: File) {
    setRows([]); setErrors([]); setDone(0); setImported(0); setFilename(file?.name ?? "");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) { setErrors(["Choose a CSV file. Excel can export a sheet as CSV UTF-8."]); return; }
    if (file.size > 2_000_000) { setErrors(["The CSV must be smaller than 2 MB."]); return; }
    try { const result = readLeadsCsv(await file.text()); setRows(result.rows); setErrors(result.errors); }
    catch (error) { setErrors([error instanceof Error ? error.message : "The CSV could not be read."]); }
  }
  async function importRows() {
    if (!rows.length || errors.length || busy ) return;
    setBusy(true); setDone(0); setImported(0);
    const failures: string[] = []; let next = 0; let saved = 0;
    await Promise.all(Array.from({ length: Math.min(3, rows.length) }, async () => {
      while (next < rows.length) {
        const index = next++;
        try {
          const response = await fetch("/api/business/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toPayload(rows[index])) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "Could not save this lead.");
          saved++; setImported(saved);
        } catch (error) { failures.push(`Row ${index + 2} (${rows[index].name}): ${error instanceof Error ? error.message : "Save failed."}`); }
        setDone(current => current + 1);
      }
    }));
    setBusy(false); setErrors(failures);
    if (saved) onImported();
    if (!failures.length) setRows([]);
  }
  return <>
    <button className="leads-dashboard__import-trigger" onClick={() => setOpen(true)}><Upload size={17}/>Import CSV</button>
    <Modal open={open} onClose={() => { if (!busy) setOpen(false); }} title="Import leads" description="Upload a CSV exported from Excel. Review its columns before adding leads to your workspace.">
      <div className="leads-import">
        <div className="leads-import__steps"><span>1. Download the template</span><span>2. Fill it in Excel</span><span>3. Export as CSV UTF-8 and upload</span></div>
        <button className="leads-import__template" onClick={downloadTemplate}><FileSpreadsheet size={22}/><span><strong>Leads CSV template</strong><small>Required: name. Optional: company, contact, source, status, value, currency, notes and dates.</small></span><Download size={18}/></button>
        <label className="leads-import__drop"><Upload size={23}/><strong>{filename || "Choose a CSV file"}</strong><span>CSV UTF-8 · up to 500 rows · 2 MB maximum</span><input type="file" accept=".csv,text/csv" disabled={busy} onChange={event => void readFile(event.target.files?.[0])}/></label>
        {rows.length > 0 && !errors.length && <div className="leads-import__preview"><strong>{rows.length} leads ready to import</strong><p>First rows: {rows.slice(0, 3).map(row => row.company ? `${row.name} · ${row.company}` : row.name).join("; ")}{rows.length > 3 ? "…" : ""}</p></div>}
        {done > 0 && <p role="status" className="leads-import__progress">{busy ? `Importing ${done} of ${rows.length}…` : `${imported} imported; ${errors.length} failed.`}</p>}
        {errors.length > 0 && <div className="leads-import__errors" role="alert"><strong>{errors.length} issue{errors.length === 1 ? "" : "s"} found</strong><ul>{errors.slice(0, 12).map((error, index) => <li key={index}>{error}</li>)}</ul>{errors.length > 12 && <p>And {errors.length - 12} more issues.</p>}</div>}
        <div className="modal__actions"><Button emphasis="ghost" disabled={busy} onClick={() => setOpen(false)}>Close</Button><Button intent="brand" disabled={busy || !rows.length || errors.length > 0} onClick={() => void importRows()}>{busy ? "Importing…" : `Import ${rows.length || ""} leads`}</Button></div>
      </div>
    </Modal>
  </>;
}
