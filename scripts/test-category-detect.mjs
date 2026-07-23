import { detectCategoryGroup, categoryGroupLabel } from "../app.suppliersden.com/js/lib/smart-plan.js";

const cases = [
  {
    name: "Kurtis from parent",
    in: { categoryName: "Kurtis", parentName: "Kurtis, Sets & Fabrics" },
    want: "apparel",
  },
  {
    name: "Sarees",
    in: { categoryName: "Sarees", parentName: "Sarees, Blouses & Petticoats" },
    want: "apparel",
  },
  {
    name: "Bellies footwear",
    in: { categoryName: "Bellies", parentName: "Bellies & Juttis" },
    want: "footwear",
  },
  {
    name: "Jewellery set",
    in: { categoryName: "Jewellery Set", parentName: "Jewellery" },
    want: "jewellery",
  },
  {
    name: "Bedsheets home",
    in: { categoryName: "Bedsheets", parentName: "Unisex" },
    want: "home",
  },
  {
    name: "Tall image fallback",
    in: { categoryName: "", parentName: "", imageAnalysis: { tall: true } },
    want: "apparel",
  },
  {
    name: "Wide image fallback",
    in: { categoryName: "", parentName: "", imageAnalysis: { collage: true } },
    want: "lingerie",
  },
  {
    name: "Unknown category low confidence",
    in: { categoryName: "Mystery Widget", parentName: "Other" },
    want: "general",
  },
];

let failed = 0;
for (const c of cases) {
  const out = detectCategoryGroup(c.in);
  const ok = out.groupId === c.want;
  console.log(`${ok ? "PASS" : "FAIL"}: ${c.name} → ${out.groupName} (${out.confidence})`);
  if (!ok) {
    failed++;
    console.log(`  expected ${c.want}, got ${out.groupId}`);
  }
}

console.log("Label check:", categoryGroupLabel("apparel"));
if (failed) process.exit(1);
console.log("PASS: category detection");
