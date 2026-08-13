/** Loads the committed ClinicalTrials.gov dataset. */

import data from "@/data/trials.json";
import type { Trial, TrialsFile } from "./types";

const file = data as TrialsFile;

export const TRIALS: Trial[] = file.trials;
export const TRIALS_META = {
  source: file.source,
  sponsor: file.sponsor,
  fetchedAt: file.fetchedAt,
  count: file.count,
};
