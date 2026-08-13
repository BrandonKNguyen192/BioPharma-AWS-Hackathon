const SYN={lung:["lung","nsclc","sclc","non-small cell","small cell","pulmonary"],
melanoma:["melanoma"],lymphoma:["lymphoma","hodgkin","dlbcl"],myeloma:["myeloma","plasma cell"],
leukemia:["leukemia","leukaemia","aml","cll","cml","myelodysplastic"],bladder:["bladder","urothelial"],
kidney:["renal","kidney","rcc"],liver:["hepatocellular","liver","hcc"],colorectal:["colorectal","colon","rectal"],
gastric:["gastric","stomach","esophageal","gastroesophageal"],mesothelioma:["mesothelioma"],breast:["breast"],prostate:["prostate"]};
const has=(h,t)=>new RegExp(`(?<![a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?![a-z0-9])`,'i').test(h);
function cm(pc,tt){pc=pc.toLowerCase();tt=tt.toLowerCase();if(!tt)return false;
for(const s of Object.values(SYN)){if(!s.some(x=>has(pc,x)))continue;if(s.some(x=>has(tt,x)))return true;}
return has(tt,pc)||has(pc,tt);}
const P='non-small cell lung cancer';
const cases=[
 ['Non-small Cell Lung Cancer',true],
 ['Carcinoma, Non-Small-Cell Lung',true],
 ['Small Cell Lung Cancer',true],
 ['Relapsed or Refractory Acute Myeloid Leukemia, Myelodysplastic Syndrome',false],
 ['Advanced Malignant Tumors',false],
 ['Advanced Solid Tumors',false],
 ['Melanoma',false],
 ['Multiple Myeloma',false],
 ['Hepatocellular Carcinoma',false],
];
let bad=0;
for(const [t,want] of cases){const got=cm(P,t);const ok=got===want;if(!ok)bad++;
console.log((ok?'  OK  ':'  FAIL'),String(got).padEnd(6),t.slice(0,60));}
console.log(bad===0?'\nall condition-gate cases pass':`\n${bad} FAILING`);
