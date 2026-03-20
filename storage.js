import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { getDb } from "./firebase.js";
import { formatDateISO, inventoryIdFromParts, parseNumber, convertToGrams } from "./units.js";

const FIRESTORE_INVENTORY = "inventory";
const FIRESTORE_ROASTS = "roasts";

function getUserPath(uid) {
  return ["users", uid];
}

function usersCollection(uid, subcollectionName) {
  const [u1, u2] = getUserPath(uid);
  return collection(getDb(), u1, u2, subcollectionName);
}

function inventoryDocRef(uid, inventoryId) {
  const [u1, u2] = getUserPath(uid);
  return doc(getDb(), u1, u2, FIRESTORE_INVENTORY, inventoryId);
}

function roastDocRef(uid, roastId) {
  const [u1, u2] = getUserPath(uid);
  return doc(getDb(), u1, u2, FIRESTORE_ROASTS, roastId);
}

export function getInventoryId({ beanName, origin }) {
  return inventoryIdFromParts(beanName, origin.region, origin.village);
}

export function normalizeRoastForm(roastForm) {
  const inputUnit = roastForm.weightUnit || "g";
  const inputGrams = convertToGrams(roastForm.inputWeight, inputUnit);
  const outputGrams = convertToGrams(roastForm.outputWeight, inputUnit);

  return {
    beanName: roastForm.beanName?.trim() || "",
    category: roastForm.category,
    origin: {
      region: roastForm.originRegion?.trim() || "",
      village: roastForm.originVillage?.trim() || "",
      notes: roastForm.originNotes?.trim() || "",
    },
    roastDateISO: roastForm.roastDate, // YYYY-MM-DD
    inputGrams,
    outputGrams,
    yieldPercent: inputGrams > 0 ? (outputGrams / inputGrams) * 100 : 0,
    notes: roastForm.notes?.trim() || "",
  };
}

export function roastMatchesSearch(roast, search) {
  const q = (search ?? "").toString().trim().toLowerCase();
  if (!q) return true;
  const hay = [
    roast.beanName,
    roast.origin?.region,
    roast.origin?.village,
    roast.notes,
    roast.category,
    roast.roastDateISO,
  ]
    .map((v) => (v ?? "").toString().toLowerCase())
    .join(" ");
  return hay.includes(q);
}

export function roastCompareByDate(a, b, direction) {
  const dir = direction === "oldest" ? 1 : -1;
  // roastDateISO is YYYY-MM-DD so lexicographic works.
  return a.roastDateISO.localeCompare(b.roastDateISO) * dir;
}

export function inventoryMatchesSearch(item, search) {
  const q = (search ?? "").toString().trim().toLowerCase();
  if (!q) return true;
  const hay = [
    item.beanName,
    item.category,
    item.origin?.region,
    item.origin?.village,
    item.notes,
  ]
    .map((v) => (v ?? "").toString().toLowerCase())
    .join(" ");
  return hay.includes(q);
}

export function inventoryCompareByBean(a, b) {
  return (a.beanName ?? "").toString().localeCompare((b.beanName ?? "").toString());
}

export function subscribeInventory(uid, onData) {
  const colRef = usersCollection(uid, FIRESTORE_INVENTORY);
  return onSnapshot(colRef, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    onData(items);
  });
}

export function subscribeRoasts(uid, onData) {
  const colRef = usersCollection(uid, FIRESTORE_ROASTS);
  return onSnapshot(colRef, (snap) => {
    const roasts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    onData(roasts);
  });
}

export async function exportAllRoasts(uid) {
  const colRef = usersCollection(uid, FIRESTORE_ROASTS);
  const snap = await getDocs(colRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function exportAllInventory(uid) {
  const colRef = usersCollection(uid, FIRESTORE_INVENTORY);
  const snap = await getDocs(colRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function toInventoryDocPayload(inv) {
  return {
    beanName: inv.beanName,
    category: inv.category,
    origin: {
      region: inv.origin.region,
      village: inv.origin.village,
    },
    stockGrams: inv.stockGrams,
    updatedAt: serverTimestamp(),
  };
}

function assertFiniteNonNegative(n, label) {
  const v = parseNumber(n);
  if (!Number.isFinite(v)) throw new Error(`${label} must be a number.`);
  if (v < 0) throw new Error(`${label} cannot be negative.`);
  return v;
}

export async function addInventory(uid, invForm) {
  // invForm: {beanName, category, originRegion, originVillage, deltaWeight, weightUnit}
  const deltaGrams = convertToGrams(invForm.deltaWeight, invForm.weightUnit || "g");
  const delta = assertFiniteNonNegative(deltaGrams, "Stock amount");

  const inventoryId = inventoryDocFromForm(uid, invForm);
  const invRef = inventoryDocRef(uid, inventoryId);

  await runTransaction(getDb(), async (tx) => {
    const invSnap = await tx.get(invRef);
    const current = invSnap.exists() ? invSnap.data().stockGrams : 0;

    const next = current + delta;
    const payload = toInventoryDocPayload({
      beanName: invForm.beanName.trim(),
      category: invForm.category,
      origin: { region: invForm.originRegion.trim(), village: invForm.originVillage.trim() },
      stockGrams: next,
    });

    if (!invSnap.exists()) {
      tx.set(invRef, payload, { merge: false });
    } else {
      tx.update(invRef, { ...payload });
    }
  });
}

function inventoryDocFromForm(uid, invForm) {
  return inventoryIdFromParts(
    invForm.beanName,
    invForm.originRegion,
    invForm.originVillage
  );
}

export async function adjustInventory(uid, invForm) {
  // invForm: {beanName, category, originRegion, originVillage, deltaWeight, weightUnit}
  const deltaGrams = convertToGrams(invForm.deltaWeight, invForm.weightUnit || "g");
  const delta = parseNumber(deltaGrams);
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("Adjustment must be a non-zero number.");
  }

  const inventoryId = inventoryDocFromForm(uid, invForm);
  const invRef = inventoryDocRef(uid, inventoryId);

  await runTransaction(getDb(), async (tx) => {
    const invSnap = await tx.get(invRef);
    if (!invSnap.exists()) {
      if (delta < 0) {
        throw new Error("Not enough stock to deduct (inventory item missing).");
      }
      const payload = toInventoryDocPayload({
        beanName: invForm.beanName.trim(),
        category: invForm.category,
        origin: { region: invForm.originRegion.trim(), village: invForm.originVillage.trim() },
        stockGrams: Math.max(0, delta),
      });
      tx.set(invRef, payload, { merge: false });
      return;
    }

    const current = parseNumber(invSnap.data().stockGrams);
    const next = current + delta;
    if (next < 0) {
      throw new Error("Not enough stock. Operation would make inventory negative.");
    }

    // Keep beanName/category consistent with latest form.
    tx.update(invRef, {
      ...toInventoryDocPayload({
        beanName: invForm.beanName.trim(),
        category: invForm.category,
        origin: { region: invForm.originRegion.trim(), village: invForm.originVillage.trim() },
        stockGrams: next,
      }),
    });
  });
}

function toRoastPayload(uid, roastForm) {
  const normalized = normalizeRoastForm(roastForm);
  const inputGrams = normalized.inputGrams;
  const outputGrams = normalized.outputGrams;

  if (!normalized.beanName) throw new Error("Bean name is required.");
  if (!normalized.origin.region || !normalized.origin.village) throw new Error("Origin region and village/farm are required.");

  if (!Number.isFinite(inputGrams) || inputGrams <= 0) throw new Error("Input weight must be > 0.");
  if (!Number.isFinite(outputGrams) || outputGrams < 0) throw new Error("Output weight must be >= 0.");

  return {
    beanName: normalized.beanName,
    category: normalized.category,
    origin: {
      region: normalized.origin.region,
      village: normalized.origin.village,
      notes: normalized.origin.notes || "",
    },
    roastDateISO: formatDateISO(normalized.roastDateISO),
    inputGrams,
    outputGrams,
    yieldPercent: Math.round(normalized.yieldPercent * 10) / 10,
    notes: normalized.notes,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    _user: uid,
  };
}

export async function createRoastWithStock(uid, roastForm) {
  // Transaction: check deduct input grams from matching inventory, then write roast.
  const roastPayload = toRoastPayload(uid, roastForm);
  const inventoryId = inventoryIdFromParts(roastPayload.beanName, roastPayload.origin.region, roastPayload.origin.village);

  const invRef = inventoryDocRef(uid, inventoryId);

  const roastsCol = usersCollection(uid, FIRESTORE_ROASTS);
  const newDocRef = doc(roastsCol); // auto-id

  await runTransaction(getDb(), async (tx) => {
    const invSnap = await tx.get(invRef);
    if (!invSnap.exists()) {
      throw new Error("Matching inventory item not found. Add inventory before roasting.");
    }
    const currentStock = parseNumber(invSnap.data().stockGrams);
    if (!Number.isFinite(currentStock)) throw new Error("Inventory stock is corrupted.");
    if (currentStock < roastPayload.inputGrams) {
      throw new Error("Not enough stock for this roast. Operation would make inventory negative.");
    }

    tx.update(invRef, {
      stockGrams: currentStock - roastPayload.inputGrams,
      updatedAt: serverTimestamp(),
    });

    tx.set(newDocRef, { ...roastPayload });
  });

  return { id: newDocRef.id, ...roastPayload };
}

export async function updateRoastWithStock(uid, roastId, roastForm, previousRoast) {
  // previousRoast includes inputGrams + origin to know refund/deduct.
  const nextPayload = toRoastPayload(uid, roastForm);
  // Preserve original `createdAt` on update; keep `updatedAt` fresh.
  delete nextPayload.createdAt;

  const prevInventoryId = inventoryIdFromParts(
    previousRoast.beanName,
    previousRoast.origin.region,
    previousRoast.origin.village
  );
  const nextInventoryId = inventoryIdFromParts(
    nextPayload.beanName,
    nextPayload.origin.region,
    nextPayload.origin.village
  );

  const prevInvRef = inventoryDocRef(uid, prevInventoryId);
  const nextInvRef = inventoryDocRef(uid, nextInventoryId);
  const roastRef = roastDocRef(uid, roastId);

  await runTransaction(getDb(), async (tx) => {
    const prevInvSnap = await tx.get(prevInvRef);
    if (!prevInvSnap.exists()) {
      throw new Error("Previous inventory item missing; cannot edit roast safely.");
    }

    const prevStock = parseNumber(prevInvSnap.data().stockGrams);
    if (!Number.isFinite(prevStock)) throw new Error("Inventory stock is corrupted.");

    const nextInput = nextPayload.inputGrams;
    const prevInput = parseNumber(previousRoast.inputGrams);
    if (!Number.isFinite(prevInput)) throw new Error("Previous roast input weight is invalid.");

    if (prevInventoryId === nextInventoryId) {
      // Net effect: refund prevInput and deduct nextInput.
      const nextStock = prevStock + prevInput - nextInput;
      if (nextStock < 0) {
        throw new Error("Not enough stock to update this roast (inventory would go negative).");
      }
      tx.update(prevInvRef, { stockGrams: nextStock, updatedAt: serverTimestamp() });
    } else {
      // Refund old, deduct new.
      const prevRefunded = prevStock + prevInput;
      tx.update(prevInvRef, { stockGrams: prevRefunded, updatedAt: serverTimestamp() });

      const nextInvSnap = await tx.get(nextInvRef);
      if (!nextInvSnap.exists()) {
        throw new Error("Matching inventory item for the updated origin not found.");
      }
      const nextStockCurrent = parseNumber(nextInvSnap.data().stockGrams);
      if (!Number.isFinite(nextStockCurrent)) throw new Error("Inventory stock is corrupted.");
      if (nextStockCurrent < nextInput) {
        throw new Error("Not enough stock for updated roast. Operation would make inventory negative.");
      }
      tx.update(nextInvRef, { stockGrams: nextStockCurrent - nextInput, updatedAt: serverTimestamp() });
    }

    tx.update(roastRef, {
      ...nextPayload,
      updatedAt: serverTimestamp(),
    });
  });

  return { id: roastId, ...nextPayload };
}

export async function deleteRoastWithStock(uid, roastId, previousRoast) {
  const inventoryId = inventoryIdFromParts(
    previousRoast.beanName,
    previousRoast.origin.region,
    previousRoast.origin.village
  );
  const invRef = inventoryDocRef(uid, inventoryId);
  const roastRef = roastDocRef(uid, roastId);

  await runTransaction(getDb(), async (tx) => {
    const invSnap = await tx.get(invRef);
    if (!invSnap.exists()) {
      throw new Error("Matching inventory item missing; cannot refund stock.");
    }
    const current = parseNumber(invSnap.data().stockGrams);
    if (!Number.isFinite(current)) throw new Error("Inventory stock is corrupted.");
    const input = parseNumber(previousRoast.inputGrams);
    if (!Number.isFinite(input)) throw new Error("Previous roast input weight invalid.");

    tx.update(invRef, { stockGrams: current + input, updatedAt: serverTimestamp() });
    tx.delete(roastRef);
  });
}

