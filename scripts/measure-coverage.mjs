import fs from 'node:fs';
const d=JSON.parse(fs.readFileSync('src/data/trials.json','utf8'));
const NAIVE=/\b(?:no prior systemic|treatment[-\s]na(?:i|ï)ve|systemic treatment na(?:i|ï)ve|previously untreated|no prior (?:systemic\s+)?(?:anti-?tumou?r|antineoplastic|antitumor|therapy|treatment)|has not received (?:any )?prior)\b/i;
const PRIOR=/\b(?:any prior systemic|prior systemic (?:anti-?tumou?r|antitumor|therapy|treatment)|systemic anti-?tumou?r therapy for (?:advanced|metastatic)|prior treatments? including)\b/i;
const GENES=["egfr","alk","ros1","kras","braf","her2","ret","met","ntrk","pik3ca"];
const CTX=/\b(mutation|alteration|rearrangement|fusion|positive|amplification|translocation|wild[-\s]?type)\b/i;
const gin=t=>GENES.some(g=>new RegExp(`(?<![a-z0-9])${g}(?![a-z0-9])`,'i').test(t));
const ecog=t=>/ecog|eastern cooperative|performance status/i.test(t)&&/[0-4]/.test(t);
const pdl1=t=>/pd-?l1/i.test(t)&&/\d{1,3}\s*%/.test(t);
const stage=t=>/stage\s+(iv|iii|ii|i)\b/i.test(t);
const brain=/\b(brain metast|cns metast|central nervous system metast|leptomening|untreated cns)\b/i;
const meas=/\b(measurable (disease|lesion)|recist)\b/i;
const plat=/\b(platinum|carboplatin|cisplatin|oxaliplatin)\b/i;
const cp=/\b(pd-?1|pd-?l1|anti-?pd|nivolumab|pembrolizumab|atezolizumab|durvalumab|checkpoint inhibitor|immunotherapy)\b/i;
const ctx2=/\b(prior|previous|received|treated with|pretreat|has had|refractory to|na(?:i|ï)ve)\b/i;
const age=t=>/(?:≥|>=|at least)\s*\d{1,2}\s*years/i.test(t);
function cls(x){
 if(ecog(x))return 1; if(pdl1(x))return 1; if(brain.test(x))return 1;
 if(plat.test(x)&&ctx2.test(x))return 1; if(cp.test(x)&&ctx2.test(x))return 1;
 if(NAIVE.test(x)||PRIOR.test(x))return 1; if(gin(x)&&CTX.test(x))return 1;
 if(stage(x))return 1; if(meas.test(x))return 1; if(age(x))return 1; return 0;}
const lung=d.trials.filter(t=>/lung|nsclc/i.test(t.conditions.join(' ')));
let tot=0,ok=0; const per=[];
for(const t of lung){let n=0;for(const s of['inclusion','exclusion'])for(const c of t[s]){tot++;const k=cls(c);ok+=k;n+=k;}per.push(n);}
per.sort((a,b)=>a-b);
console.log(`lung trials ${lung.length} | criteria ${tot} | machine-evaluable ${ok} (${Math.round(ok/tot*100)}%)`);
console.log(`per trial: min ${per[0]} median ${per[Math.floor(per.length/2)]} max ${per[per.length-1]}`);
