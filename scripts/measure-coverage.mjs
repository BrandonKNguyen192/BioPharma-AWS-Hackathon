/** Reports what share of published criteria the engine can evaluate. Keep the
 *  patterns here in sync with src/lib/match.ts classify(). */
import fs from 'node:fs';
const file=JSON.parse(fs.readFileSync(new URL('../src/data/trials.json',import.meta.url),'utf8'));
const ecog=t=>{t=t.toLowerCase();if(!/ecog|eastern cooperative|performance status/.test(t))return null;
let m=/([0-4])\s*(?:-|–|to|or|,)\s*(?:or\s*)?([0-4])/.exec(t);if(m)return 1;
m=/(?:≤|<=|less than or equal to|no greater than|at most)\s*([0-4])/.exec(t);if(m)return 1;
m=/(?:status|ecog|ps)\D{0,20}?([0-4])\b/.exec(t);return m?1:null;};
const pdl1=t=>{t=t.toLowerCase();if(!/pd-?l1/.test(t))return null;return /(\d{1,3})\s*%/.test(t)?1:null;};
const lines=t=>{t=t.toLowerCase();if(!/\b(prior|previous)\s+(lines?|regimens?|systemic therap)/.test(t))return null;
return /(?:no more than|at most|≤|<=|up to|at least|≥|>=|minimum of)\s*\d\s*(?:prior\s*)?(?:lines?|regimens?)/.test(t)||/treatment[- ]na(?:i|ï)ve|no prior (?:systemic )?(?:therapy|treatment)/.test(t)?1:null;};
const stage=t=>/\bstage\b/i.test(t)&&/stage\s+(iv|iii|ii|i)\b/i.test(t)?1:null;
const age=t=>/(?:≥|>=|at least)\s*\d{1,2}\s*years/i.test(t)?1:null;
const RE={plat:/\b(platinum|carboplatin|cisplatin|oxaliplatin)\b/i,
cp:/\b(pd-?1|pd-?l1|anti-?pd|nivolumab|pembrolizumab|atezolizumab|durvalumab|checkpoint inhibitor|immunotherapy)\b/i,
brain:/\b(brain metast|cns metast|central nervous system metast|leptomening|untreated cns)\b/i,
meas:/\b(measurable (disease|lesion)|recist)\b/i,
ctx:/\b(prior|previous|received|treated with|pretreat|has had|refractory to|na(?:i|ï)ve)\b/i};
function classify(x){if(ecog(x))return'ecog';if(pdl1(x))return'pdl1_threshold';
if(RE.brain.test(x))return'brain_mets';if(lines(x))return'prior_lines';
if(RE.plat.test(x)&&RE.ctx.test(x))return'prior_platinum';
if(RE.cp.test(x)&&RE.ctx.test(x))return'prior_checkpoint_inhibitor';
if(stage(x))return'stage';if(RE.meas.test(x))return'measurable_disease';
if(age(x))return'age';return'unparsed';}
const lung=file.trials.filter(t=>/lung|nsclc/i.test(t.conditions.join(' ')));
const counts={};let parsed=0,total=0;const perTrial=[];
for(const t of lung){let n=0;for(const side of['inclusion','exclusion'])for(const c of t[side]){
total++;const k=classify(c);counts[k]=(counts[k]||0)+1;if(k!=='unparsed'){parsed++;n++;}}perTrial.push(n);}
console.log(`lung trials: ${lung.length} | criteria lines: ${total} | machine-evaluable: ${parsed} (${Math.round(parsed/total*100)}%)`);
console.log(`evaluable criteria per trial: min ${Math.min(...perTrial)}, median ${perTrial.slice().sort((a,b)=>a-b)[Math.floor(perTrial.length/2)]}, max ${Math.max(...perTrial)}`);
console.log('\nrule distribution:');
for(const [k,v] of Object.entries(counts).sort((a,b)=>b[1]-a[1]))console.log(String(v).padStart(4),k);
