import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const radar = JSON.parse(await readFile(new URL("../src/data/pipeline-radar-reviewed.json", import.meta.url), "utf8"));
const trials = JSON.parse(await readFile(new URL("../src/data/trials.json", import.meta.url), "utf8"));

assert.equal(radar.schemaVersion, "1.0.0");
assert.ok(radar.signals.length >= 4, "seed at least four reviewed signals");
assert.equal(new Set(radar.signals.map((signal) => signal.id)).size, radar.signals.length, "signal ids must be unique");

const trialIds = new Set(trials.trials.map((trial) => trial.nctId));
for (const signal of radar.signals) {
  assert.match(signal.source.url, /^https:\/\//);
  assert.ok(signal.source.quote.length >= 24, `${signal.id}: exact quote is required`);
  assert.ok(!/^FDA (confirmed|verified)$/i.test(signal.headline), `${signal.id}: do not overstate sponsor claims`);
  if (signal.registryMatch.status === "exact") {
    assert.ok(trialIds.has(signal.registryMatch.nctId), `${signal.id}: exact registry link must exist in committed portfolio`);
  }
  if (signal.eventType.startsWith("regulatory_")) {
    assert.ok(["company_asserted", "public_record", "corroborated"].includes(signal.evidence));
    assert.match(signal.reviewNote, /registry|FDA|clearance|claim/i);
  }
}

console.log(`all radar checks pass (${radar.signals.length} reviewed signals)`);
