// CSV export (Reports). Pure functions, tested by verify:engine scenario s.
// Excel needs three things to open a file cleanly: a UTF-8 BOM (so "ñ" and "–" show correctly),
// quotes around any cell with a comma, quote or line break, and quotes doubled inside a cell.

/** UTF-8 byte order mark: tells Excel the file is UTF-8. */
export const BOM = "﻿";

/** One cell, escaped. Also stops spreadsheet formulas: a text starting with = + @ or -letter gets a leading '. */
export function csvCell(value: string) {
  let text = value;
  if (/^[=+@\t\r]/.test(text) || /^-[^0-9.]/.test(text)) text = `'${text}`; // "-1.250" stays a number
  return /[",\r\n]/.test(text) || text !== text.trim() ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Whole file: BOM + rows joined with commas and Windows line endings (what Excel writes too). */
export function toCsv(rows: string[][]) {
  return BOM + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
