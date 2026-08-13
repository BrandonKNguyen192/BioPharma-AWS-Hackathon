/** Dry-run candidate demo vignettes against the real engine. */
import { readFileSync } from "node:fs";
import { matchAll } from "../src/lib/match";
import { extractLocally } from "../src/lib/extract-local";
import type { Trial } from "../src/lib/types";

const trials: Trial[] = JSON.parse(
  readFileSync(new URL("../src/data/trials.json", import.meta.url), "utf8"),
).trials;

const CANDIDATES: [string, string][] = [
  ["myeloma-66", "I'm 66 and I've had multiple myeloma since 2021. I started on lenalidomide, bortezomib and dexamethasone, then had a stem cell transplant, then daratumumab when it came back, then carfilzomib. My light chains are climbing again and my last marrow biopsy showed more plasma cells. My ECOG is 1 and my kidney function has held up. People keep mentioning CAR-T but nobody will tell me straight whether I'd qualify for any of these studies."],
  ["myeloma-caregiver-73", "I'm writing for my mother. She is 73 years old and was diagnosed with multiple myeloma four years ago. She had VRd, then a transplant, then daratumumab with pomalidomide. She's relapsed a third time. Her ECOG is 2 on a good day. She has some neuropathy in her feet from the bortezomib and it never fully went away. We're in Sacramento and can drive to the Bay Area but not fly. Nobody has explained what would rule her out."],
  ["myeloma-newdx-61", "I am 61 years old and I was diagnosed with multiple myeloma two months ago. I have not started any treatment yet — my doctor wants to begin next week. My ECOG is 0, I still work full time and walk my dog every morning. My kidney function is normal. They have told me I am a candidate for a stem cell transplant later. I would rather go into a trial from the beginning than wait until something stops working."],
  ["rcc-59", "I'm 59 with clear cell renal cell carcinoma, metastatic to my lungs and bones. I had my left kidney removed in 2023, then went on ipilimumab and nivolumab, then cabozantinib when it progressed. My last scan in June showed two new lung nodules. My ECOG is 1, no brain involvement. I want to know which trials will take someone who's already had immunotherapy."],
  ["crc-52", "52, male, colon cancer that spread to my liver and lungs. Resected the primary in 2023. Since then FOLFOX with bevacizumab, then FOLFIRI, then regorafenib, which I stopped in April. NGS says KRAS G12C, microsatellite stable. My ECOG is 1. I'm still driving myself to appointments. Where do I actually stand?"],
];

for (const [id, text] of CANDIDATES) {
  const p = extractLocally(text);
  const ranked = matchAll(trials, p);
  const good = ranked.filter((r) => r.verdict === "eligible" || r.verdict === "likely");
  console.log(`\n=== ${id} ===`);
  console.log(`  cancer=${p.cancerType} ecog=${p.ecog} age=${p.ageYears} lines=${p.priorLinesCount} biomarkers=[${p.biomarkers}]`);
  console.log(`  pool=${ranked.length}  eligible/likely=${good.length}`);
  for (const r of ranked.slice(0, 3)) {
    console.log(`   ${r.verdict.padEnd(12)} fit=${String(r.fit).padEnd(5)} ${r.coverage.checked}/${r.coverage.total}  ${r.trial.title.slice(0, 58)}`);
  }
}
