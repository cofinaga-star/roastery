import { formatWeight } from "./units.js";

function csvEscape(value) {
  const s = (value ?? "").toString();
  const needsQuotes = /[",\n]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function toCsv(rows) {
  // rows: array of array-of-cells
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

export function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportRoastsCsv({ uid, displayUnit, fetchAllRoasts }) {
  const roasts = await fetchAllRoasts();
  const header = [
    "RoastDate",
    "BeanName",
    "Category",
    "Region",
    "VillageFarm",
    `InputWeight_${displayUnit}`,
    "InputWeight_g",
    `OutputWeight_${displayUnit}`,
    "OutputWeight_g",
    "YieldPercent",
    "Notes",
  ];

  const rows = [header];
  for (const r of roasts) {
    rows.push([
      r.roastDateISO ?? r.roastDate ?? "",
      r.beanName ?? "",
      r.category ?? "",
      r.origin?.region ?? "",
      r.origin?.village ?? "",
      formatWeight(r.inputGrams, displayUnit, 3),
      r.inputGrams ?? "",
      formatWeight(r.outputGrams, displayUnit, 3),
      r.outputGrams ?? "",
      r.yieldPercent ?? "",
      r.notes ?? "",
    ]);
  }

  const csv = toCsv(rows);
  downloadText(`roastery_roasts_${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
}

export async function exportInventoryCsv({ uid, displayUnit, fetchAllInventory }) {
  const inventory = await fetchAllInventory();
  const header = [
    "BeanName",
    "Category",
    "Region",
    "VillageFarm",
    `Stock_${displayUnit}`,
    "Stock_g",
    "UpdatedAt",
  ];

  const rows = [header];
  for (const inv of inventory) {
    const updatedAt = inv.updatedAt?.toDate ? inv.updatedAt.toDate().toISOString() : inv.updatedAt ?? "";
    rows.push([
      inv.beanName ?? "",
      inv.category ?? "",
      inv.origin?.region ?? "",
      inv.origin?.village ?? "",
      formatWeight(inv.stockGrams ?? 0, displayUnit, 3),
      inv.stockGrams ?? 0,
      updatedAt,
    ]);
  }

  const csv = toCsv(rows);
  downloadText(`roastery_inventory_${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
}

