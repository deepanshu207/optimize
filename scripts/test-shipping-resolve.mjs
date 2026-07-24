/**
 * Unit tests for customer shipping resolution (total_price − price).
 * Run: node scripts/test-shipping-resolve.mjs
 */

const api = {
  deriveCustomerShipping(totalPrice, sellingPrice) {
    if (totalPrice == null || sellingPrice == null) return null;
    const n = Math.round(Number(totalPrice) - Number(sellingPrice));
    if (Number.isFinite(n) && n > 0 && n < 500) return n;
    return null;
  },
  resolveLiveShippingCost(parsed, priceUsed, catalogPrice) {
    if (!parsed) return null;
    const sellPrice = catalogPrice || priceUsed;
    const derived = this.deriveCustomerShipping(parsed.totalPrice, sellPrice);
    if (derived != null) return derived;
    const apiShip = parsed.shippingCharges;
    return apiShip != null && apiShip > 0 ? apiShip : null;
  },
  consensusCustomerShipping(quotes, catalogPrice) {
    if (!quotes?.length) return null;
    if (catalogPrice) {
      const atCatalog = quotes.find((q) => q.price === catalogPrice && q.customer != null);
      if (atCatalog) return atCatalog.customer;
    }
    const withTotal = quotes.filter((q) => q.hasTotal && q.customer != null);
    if (withTotal.length) return Math.min(...withTotal.map((q) => q.customer));
    const fallback = quotes.map((q) => q.customer).filter((v) => v != null);
    return fallback.length ? Math.min(...fallback) : null;
  },
};

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label} — got ${actual}, expected ${expected}`);
    process.exit(1);
  }
  console.log(`PASS: ${label}`);
}

// Meesho Price ₹100 → Customer ₹179 → shipping ₹79
assertEq(
  api.resolveLiveShippingCost({ totalPrice: 179, shippingCharges: 64 }, 100),
  79,
  "₹100 selling: derive 79 not api 64",
);

// Meesho Price ₹200 → Customer ₹279 → shipping ₹79 (same image)
assertEq(
  api.resolveLiveShippingCost({ totalPrice: 279, shippingCharges: 64 }, 200),
  79,
  "₹200 selling: derive 79 not api 64",
);

// No total_price — fallback to shipping_charges
assertEq(
  api.resolveLiveShippingCost({ shippingCharges: 72 }, 100),
  72,
  "fallback to shipping_charges when no total",
);

// Cross-price consensus: same customer shipping at both prices
assertEq(
  api.consensusCustomerShipping([
    { price: 100, customer: 79, hasTotal: true },
    { price: 200, customer: 79, hasTotal: true },
  ]),
  79,
  "consensus when both probes agree",
);

// API probed at ₹100 but catalog Meesho Price is ₹200 — use catalog for derive
assertEq(
  api.resolveLiveShippingCost({ totalPrice: 247, shippingCharges: 57 }, 100, 200),
  47,
  "catalog ₹200: total 247 → customer shipping 47 (not api 57 at ₹100)",
);

// Consensus prefers catalog price quote
assertEq(
  api.consensusCustomerShipping(
    [
      { price: 100, customer: 57, hasTotal: true },
      { price: 200, customer: 47, hasTotal: true },
    ],
    200
  ),
  47,
  "consensus uses catalog price probe",
);

console.log("PASS: all shipping resolve tests");
