const CHARGE_TYPES = ['LABOR', 'WORKSHOP', 'CUSTOM_MODIFICATION', 'OTHER'];

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function calculateInvoice(parts, charges, taxPercentage) {
  const partsCents = parts.reduce(
    (total, part) => total + toCents(Number(part.quantityUsed) * Number(part.pricePerUnit)), 0
  );
  const totals = { LABOR: 0, WORKSHOP: 0, CUSTOM_MODIFICATION: 0, OTHER: 0 };
  for (const charge of charges) totals[charge.chargeType] += toCents(charge.amount);
  const subtotalCents = partsCents + Object.values(totals).reduce((sum, amount) => sum + amount, 0);
  const taxCents = Math.round(subtotalCents * Number(taxPercentage) / 100);
  return {
    partsSubtotal: partsCents / 100,
    laborCharge: totals.LABOR / 100,
    workshopFee: totals.WORKSHOP / 100,
    otherCharges: (totals.CUSTOM_MODIFICATION + totals.OTHER) / 100,
    subtotal: subtotalCents / 100,
    taxAmount: taxCents / 100,
    grandTotal: (subtotalCents + taxCents) / 100
  };
}

function validateCharges(charges) {
  if (!Array.isArray(charges) || charges.length > 30) return 'Provide up to 30 extra charges.';
  for (const charge of charges) {
    if (!CHARGE_TYPES.includes(charge?.chargeType) ||
        typeof charge.description !== 'string' || !charge.description.trim() ||
        charge.description.trim().length > 255 ||
        !Number.isFinite(Number(charge.amount)) || Number(charge.amount) <= 0 ||
        Number(charge.amount) > 9999999.99 || !/^\d+(\.\d{1,2})?$/.test(String(charge.amount))) {
      return 'Each charge needs a type, description, and positive amount with at most two decimal places.';
    }
  }
  return null;
}

module.exports = { CHARGE_TYPES, calculateInvoice, validateCharges };
