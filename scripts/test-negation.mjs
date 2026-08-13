const NEG=/\b(?:no|not|without|negative for|denies|free of|clear of)\b[^.]{0,30}?(?:brain|cns)\b|(?:brain|cns)[^.]{0,30}?\b(?:clear|clean|negative|unremarkable|no evidence)\b/;
const POS=/brain metast|cns metast|spread to (?:my |the )?brain|mets? in (?:my |the )?brain|brain mets?\b/;
const f=t=>{t=t.toLowerCase();return NEG.test(t)?false:POS.test(t)?true:null;};
const cases=[
 ["No brain mets so far.",false],
 ["there's no sign it's reached my brain",false],
 ["The brain MRI was clear - no spread there.",false],
 ["my brain scan came back clean",false],
 ["negative for CNS metastases",false],
 ["It has spread to my brain.",true],
 ["I have brain metastases.",true],
 ["MRI showed mets in my brain",true],
 ["untreated CNS metastases were found",true],
 ["I get tired easily.",null],
];
let bad=0;
for(const [txt,want] of cases){const got=f(txt);const ok=got===want;if(!ok)bad++;
console.log((ok?'  OK  ':'  FAIL'),JSON.stringify(txt).slice(0,48).padEnd(50),'got:',String(got).padEnd(6),'want:',want);}
console.log(bad===0?'\nall negation cases pass':`\n${bad} FAILING`);
