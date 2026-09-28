import assert from "node:assert/strict";
import test from "node:test";
import { leadCsvTemplate, readLeadsCsv } from "../src/lib/leads-csv";

test("Excel-style quoted commas, newlines, and BOM survive lead import", () => {
  const csv = `\uFEFF${leadCsvTemplate()}"Dr. Amine","Atlas, Imaging",amine@example.com,,instagram,new,1250.50,MAD,"Asked for a quote\nNext week",,\r\n`;
  const result = readLeadsCsv(csv);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].company, "Atlas, Imaging");
  assert.equal(result.rows[0].notes, "Asked for a quote\nNext week");
  assert.equal(result.rows[0].currency, "MAD");
});

test("lead import rejects missing columns and invalid rows before saving", () => {
  assert.match(readLeadsCsv("name,email\nA,a@example.com\n").errors[0], /Missing columns/);
  const csv = `${leadCsvTemplate()},,,,unknown,new,-5,EUR,,,\r\n`;
  const errors = readLeadsCsv(csv).errors.join(" ");
  assert.match(errors, /name is required/);
  assert.match(errors, /potential_value/);
  assert.match(errors, /currency/);
  assert.match(errors, /source/);
});
