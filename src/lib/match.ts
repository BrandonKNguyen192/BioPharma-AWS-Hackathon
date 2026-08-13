/**
 * ClearTrial deterministic matching engine.
 *
 * DESIGN INVARIANT — read before changing anything here:
 * The language model NEVER decides eligibility. It does exactly two things:
 *   1. turn a patient's free text into a PatientProfile (extract.ts), and
 *   2. explain a decision this file already made (explain.ts).
 * Every eligible / excluded verdict below is produced by plain TypeScript
 * against published protocol text, so any decision can be replayed, unit
 * tested, and shown to a regulator. That is the entire compliance argument.
 *
 * A criterion the engine cannot confidently parse is reported as `unknown`
 * and surfaced as an open question. It is never silently treated as a pass.
 */

import type {
  CriterionOutcome,
  EvaluatedCriterion,
  MatchResult,
  MatchVerdict,
  PatientProfile,
  RawCriterion,
  RuleKind,
  Trial,
  UnmatchedSignal,
} from "./types";

/* ------------------------------------------------------------------ *
 * Criterion classification
 * ------------------------------------------------------------------ */

/** Detects the ECOG performance-status ceiling stated in a criterion. */
function parseEcogCeiling(text: string): number | null {
  const t = text.toLowerCase();
  if (!/ecog|eastern cooperative|performance status/.test(t)) return null;

  // "0 or 1", "0-1", "0 to 2", "of 0, 1, or 2", "<= 1"
  const range = /([0-4])\s*(?:-|–|to|or|,)\s*(?:or\s*)?([0-4])/.exec(t);
  if (range) return Math.max(Number(range[1]), Number(range[2]));

  const lte = /(?:≤|<=|less than or equal to|no greater than|at most)\s*([0-4])/.exec(t);
  if (lte) return Number(lte[1]);

  const single = /(?:status|ecog|ps)\D{0,20}?([0-4])\b/.exec(t);
  if (single) return Number(single[1]);

  return null;
}

/** Detects a PD-L1 percentage threshold, e.g. "PD-L1 expression (>=50%)". */
function parsePdl1Threshold(text: string): number | null {
  const t = text.toLowerCase();
  if (!/pd-?l1/.test(t)) return null;
  const m = /(?:≥|>=|at least|greater than or equal to|of)\s*(\d{1,3})\s*%/.exec(t);
  if (m) return Number(m[1]);
  const tps = /(\d{1,3})\s*%/.exec(t);
  return tps ? Number(tps[1]) : null;
}

function parseAgeFloor(text: string): number | null {
  const t = text.toLowerCase();
  if (!/\bage|\byears? of age|\byears old/.test(t)) return null;
  const m = /(?:≥|>=|at least)\s*(\d{1,2})\s*years/.exec(t);
  return m ? Number(m[1]) : null;
}

/** Detects a required prior-lines-of-therapy count, e.g. "at least 1 prior line". */
function parsePriorLines(text: string): { min: number | null; max: number | null } | null {
  const t = text.toLowerCase();
  if (!/\b(prior|previous)\s+(lines?|regimens?|systemic therap)/.test(t)) return null;

  const noMore = /(?:no more than|at most|≤|<=|up to)\s*(\d)\s*(?:prior\s*)?(?:lines?|regimens?)/.exec(t);
  if (noMore) return { min: null, max: Number(noMore[1]) };

  const atLeast = /(?:at least|≥|>=|minimum of)\s*(\d)\s*(?:prior\s*)?(?:lines?|regimens?)/.exec(t);
  if (atLeast) return { min: Number(atLeast[1]), max: null };

  if (/treatment[- ]na(?:i|ï)ve|no prior (?:systemic )?(?:therapy|treatment)/.test(t))
    return { min: null, max: 0 };

  return null;
}

/** Detects a stage requirement, e.g. "Stage IIIB or IV". */
function parseStages(text: string): number[] | null {
  const t = text.toLowerCase();
  if (!/\bstage\b/.test(t)) return null;
  const found = new Set<number>();
  const roman: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4 };
  for (const m of t.matchAll(/stage\s+(iv|iii|ii|i)\b/g)) {
    const n = roman[m[1]];
    if (n) found.add(n);
  }
  // "Stage IIIB or IIIC" style continuations.
  for (const m of t.matchAll(/\b(iv|iii|ii|i)[abc]?\b/g)) {
    const n = roman[m[1]];
    if (n) found.add(n);
  }
  return found.size > 0 ? [...found].sort() : null;
}

/**
 * "Treatment-naive required" / "any prior systemic therapy excluded".
 *
 * This is the single most common blocker pattern in the dataset and the reason
 * a pretreated patient falls out of first-line trials. Without it those lines
 * classify as unparsed, and a patient who is plainly ineligible is shown a
 * hopeful card.
 */
const RE_NAIVE =
  /\b(?:no prior systemic|treatment[-\s]na(?:i|ï)ve|systemic treatment na(?:i|ï)ve|previously untreated|no prior (?:systemic\s+)?(?:anti-?tumou?r|antineoplastic|antitumor|therapy|treatment)|has not received (?:any )?prior)\b/i;

const RE_PRIOR_SYSTEMIC =
  /\b(?:any prior systemic|prior systemic (?:anti-?tumou?r|antitumor|therapy|treatment)|systemic anti-?tumou?r therapy for (?:advanced|metastatic)|prior treatments? including)\b/i;

/**
 * Driver-mutation requirements. Boundary-matched on purpose: a bare /alk/
 * substring also matches "alkalization", which appears verbatim in this
 * dataset and has nothing to do with the ALK gene.
 */
const BIOMARKER_GENES = [
  "egfr", "alk", "ros1", "kras", "braf", "her2", "ret", "met", "ntrk", "pik3ca",
];
const RE_BIOMARKER_CONTEXT =
  /\b(mutation|alteration|rearrangement|fusion|positive|amplification|translocation|wild[-\s]?type)\b/i;

function biomarkerGenesIn(text: string): string[] {
  return BIOMARKER_GENES.filter((g) =>
    new RegExp(`(?<![a-z0-9])${g}(?![a-z0-9])`, "i").test(text),
  );
}

const RE = {
  platinum:
    /\b(platinum|carboplatin|cisplatin|oxaliplatin|platinum-based)\b/i,
  checkpoint:
    /\b(pd-?1|pd-?l1|anti-?pd|nivolumab|pembrolizumab|atezolizumab|durvalumab|checkpoint inhibitor|immunotherapy)\b/i,
  brainMets:
    /\b(brain metast|cns metast|central nervous system metast|leptomening|untreated cns)\b/i,
  measurable: /\b(measurable (disease|lesion)|recist)\b/i,
  priorTherapyContext:
    /\b(prior|previous|received|treated with|pretreat|has had|refractory to|na(?:i|ï)ve)\b/i,
};

/**
 * Permissive clauses: lines that GRANT latitude rather than impose a hurdle.
 *
 * NCT07339254 inclusion reads "Previous chemotherapy/radiotherapy/targeted/
 * immunotherapy is allowed at any prior timepoint." That is the protocol
 * removing a restriction, not a requirement the patient cleared — but it
 * contains "immunotherapy" + "Previous", so it classified as
 * prior_checkpoint_inhibitor and scored as a pass. Combined with the real
 * checkpoint line it produced two passes for one fact, and a six-line survey
 * rendered as a fully verified 100% match to a man with progressing disease.
 *
 * Checked FIRST in classify() for that reason: the drug names in these lines
 * would otherwise win.
 */
const RE_PERMISSIVE =
  /\b(?:is|are)\s+(?:allowed|permitted|acceptable|not required)\b|\b(?:no|without)\s+(?:restriction|limit|upper limit)\b|\bany number of prior\b|\bwill not (?:be )?exclude/i;

/** Assign a machine-evaluable rule kind to a raw criterion line. */
export function classify(text: string): RuleKind {
  // Permissive language first — see RE_PERMISSIVE.
  if (RE_PERMISSIVE.test(text)) return "permissive";
  // Order matters: more specific patterns first.

  if (parseEcogCeiling(text) !== null) return "ecog";
  if (parsePdl1Threshold(text) !== null) return "pdl1_threshold";
  if (RE.brainMets.test(text)) return "brain_mets";
  if (parsePriorLines(text) !== null) return "prior_lines";
  if (RE.platinum.test(text) && RE.priorTherapyContext.test(text))
    return "prior_platinum";
  if (RE.checkpoint.test(text) && RE.priorTherapyContext.test(text))
    return "prior_checkpoint_inhibitor";
  // Checked after the drug-specific rules so a line naming platinum or a
  // checkpoint inhibitor keeps its more precise classification.
  if (RE_NAIVE.test(text) || RE_PRIOR_SYSTEMIC.test(text))
    return "prior_any_therapy";
  if (biomarkerGenesIn(text).length > 0 && RE_BIOMARKER_CONTEXT.test(text))
    return "biomarker";
  if (parseStages(text) !== null) return "stage";
  if (RE.measurable.test(text)) return "measurable_disease";
  if (parseAgeFloor(text) !== null) return "age";
  return "unparsed";
}

/* ------------------------------------------------------------------ *
 * Criterion evaluation
 * ------------------------------------------------------------------ */

interface Decision {
  outcome: CriterionOutcome;
  detail: string;
}

const UNKNOWN = (what: string): Decision => ({
  outcome: "unknown",
  detail: `We could not tell from what you wrote whether ${what}.`,
});

/**
 * Evaluate one criterion against the profile.
 *
 * `side` matters: on an inclusion line the patient must satisfy the
 * condition; on an exclusion line satisfying it rules them OUT.
 */
function evaluate(
  kind: RuleKind,
  text: string,
  side: "inclusion" | "exclusion",
  p: PatientProfile,
): Decision {
  const flip = (d: Decision): Decision => {
    if (side === "inclusion" || d.outcome === "unknown") return d;
    return {
      outcome: d.outcome === "pass" ? "fail" : "pass",
      detail: d.detail,
    };
  };

  switch (kind) {
    case "ecog": {
      const ceiling = parseEcogCeiling(text);
      if (ceiling === null) return UNKNOWN("your performance status qualifies");
      if (p.ecog === null)
        return UNKNOWN(
          `your ECOG performance status is ${ceiling} or better (this trial requires it)`,
        );
      return p.ecog <= ceiling
        ? { outcome: "pass", detail: `Your ECOG ${p.ecog} meets the required ${ceiling} or better.` }
        : { outcome: "fail", detail: `This trial needs ECOG ${ceiling} or better; you noted ${p.ecog}.` };
    }

    case "pdl1_threshold": {
      const need = parsePdl1Threshold(text);
      if (need === null) return UNKNOWN("your PD-L1 level qualifies");
      if (p.pdl1Percent === null)
        return UNKNOWN(`your PD-L1 expression is at least ${need}%`);
      return p.pdl1Percent >= need
        ? { outcome: "pass", detail: `Your PD-L1 of ${p.pdl1Percent}% meets the ${need}% threshold.` }
        : { outcome: "fail", detail: `This trial requires PD-L1 ≥ ${need}%; you noted ${p.pdl1Percent}%.` };
    }

    case "brain_mets": {
      if (p.hasBrainMets === null)
        return UNKNOWN("you have brain or CNS metastases");
      return flip(
        p.hasBrainMets
          ? { outcome: "pass", detail: "You mentioned brain/CNS involvement, which this line covers." }
          : { outcome: "fail", detail: "You did not report brain/CNS metastases." },
      );
    }

    case "prior_platinum": {
      const had = p.priorTherapyClasses.includes("platinum");
      return flip(
        had
          ? { outcome: "pass", detail: "You reported prior platinum-based chemotherapy." }
          : { outcome: "fail", detail: "You did not report prior platinum chemotherapy." },
      );
    }

    case "prior_checkpoint_inhibitor": {
      const had = p.priorTherapyClasses.includes("checkpoint");
      return flip(
        had
          ? { outcome: "pass", detail: "You reported prior immunotherapy (PD-1/PD-L1)." }
          : { outcome: "fail", detail: "You did not report prior PD-1/PD-L1 immunotherapy." },
      );
    }

    case "age": {
      const floor = parseAgeFloor(text);
      if (floor === null || p.ageYears === null) return UNKNOWN("you meet the age requirement");
      return p.ageYears >= floor
        ? { outcome: "pass", detail: `You are ${p.ageYears}, meeting the ${floor}+ requirement.` }
        : { outcome: "fail", detail: `This trial requires age ${floor}+.` };
    }

    case "prior_any_therapy": {
      const systemic = p.priorTherapyClasses.filter((c) =>
        ["platinum", "checkpoint", "chemo", "targeted"].includes(c),
      );
      if (systemic.length === 0 && p.priorTherapies.length === 0)
        return UNKNOWN("you have had any previous systemic treatment");

      const hadSystemic = systemic.length > 0;
      const named = p.priorTherapies.slice(0, 2).join(" and ");

      // A "treatment-naive required" line and an "any prior systemic therapy"
      // exclusion mean the same thing from opposite directions, so normalise
      // to the naive-required reading and let `flip` handle the side.
      const naiveRequired = RE_NAIVE.test(text);
      if (naiveRequired) {
        return hadSystemic
          ? {
              outcome: "fail",
              detail: `This study is for people who have not had systemic treatment yet; you described ${named || "previous therapy"}.`,
            }
          : { outcome: "pass", detail: "You have not had prior systemic treatment." };
      }
      return flip(
        hadSystemic
          ? {
              outcome: "pass",
              detail: `You reported previous systemic treatment (${named || "prior therapy"}).`,
            }
          : { outcome: "fail", detail: "You did not report previous systemic treatment." },
      );
    }

    case "biomarker": {
      const genes = biomarkerGenesIn(text);
      if (genes.length === 0) return UNKNOWN("your tumour testing matches");
      const patientGenes = p.biomarkers.join(" ").toLowerCase();
      const hasAny = genes.some((g) =>
        new RegExp(`(?<![a-z0-9])${g}(?![a-z0-9])`, "i").test(patientGenes),
      );
      const label = genes.map((g) => g.toUpperCase()).join("/");
      if (p.biomarkers.length === 0)
        return UNKNOWN(`your tumour has a ${label} alteration`);
      return flip(
        hasAny
          ? { outcome: "pass", detail: `Your ${label} result matches what this study is testing.` }
          : {
              outcome: "fail",
              detail: `This study is for people with a ${label} alteration; you did not report one.`,
            },
      );
    }

    case "prior_lines": {
      const req = parsePriorLines(text);
      if (req === null) return UNKNOWN("your treatment history meets this requirement");

      // Whether ANY systemic therapy happened is reliably known from the drug
      // classes; HOW MANY LINES is not, and must come from priorLinesCount.
      const hadAnySystemic =
        p.priorTherapyClasses.some((c) =>
          ["platinum", "checkpoint", "chemo", "targeted"].includes(c),
        ) || p.priorTherapies.length > 0;

      // "Treatment-naive required" needs only the boolean, not a count.
      if (req.max === 0) {
        if (p.priorLinesCount === 0)
          return { outcome: "pass", detail: "This trial is for people who have not had systemic treatment yet, and you have not." };
        if (!hadAnySystemic && p.priorLinesCount === null)
          return UNKNOWN("you have had any previous systemic treatment");
        return { outcome: "fail", detail: "This trial is for people who have not had systemic treatment yet; you have had prior therapy." };
      }

      /*
       * Everything below compares against a NUMBER of lines, so it needs a real
       * line count. It used to substitute priorTherapyClasses.length, which
       * counts drugs, not regimens: carboplatin + pemetrexed + pembrolizumab
       * given together scored as three lines instead of one and failed every
       * "no more than 2 prior lines" trial. An unknown is the honest answer
       * when we cannot count.
       */
      const lines = p.priorLinesCount;
      if (lines === null)
        return UNKNOWN(
          `how many separate lines of treatment you have had (this trial ${
            req.max !== null ? `allows at most ${req.max}` : `requires at least ${req.min}`
          })`,
        );

      if (req.max !== null && lines > req.max)
        return { outcome: "fail", detail: `This trial allows at most ${req.max} prior line(s); you described ${lines}.` };
      if (req.min !== null && lines < req.min)
        return { outcome: "fail", detail: `This trial requires at least ${req.min} prior line(s) of therapy; you described ${lines}.` };
      return { outcome: "pass", detail: `Your ${lines} prior line(s) of treatment fit this trial's requirement.` };
    }


    case "stage": {
      const stages = parseStages(text);
      if (stages === null) return UNKNOWN("your stage qualifies");
      if (p.stageNumber === null) return UNKNOWN("which stage your cancer is");
      return flip(
        stages.includes(p.stageNumber)
          ? { outcome: "pass", detail: `Your stage ${p.stageNumber} is within the stages this trial studies.` }
          : { outcome: "fail", detail: `This trial studies stage ${stages.join("/")}; you noted stage ${p.stageNumber}.` },
      );
    }

    case "measurable_disease":
      return UNKNOWN("you have measurable disease by RECIST (your oncologist confirms this from scans)");

    case "permissive":
      return {
        outcome: "unknown",
        detail: "This line relaxes a restriction rather than setting one, so it is not scored for or against you.",
      };

    default:
      return {
        outcome: "unknown",
        detail: "This requirement needs a clinician to confirm from your records.",
      };
  }
}

/* ------------------------------------------------------------------ *
 * Condition gate
 * ------------------------------------------------------------------ */

/**
 * Disease-area synonyms.
 *
 * These are matched on WORD BOUNDARIES, never as bare substrings. Short
 * abbreviations are the reason: "ALL" (acute lymphoblastic leukemia) is a
 * substring of "sm-all", so naive `includes()` matched every leukemia trial
 * against "non-small cell lung cancer" and recommended AML studies to lung
 * patients. Any new abbreviation added here must be boundary-safe.
 */
const CANCER_SYNONYMS: Record<string, string[]> = {
  lung: ["lung", "nsclc", "sclc", "non-small cell", "small cell", "pulmonary"],
  melanoma: ["melanoma"],
  lymphoma: ["lymphoma", "hodgkin", "dlbcl"],
  myeloma: ["myeloma", "plasma cell"],
  leukemia: ["leukemia", "leukaemia", "aml", "cll", "cml", "myelodysplastic"],
  bladder: ["bladder", "urothelial"],
  kidney: ["renal", "kidney", "rcc"],
  liver: ["hepatocellular", "liver", "hcc"],
  colorectal: ["colorectal", "colon", "rectal"],
  gastric: ["gastric", "stomach", "esophageal", "gastroesophageal"],
  mesothelioma: ["mesothelioma"],
  breast: ["breast"],
  prostate: ["prostate"],
  ovarian: ["ovarian", "fallopian"],
  pancreatic: ["pancreatic", "pancreas"],
  headneck: ["head and neck", "squamous cell carcinoma of the head"],
};

const NSCLC_TERMS = ["nsclc", "non-small cell", "non small cell"];
const SCLC_TERMS = ["sclc", "small cell"];

/** Whole-word / whole-phrase containment. Avoids the "all" in "small" trap. */
function hasTerm(haystack: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i").test(haystack);
}

function conditionMatches(patientCancer: string | null, trial: Trial): boolean {
  if (!patientCancer) return false;
  const pc = patientCancer.toLowerCase();
  const trialText = trial.conditions.join(" ").toLowerCase();
  if (!trialText) return false;

  // Histologies that share an organ are not interchangeable. Keep a generic
  // "lung cancer" profile broad, but never route an explicit NSCLC profile to
  // an SCLC protocol (or the reverse).
  const patientNsclc = NSCLC_TERMS.some((term) => hasTerm(pc, term));
  const patientSclc = !patientNsclc && SCLC_TERMS.some((term) => hasTerm(pc, term));
  const trialNsclc = NSCLC_TERMS.some((term) => hasTerm(trialText, term));
  const trialSclc = !trialNsclc && SCLC_TERMS.some((term) => hasTerm(trialText, term));
  if ((patientNsclc && trialSclc) || (patientSclc && trialNsclc)) return false;

  for (const synonyms of Object.values(CANCER_SYNONYMS)) {
    const patientHits = synonyms.some((s) => hasTerm(pc, s));
    if (!patientHits) continue;
    const trialHits = synonyms.some((s) => hasTerm(trialText, s));
    if (trialHits) return true;
  }

  // Fall back to a full-phrase match only; never a loose substring.
  return hasTerm(trialText, pc) || hasTerm(pc, trialText);
}

/* ------------------------------------------------------------------ *
 * Trial scoring
 * ------------------------------------------------------------------ */

function evaluateSide(
  lines: RawCriterion[],
  side: "inclusion" | "exclusion",
  profile: PatientProfile,
): EvaluatedCriterion[] {
  return lines.map((source) => {
    const kind = classify(source);
    const { outcome, detail } = evaluate(kind, source, side, profile);
    return { kind, source, outcome, detail, side };
  });
}

/**
 * Collapse criteria that test the SAME patient fact on the same side into one
 * piece of evidence.
 *
 * A protocol may state one requirement across several lines. Counting each
 * line separately inflates the numerator without checking anything new — the
 * survey study NCT07339254 stated prior-immunotherapy twice and reached three
 * "passes" from two facts. Display still shows every line; only counting is
 * deduplicated.
 *
 * A `fail` always wins its slot: deduplication must never be able to hide a
 * blocker behind a pass on the same fact.
 */
const OUTCOME_RANK: Record<CriterionOutcome, number> = { fail: 0, pass: 1, unknown: 2 };

function distinctEvidence(criteria: EvaluatedCriterion[]): EvaluatedCriterion[] {
  const best = new Map<string, EvaluatedCriterion>();
  for (const c of criteria) {
    const key = `${c.side}:${c.kind}`;
    const cur = best.get(key);
    if (!cur || OUTCOME_RANK[c.outcome] < OUTCOME_RANK[cur.outcome]) best.set(key, c);
  }
  return [...best.values()];
}

export function matchTrial(trial: Trial, profile: PatientProfile): MatchResult {
  const evaluated = [
    ...evaluateSide(trial.inclusion, "inclusion", profile),
    ...evaluateSide(trial.exclusion, "exclusion", profile),
  ];

  // `permissive` lines grant latitude and are scored neither way; `unparsed`
  // lines we simply could not read. Neither is evidence about this patient.
  const scorable = evaluated.filter(
    (c) => c.kind !== "unparsed" && c.kind !== "permissive",
  );
  const decidable = distinctEvidence(scorable);
  const unreadable = evaluated.filter((c) => c.kind === "unparsed");
  const blockers = decidable.filter((c) => c.outcome === "fail");
  const passes = decidable.filter((c) => c.outcome === "pass");
  const openQuestions = decidable.filter((c) => c.outcome === "unknown");


  const onCondition = conditionMatches(profile.cancerType, trial);

  /*
   * Verdicts are gated on how much evidence exists, not only on its direction.
   * Previously a single passing criterion could produce a top-tier verdict on
   * a trial with twenty unread requirements. Requiring a minimum number of
   * decidable criteria makes "we barely checked this" structurally incapable
   * of presenting as "you're a match".
   */
  let verdict: MatchVerdict;
  if (!onCondition || blockers.length > 0) {
    verdict = "excluded";
  } else if (openQuestions.length > passes.length) {
    verdict = "needs_review";
  } else if (passes.length >= 2 && decidable.length >= 3) {
    verdict = "eligible";
  } else if (passes.length >= 1 && openQuestions.length <= passes.length) {
    verdict = "likely";
  } else {
    verdict = "needs_review";
  }

  // Score is a transparent function of evaluated criteria only.
  //
  // Unknowns count as half-weight against confidence: a trial we can only
  // partially evaluate should rank below one we could check cleanly, without
  // being penalised as hard as an outright failure. This keeps the ranking
  // honest — a high score means "we actually verified this", not "we found
  // nothing to object to".
  const weighted =
    passes.length + blockers.length + openQuestions.length * 0.5;
  const base = weighted === 0 ? 50 : (passes.length / weighted) * 100;
  const conditionBonus = onCondition ? 0 : -100;
  const score = Math.max(0, Math.min(100, Math.round(base + conditionBonus)));

  // Two separate honest numbers, because one number cannot say both things.
  // fit      = of what we could DECIDE, how much did the patient meet
  // coverage = how much of the protocol we could read at all
  //
  // `decided === 0` means every criterion we classified came back unknown.
  // That is an absence of evidence, and it used to be reported as 0 — the
  // same value as failing every check. A patient reading a card for a trial
  // he might well qualify for saw a hard zero. It is now null, and the UI is
  // required to render it as "not assessed" rather than a percentage.
  const decided = passes.length + blockers.length;
  const fit = decided === 0 ? null : Math.round((passes.length / decided) * 100);

  const total = evaluated.length;
  const coverage = {
    checked: decidable.length,
    total,
    unreadable: unreadable.length,
    pct: total === 0 ? 0 : Math.round((decidable.length / total) * 100),
  };


  return {
    trial,
    verdict,
    score,
    fit,
    coverage,
    evaluated,
    blockers,
    openQuestions,
    unreadable,
  };
}

/**
 * Observational studies — surveys, registries, questionnaires — are not
 * treatment options. NCT07339254 is a patient-attitudes survey with six
 * eligibility lines; it out-ranked every interventional trial because loose
 * protocols are trivially easy to satisfy. A patient asking for a trial is
 * asking for treatment, so these are held out of the ranked list.
 */
function isInterventional(t: Trial): boolean {
  const text = `${t.interventions.join(" ")} ${t.phase}`;
  return !/non-?interventional|observational|survey|registry|questionnaire/i.test(text);
}

export function matchAll(trials: Trial[], profile: PatientProfile): MatchResult[] {
  const treatable = trials.filter(isInterventional);
  const onCondition = treatable.filter((t) => conditionMatches(profile.cancerType, t));
  // Only rank trials in the patient's disease area; the rest are noise.
  const pool = onCondition.length > 0 ? onCondition : treatable;


  return pool
    .map((t) => matchTrial(t, profile))
    .sort((a, b) => {
      const rank: Record<MatchVerdict, number> = {
        eligible: 0,
        likely: 1,
        needs_review: 2,
        excluded: 3,
      };
      if (rank[a.verdict] !== rank[b.verdict]) return rank[a.verdict] - rank[b.verdict];
      return b.score - a.score;
    });
}

/**
 * The trials the patient came closest to qualifying for, ranked by nearness.
 *
 * People understand a decision by contrast — "why this one and not that one".
 * A near miss with the exact blocking sentence quoted is a better explanation
 * than any amount of prose about the ones that matched, and it is also the
 * evidence the researcher dashboard later aggregates. It must never be an
 * incidental leftover of the results list, so it is computed separately.
 */
export function closestMisses(results: MatchResult[], limit = 3): MatchResult[] {
  return results
    .filter((r) => r.verdict === "excluded" && r.blockers.length > 0)
    .sort((a, b) => {
      if (a.blockers.length !== b.blockers.length)
        return a.blockers.length - b.blockers.length; // fewest things wrong
      const ap = a.evaluated.filter((c) => c.outcome === "pass").length;
      const bp = b.evaluated.filter((c) => c.outcome === "pass").length;
      if (ap !== bp) return bp - ap; // most things already right
      return b.score - a.score; // strongest remaining evidence
    })
    .slice(0, limit);
}

/* ------------------------------------------------------------------ *
 * Researcher signal
 * ------------------------------------------------------------------ */

const SIGNAL_LABELS: Record<RuleKind, string> = {
  permissive: "Protocol latitude (not a requirement)",
  prior_any_therapy: "Prior systemic therapy (treatment-naive required)",
  biomarker: "Required tumour biomarker",
  ecog: "ECOG performance status ceiling",
  pdl1_threshold: "PD-L1 expression threshold",
  prior_platinum: "Prior platinum chemotherapy",
  prior_checkpoint_inhibitor: "Prior PD-1/PD-L1 immunotherapy",
  prior_lines: "Prior lines of therapy limit",
  brain_mets: "Brain / CNS metastases",
  measurable_disease: "Measurable disease (RECIST)",
  stage: "Disease stage window",
  age: "Age requirement",
  condition: "Disease area",
  unparsed: "Other protocol requirement",
};

/**
 * Aggregate the reasons an interested patient was ruled out, ranked by how
 * many trials each reason cost them. This is the Protocol Optimization signal.
 */
export function deriveSignals(results: MatchResult[]): UnmatchedSignal[] {
  const byKind = new Map<RuleKind, { count: number; trial: string; criterion: string }>();

  for (const r of results) {
    // Count each blocking reason once per trial.
    const seen = new Set<RuleKind>();
    for (const b of r.blockers) {
      if (seen.has(b.kind)) continue;
      seen.add(b.kind);
      const cur = byKind.get(b.kind);
      if (cur) cur.count += 1;
      else byKind.set(b.kind, { count: 1, trial: r.trial.nctId, criterion: b.source });
    }
  }

  return [...byKind.entries()]
    .map(([kind, v]) => ({
      kind,
      label: SIGNAL_LABELS[kind],
      trialsBlocked: v.count,
      exampleTrial: v.trial,
      exampleCriterion: v.criterion,
    }))
    .sort((a, b) => b.trialsBlocked - a.trialsBlocked);
}
