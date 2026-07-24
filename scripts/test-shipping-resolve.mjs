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
  resolveLiveShippingCost(parsed, priceUsed) {
    if (!parsed) return null;
    const derived = this.deriveCustomerShipping(parsed.totalPrice, priceUsed);
    if (derived != null) return derived;
    const apiShip = parsed.shippingCharges;
    return apiShip != null && apiShip > 0 ? apiShip : null;
  },
  consensusCustomerShipping(quotes) {
    if (!quotes?.length) return null;
    const withTotal = quotes.filter((q) => q.hasTotal && q.customer != null);
    if (withTotal.length) {
      const vals = withTotal.map((q) => q.customer);
      const max = Math.max(...vals);
      const min = Math.min(...vals);
      if (max - min <= 2) return Math.round((max + min) / 2);
      return max;
    }
    const fallback = quotes.map((q) => q.customer).filter((v) => v != null);
    return fallback.length ? Math.max(...fallback) : null;
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

// Mismatch — prefer higher (panel-aligned)
assertEq(
  api.consensusCustomerShipping([
    { price: 100, customer: 64, hasTotal: false },
    { price: 200, customer: 79, hasTotal: true },
  ]),
  79,
  "consensus prefers total_price-derived quote",
);

console.log("PASS: all shipping resolve tests");
