export function normalizeKeyPart(v) {
  return (v ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function inventoryIdFromParts(beanName, region, village) {
  // Matching key: bean name + origin region + village/farm.
  return `${normalizeKeyPart(beanName)}|${normalizeKeyPart(region)}|${normalizeKeyPart(village)}`;
}

export function parseNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

export function convertToGrams(value, unit) {
  const n = parseNumber(value);
  if (!Number.isFinite(n)) return NaN;
  const u = (unit ?? "g").toString().toLowerCase();
  if (u === "kg") return n * 1000;
  return n; // grams
}

export function convertFromGrams(grams, unit) {
  const g = parseNumber(grams);
  if (!Number.isFinite(g)) return NaN;
  const u = (unit ?? "g").toString().toLowerCase();
  if (u === "kg") return g / 1000;
  return g;
}

export function formatWeight(grams, unit, decimals = 2) {
  const n = convertFromGrams(grams, unit);
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
  const suffix = unit === "kg" ? "kg" : "g";
  return `${rounded} ${suffix}`;
}

export function formatDateISO(dateISO) {
  if (!dateISO) return "—";
  // Store as YYYY-MM-DD. Keep it as-is for display.
  return dateISO;
}

