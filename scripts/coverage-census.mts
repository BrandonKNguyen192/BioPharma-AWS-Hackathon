/** Coverage census: what fraction of published criteria can the engine read? */
import { readFileSync } from "node:fs";
import { classify } from "../src/lib/match";
import type { Trial, RuleKind } from "../src/lib/types";

const trials: Trial[] = JSON.parse(
  readFileSync(new URL("../src/data/trials.json", import.meta.url), "utf8"),
).trials;

const byKind = new Map<RuleKind, number>();
const unparsed: string[] = [];
let total = 0;

for (const t of trials) {
  for (const line of [...t.inclusion, ...t.exclusion]) {
    total += 1;
    const k = classify(line);
    byKind.set(k, (byKind.get(k) ?? 0) + 1);
    if (k === "unparsed") unparsed.push(line.replace(/^\\?\*\s*/, "").trim());
  }
}

console.log(`${trials.length} trials, ${total} criteria\n`);
for (const [k, n] of [...byKind].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${((n / total) * 100).toFixed(1).padStart(5)}%  ${k}`);
}

// Rank the concepts hiding inside the unparsed pile.
const PROBES: [string, RegExp][] = [
  ["labs: hematologic", /\b(neutrophil|platelet|hemoglobin|anc|wbc|absolute neutrophil)\b/i],
  ["labs: hepatic/renal", /\b(bilirubin|ast|alt|creatinine|transaminase|egfr\s*[<>≥]|clearance)\b/i],
  ["pregnancy / contraception", /\b(pregnan|contracept|breastfeed|lactat|childbearing)\b/i],
  ["autoimmune / immunosuppression", /\b(autoimmune|immunosuppress|corticosteroid|prednisone)\b/i],
  ["infection: HIV/HBV/HCV", /\b(hiv|hepatitis b|hepatitis c|hbv|hcv|active infection)\b/i],
  ["cardiac", /\b(qtc|ejection fraction|lvef|myocardial|arrhythmi|heart failure)\b/i],
  ["second malignancy", /\b(second|other) (primary )?malignan/i],
  ["life expectancy", /\blife expectancy\b/i],
  ["washout period", /\b(washout|within \d+ (days|weeks) (of|prior|before))\b/i],
  ["consent / compliance", /\b(informed consent|willing|able to comply|protocol requirements)\b/i],
  ["histologic confirmation", /\b(histolog|cytolog|patholog).{0,30}(confirm|proven|documented)/i],
];

console.log(`\n--- concepts inside the ${unparsed.length} unparsed lines ---`);
const hits: [string, number][] = [];
const claimed = new Set<number>();
for (const [label, re] of PROBES) {
  let n = 0;
  unparsed.forEach((l, i) => {
    if (re.test(l)) { n += 1; claimed.add(i); }
  });
  hits.push([label, n]);
}
for (const [label, n] of hits.sort((a, b) => b[1] - a[1])) {
  if (n > 0) console.log(`  ${String(n).padStart(4)}  ${((n / total) * 100).toFixed(1).padStart(5)}% of all  ${label}`);
}
console.log(`\n  ${unparsed.length - claimed.size} unparsed lines match none of the probes`);
