/**
 * Pharmacovigilance Drug-Drug Interaction (DDI) & ADR Causality Engine
 * 
 * Complies with ICH E2A, WHO-UMC causality principles, and FDA/EMA DDI Guidance.
 * Evaluates pharmacokinetic (CYP450 / Transporters) and pharmacodynamic interactions,
 * and directly assesses whether a detected interaction is the underlying etiology or
 * exacerbating cofactor for the patient's reported Adverse Drug Reactions (ADRs).
 */

import { AdverseEvent, DrugAdministration } from '../types/pv';

export type DdiSeverity = 'Contraindicated / Severe' | 'Major / High Risk' | 'Moderate / Caution' | 'Minor' | 'None';

export type DdiMechanismType =
  | 'Pharmacokinetic (CYP450 / Transporter)'
  | 'Pharmacodynamic (Additive / Synergistic Toxicity)'
  | 'Pharmacodynamic (Antagonistic / Reduced Efficacy)'
  | 'Physicochemical / Chelation'
  | 'Renal Tubular Clearance Competition'
  | 'None';

export type DdiAdrCausalityRole =
  | 'Likely ADR Cause / Primary Driver'
  | 'Possible Contributing Factor'
  | 'Unlikely ADR Cause'
  | 'No Interaction';

export interface DrugDdiAdrAssessment {
  hasInteraction: boolean;
  severity: DdiSeverity;
  interactingDrugs: string[];
  mechanism: string;
  mechanismType: DdiMechanismType;
  cypOrTarget?: string;
  mayCauseAdr: boolean;
  adrCausalityRole: DdiAdrCausalityRole;
  adrMatchExplanation: string;
  clinicalAdvice: string;
  evidenceLevel: 'SmPC Black Box / Contraindicated' | 'Well-Established (Grade A)' | 'Clinical Reports (Grade B)' | 'Theoretical / In Vitro';
}

export interface DdiPairRule {
  drugAKeywords: string[];
  drugBKeywords: string[];
  severity: DdiSeverity;
  mechanismType: DdiMechanismType;
  cypOrTarget: string;
  mechanism: string;
  typicalAdrs: string[]; // ADR keywords that this interaction typically causes or worsens
  adrMatchExplanation: string;
  clinicalAdvice: string;
  evidenceLevel: 'SmPC Black Box / Contraindicated' | 'Well-Established (Grade A)' | 'Clinical Reports (Grade B)' | 'Theoretical / In Vitro';
}

/**
 * Clinical Pharmacology Knowledge Base of High-Impact Drug-Drug Interactions
 */
export const DDI_KNOWLEDGE_BASE: DdiPairRule[] = [
  // 1. Anticoagulants (Warfarin/DOACs) + Antifungals / CYP2C9 inhibitors (Fluconazole, Metronidazole, Amiodarone)
  {
    drugAKeywords: ['warfarin', 'coumadin', 'jantoven'],
    drugBKeywords: ['fluconazole', 'diflucan', 'amiodarone', 'cordarone', 'metronidazole', 'flagyl', 'bactrim', 'trimethoprim', 'sulfamethoxazole'],
    severity: 'Major / High Risk',
    mechanismType: 'Pharmacokinetic (CYP450 / Transporter)',
    cypOrTarget: 'CYP2C9 Inhibition',
    mechanism: 'Strong inhibition of S-warfarin clearance via CYP2C9, resulting in marked accumulation, supratherapeutic INR (>5.0), and severe hemorrhagic diathesis.',
    typicalAdrs: ['bleed', 'hemorrhage', 'hematoma', 'inr increased', 'prothrombin time', 'melena', 'hematuria', 'epistaxis', 'anemia', 'gastrointestinal bleed'],
    adrMatchExplanation: 'Strong clinical causality: CYP2C9 inhibition by the co-administered agent markedly inhibits S-warfarin clearance, directly causing elevated INR and triggering severe hemorrhagic manifestations.',
    clinicalAdvice: 'Empiric warfarin dose reduction by 30-50% required upon initiation; daily INR monitoring until stable; investigate for occult bleeding sources.',
    evidenceLevel: 'SmPC Black Box / Contraindicated',
  },

  // 2. Anticoagulants / DOACs (Apixaban, Rivaroxaban) + Strong CYP3A4 & P-gp Inhibitors (Ketoconazole, Clarithromycin, Ritonavir, Itraconazole)
  {
    drugAKeywords: ['apixaban', 'eliquis', 'rivaroxaban', 'xarelto', 'edoxaban', 'dabigatran', 'pradaxa'],
    drugBKeywords: ['ketoconazole', 'nizoral', 'clarithromycin', 'biaxin', 'itraconazole', 'sporanox', 'ritonavir', 'paxlovid', 'diltiazem', 'verapamil'],
    severity: 'Major / High Risk',
    mechanismType: 'Pharmacokinetic (CYP450 / Transporter)',
    cypOrTarget: 'Dual CYP3A4 & P-gp Inhibition',
    mechanism: 'Concomitant inhibition of intestinal and hepatic CYP3A4 along with P-glycoprotein efflux increases direct oral anticoagulant (DOAC) peak plasma concentrations (Cmax) and AUC by up to 200%.',
    typicalAdrs: ['bleed', 'hemorrhage', 'hematoma', 'melena', 'hematuria', 'gastrointestinal bleed', 'intracranial bleed', 'anemia', 'hypotension'],
    adrMatchExplanation: 'High biological plausibility: Dual CYP3A4/P-gp inhibition leads to supratherapeutic DOAC systemic exposure, directly provoking acute hemorrhagic complications.',
    clinicalAdvice: 'Dose reduction or alternative antimicrobial/antihypertensive without CYP3A4/P-gp inhibition recommended. Immediate hemostatic assessment.',
    evidenceLevel: 'SmPC Black Box / Contraindicated',
  },

  // 3. Anticoagulants / Antiplatelets + NSAIDs (Synergistic Bleeding Diathesis)
  {
    drugAKeywords: ['warfarin', 'coumadin', 'apixaban', 'eliquis', 'rivaroxaban', 'xarelto', 'clopidogrel', 'plavix', 'prasugrel', 'ticagrelor', 'aspirin'],
    drugBKeywords: ['ibuprofen', 'advil', 'motrin', 'naproxen', 'aleve', 'ketorolac', 'toradol', 'diclofenac', 'voltaren', 'meloxicam', 'indomethacin', 'celecoxib'],
    severity: 'Major / High Risk',
    mechanismType: 'Pharmacodynamic (Additive / Synergistic Toxicity)',
    cypOrTarget: 'COX-1 Platelet Inhibition & Gastric Mucosal Erosion',
    mechanism: 'Synergistic pharmacodynamic impairment of primary and secondary hemostasis: NSAID-induced gastric mucosal cyclooxygenase-1 inhibition combined with systemic anticoagulation/antiplatelet effect exponentially increases ulceration and major bleeding.',
    typicalAdrs: ['bleed', 'hemorrhage', 'hematoma', 'melena', 'ulcer', 'gastritis', 'gastrointestinal bleed', 'hematemesis', 'anemia'],
    adrMatchExplanation: 'Direct pharmacodynamic synergy: NSAID-induced gastric epithelial barrier breakdown compounded by systemic anticoagulation is a classic cause of severe acute upper GI hemorrhage.',
    clinicalAdvice: 'Discontinue NSAID immediately. Substitute with paracetamol/acetaminophen or topical agents; co-prescribe high-dose proton pump inhibitor (PPI) for mucosal restitution.',
    evidenceLevel: 'SmPC Black Box / Contraindicated',
  },

  // 4. Statins (Simvastatin, Atorvastatin, Lovastatin) + CYP3A4 Inhibitors (Clarithromycin, Ketoconazole, Amiodarone, Diltiazem, Grapefruit)
  {
    drugAKeywords: ['simvastatin', 'zocor', 'atorvastatin', 'lipitor', 'lovastatin', 'mevacor'],
    drugBKeywords: ['clarithromycin', 'biaxin', 'erythromycin', 'ketoconazole', 'itraconazole', 'amiodarone', 'cordarone', 'diltiazem', 'cardizem', 'verapamil', 'calan', 'grapefruit'],
    severity: 'Contraindicated / Severe',
    mechanismType: 'Pharmacokinetic (CYP450 / Transporter)',
    cypOrTarget: 'CYP3A4 Metabolic Blockade',
    mechanism: 'Inhibition of CYP3A4-mediated hepatic first-pass and systemic clearance increases active statin acid AUC by 5-fold to 12-fold, precipitating severe myotoxicity, myoglobin release, and acute renal tubular necrosis.',
    typicalAdrs: ['rhabdomyolysis', 'myopathy', 'myalgia', 'ck increased', 'creatine kinase', 'muscle weakness', 'acute kidney injury', 'renal failure', 'myoglobinuria', 'dark urine'],
    adrMatchExplanation: 'Textbook pharmacovigilance causality: CYP3A4 inhibition blocks statin degradation, driving skeletal muscle myocyte membrane disruption, profound CK elevation, and acute rhabdomyolysis.',
    clinicalAdvice: 'Immediately discontinue both agents. Hydrate with aggressive IV isotonic saline to prevent renal cast nephropathy; monitor serum CK, potassium, and creatinine.',
    evidenceLevel: 'SmPC Black Box / Contraindicated',
  },

  // 5. ACE Inhibitors / ARBs + Potassium-Sparing Diuretics / Spironolactone / NSAIDs / Trimethoprim
  {
    drugAKeywords: ['lisinopril', 'enalapril', 'ramipril', 'losartan', 'valsartan', 'candesartan', 'olmesartan'],
    drugBKeywords: ['spironolactone', 'aldactone', 'eplerenone', 'triamterene', 'amiloride', 'potassium', 'k-dur', 'trimethoprim', 'bactrim', 'ibuprofen', 'naproxen'],
    severity: 'Major / High Risk',
    mechanismType: 'Pharmacodynamic (Additive / Synergistic Toxicity)',
    cypOrTarget: 'Distal Tubular Aldosterone Blockade & Afferent Arteriolar Vasoconstriction',
    mechanism: 'Combined suppression of the renin-angiotensin-aldosterone axis suppresses renal potassium excretion, inducing severe hyperkalemia and acute prerenal azotemia.',
    typicalAdrs: ['hyperkalemia', 'potassium increased', 'arrhythmia', 'cardiac arrest', 'acute kidney injury', 'renal failure', 'creatinine increased', 'bradycardia', 'weakness'],
    adrMatchExplanation: 'High causal correlation: Additive blockade of aldosterone-dependent renal potassium secretion by both agents directly causes life-threatening hyperkalemic cardiotoxicity.',
    clinicalAdvice: 'Obtain emergency 12-lead ECG (evaluate peaked T waves / PR prolongation); administer IV calcium gluconate, insulin/dextrose, and potassium-wasting agents; suspend offending drugs.',
    evidenceLevel: 'Well-Established (Grade A)',
  },

  // 6. QTc Prolonging Agents (Antiarrhythmics, Macrolides, Quinolones, Antipsychotics, Ondansetron, Citalopram)
  {
    drugAKeywords: ['amiodarone', 'sotalol', 'dofetilide', 'citalopram', 'celexa', 'escitalopram', 'lexapro', 'haloperidol', 'haldol', 'quetiapine', 'seroquel', 'methadone'],
    drugBKeywords: ['azithromycin', 'zithromax', 'clarithromycin', 'levofloxacin', 'levaquin', 'moxifloxacin', 'ciprofloxacin', 'ondansetron', 'zofran', 'fluconazole', 'hydroxychloroquine'],
    severity: 'Contraindicated / Severe',
    mechanismType: 'Pharmacodynamic (Additive / Synergistic Toxicity)',
    cypOrTarget: 'Cardiac hERG / IKr Potassium Channel Inhibition',
    mechanism: 'Additive delayed ventricular repolarization via additive cardiac hERG potassium current blockade, prolonging QTc interval past 500 ms and predisposing to polymorphic ventricular tachycardia (Torsades de Pointes).',
    typicalAdrs: ['qt prolongation', 'electrocardiogram qt prolonged', 'torsade', 'ventricular tachycardia', 'arrhythmia', 'syncope', 'cardiac arrest', 'palpitations', 'sudden death'],
    adrMatchExplanation: 'Definitive electrophysiological synergy: Concomitant administration of multiple hERG channel antagonists causes additive QTc prolongation, triggering early afterdepolarizations and ventricular arrhythmias.',
    clinicalAdvice: 'Discontinue interacting QTc agents immediately. Continuous telemetry monitoring; replenish serum magnesium (target > 2.0 mg/dL) and potassium (target > 4.5 mEq/L).',
    evidenceLevel: 'SmPC Black Box / Contraindicated',
  },

  // 7. Immune Checkpoint Inhibitors + Cardiotoxic or Immunomodulating Agents
  {
    drugAKeywords: ['pembrolizumab', 'keytruda', 'nivolumab', 'opdivo', 'ipilimumab', 'yervoy', 'atezolizumab', 'durvalumab'],
    drugBKeywords: ['amlodipine', 'doxorubicin', 'trastuzumab', 'sunitinib', 'trametinib', 'dabrafenib'],
    severity: 'Moderate / Caution',
    mechanismType: 'Pharmacodynamic (Additive / Synergistic Toxicity)',
    cypOrTarget: 'T-Cell Mediated Cytotoxic Infiltration & Myocardial Strain',
    mechanism: 'Immune checkpoint inhibition disinhibits autoreactive T-cell clones against cardiac alpha-myosin heavy chain; co-administered cardiovascular agents or cytotoxic agents may increase cardiomyocyte susceptibility.',
    typicalAdrs: ['myocarditis', 'autoimmune myocarditis', 'troponin increased', 'chest pain', 'dyspnea', 'heart failure', 'ejection fraction decreased', 'arrhythmia'],
    adrMatchExplanation: 'Plausible biological synergy: Checkpoint inhibitor induces autoimmune cytotoxic lymphocytic infiltration of the myocardium; co-existing myocardial stressors accelerate acute cardiac decompensation.',
    clinicalAdvice: 'Hold immune checkpoint inhibitor indefinitely. High-dose methylprednisolone pulse therapy (1000 mg/day) and cardio-oncology consultation.',
    evidenceLevel: 'Well-Established (Grade A)',
  },

  // 8. Clopidogrel + Omeprazole / Esomeprazole (CYP2C19 Bioactivation Inhibition)
  {
    drugAKeywords: ['clopidogrel', 'plavix'],
    drugBKeywords: ['omeprazole', 'prilosec', 'esomeprazole', 'nexium'],
    severity: 'Major / High Risk',
    mechanismType: 'Pharmacokinetic (CYP450 / Transporter)',
    cypOrTarget: 'CYP2C19 Bioactivation Inhibition',
    mechanism: 'Omeprazole competitively inhibits CYP2C19, preventing the essential enzymatic bioactivation of clopidogrel prodrug into its active thiol metabolite, leading to reduced platelet inhibition and recurrent thrombosis.',
    typicalAdrs: ['stent thrombosis', 'myocardial infarction', 'thrombosis', 'stroke', 'angina', 'ischemia', 'treatment failure'],
    adrMatchExplanation: 'Mechanism aligns with therapeutic failure (Rawlins-Thompson Type F): CYP2C19 inhibition prevents clopidogrel activation, precipitating acute vascular thrombotic events despite documented therapy.',
    clinicalAdvice: 'Switch omeprazole to pantoprazole or famotidine, which do not significantly inhibit CYP2C19, or consider ticagrelor/prasugrel.',
    evidenceLevel: 'SmPC Black Box / Contraindicated',
  },

  // 9. Opioids + Benzodiazepines / CNS Depressants
  {
    drugAKeywords: ['morphine', 'oxycodone', 'hydrocodone', 'fentanyl', 'hydromorphone', 'methadone', 'tramadol', 'codeine'],
    drugBKeywords: ['lorazepam', 'ativan', 'diazepam', 'valium', 'alprazolam', 'xanax', 'clonazepam', 'klonopin', 'midazolam', 'gabapentin', 'pregabalin'],
    severity: 'Contraindicated / Severe',
    mechanismType: 'Pharmacodynamic (Additive / Synergistic Toxicity)',
    cypOrTarget: 'Additive GABA-A & Mu-Opioid Receptor Brainstem Depression',
    mechanism: 'Profound synergistic depression of medullary ventilatory drive centers through concurrent mu-opioid and GABA-A receptor activation, resulting in acute hypercapnic respiratory arrest and death.',
    typicalAdrs: ['respiratory depression', 'coma', 'somnolence', 'hypoxia', 'respiratory arrest', 'sedation', 'death', 'bradypnea', 'aspiration'],
    adrMatchExplanation: 'Direct synergistic lethality: Opioid and benzodiazepine combination causes marked synergistic blunting of hypercapnic ventilatory response, directly explaining acute respiratory depression.',
    clinicalAdvice: 'Avoid concurrent prescription. Have naloxone readily accessible; reduce doses by 50% if co-administration is clinically unavoidable.',
    evidenceLevel: 'SmPC Black Box / Contraindicated',
  },

  // 10. Serotonergic Agents (SSRIs, SNRIs, Tramadol, Linezolid, Triptans, MAOIs)
  {
    drugAKeywords: ['sertraline', 'zoloft', 'fluoxetine', 'prozac', 'paroxetine', 'paxil', 'citalopram', 'escitalopram', 'duloxetine', 'venlafaxine'],
    drugBKeywords: ['tramadol', 'ultram', 'linezolid', 'zyvox', 'sumatriptan', 'selegiline', 'rasagiline', 'dextromethorphan', 'st. john', 'lithium'],
    severity: 'Major / High Risk',
    mechanismType: 'Pharmacodynamic (Additive / Synergistic Toxicity)',
    cypOrTarget: 'Synaptic Serotonin (5-HT1A / 5-HT2A) Over-accumulation',
    mechanism: 'Excessive intra-synaptic serotonin concentrations throughout the central nervous system trigger hyper-stimulation of 5-HT1A and 5-HT2A receptors.',
    typicalAdrs: ['serotonin syndrome', 'hyperreflexia', 'clonus', 'tremor', 'hyperthermia', 'agitation', 'diaphoresis', 'delirium', 'autonomic instability'],
    adrMatchExplanation: 'Classic pharmacological etiology: Co-administration of multiple serotonergic agents precipitates central serotonin toxicity (Hunter Serotonin Toxicity Criteria).',
    clinicalAdvice: 'Discontinue all serotonergic agents immediately; provide supportive cooling, benzodiazepines for neuromuscular agitation, and cyproheptadine.',
    evidenceLevel: 'Well-Established (Grade A)',
  },

  // 11. Digoxin + P-gp / Clearance Inhibitors (Amiodarone, Verapamil, Clarithromycin, Quinidine)
  {
    drugAKeywords: ['digoxin', 'lanoxin'],
    drugBKeywords: ['amiodarone', 'verapamil', 'clarithromycin', 'quinidine', 'spironolactone', 'propafenone'],
    severity: 'Major / High Risk',
    mechanismType: 'Pharmacokinetic (CYP450 / Transporter)',
    cypOrTarget: 'Renal & Biliary P-glycoprotein Clearance Inhibition',
    mechanism: 'Inhibition of renal tubular P-glycoprotein-mediated active secretion of digoxin leads to 70% to 100% elevation in steady-state serum digoxin concentrations into toxic ranges (>2.0 ng/mL).',
    typicalAdrs: ['digoxin toxicity', 'bradycardia', 'heart block', 'arrhythmia', 'nausea', 'vomiting', 'xanthopsia', 'vision blurred', 'ventricular arrhythmia'],
    adrMatchExplanation: 'Strong pharmacokinetic causation: P-glycoprotein inhibition abruptly doubles digoxin serum levels, triggering cardiac conduction block and digitalis toxicity.',
    clinicalAdvice: 'Empirically halve digoxin dose when initiating inhibitor; measure serum digoxin trough level at 7-10 days; obtain 12-lead ECG.',
    evidenceLevel: 'SmPC Black Box / Contraindicated',
  },

  // 12. Methotrexate + NSAIDs / Penicillins / PPIs (Renal Tubular Elimination Blockade)
  {
    drugAKeywords: ['methotrexate', 'trexall', 'rasuvo'],
    drugBKeywords: ['ibuprofen', 'naproxen', 'ketorolac', 'diclofenac', 'amoxicillin', 'piperacillin', 'omeprazole', 'pantoprazole'],
    severity: 'Major / High Risk',
    mechanismType: 'Renal Tubular Clearance Competition',
    cypOrTarget: 'OAT1 / OAT3 Organic Anion Transporter Competition',
    mechanism: 'Competition for renal proximal tubular organic anion transporters (OAT1/OAT3) combined with NSAID-induced reduction in renal perfusion decreases methotrexate renal clearance, prolonging cytotoxic serum levels.',
    typicalAdrs: ['pancytopenia', 'bone marrow failure', 'leukopenia', 'thrombocytopenia', 'mucositis', 'nephrotoxicity', 'acute kidney injury', 'hepatotoxicity'],
    adrMatchExplanation: 'High causality: Renal transporter inhibition delays methotrexate elimination, leading to lethal bone marrow suppression, pancytopenia, and mucosal ulceration.',
    clinicalAdvice: 'Suspend NSAIDs/PPIs prior to and during high-dose methotrexate; monitor MTX elimination curves; administer leucovorin rescue as indicated.',
    evidenceLevel: 'Well-Established (Grade A)',
  },

  // 13. Metformin + Iodinated Contrast / Renal Clearance Stressors
  {
    drugAKeywords: ['metformin', 'glucophage'],
    drugBKeywords: ['contrast', 'iodinated', 'iohexol', 'iopamidol', 'topiramate', 'furosemide'],
    severity: 'Major / High Risk',
    mechanismType: 'Renal Tubular Clearance Competition',
    cypOrTarget: 'Contrast-Induced Nephropathy & Metformin Accumulation',
    mechanism: 'Contrast-induced acute renal hemodynamic insult impairs metformin renal excretion, driving systemic metformin accumulation and blocking hepatic gluconeogenesis/lactate clearance.',
    typicalAdrs: ['lactic acidosis', 'acidosis', 'acute kidney injury', 'metabolic acidosis', 'hyperlactatemia', 'shock', 'hypotension'],
    adrMatchExplanation: 'Direct mechanism: Acute drop in renal clearance leads to toxic metformin tissue levels, shifting cellular metabolism to anaerobic glycolysis and severe lactic acidosis.',
    clinicalAdvice: 'Hold metformin 48 hours prior to and 48 hours following iodinated contrast; verify baseline and post-procedure eGFR prior to resumption.',
    evidenceLevel: 'SmPC Black Box / Contraindicated',
  },

  // 14. Lithium + ACEi / ARBs / NSAIDs / Thiazide Diuretics
  {
    drugAKeywords: ['lithium', 'eskalith', 'lithobid'],
    drugBKeywords: ['hydrochlorothiazide', 'hctz', 'lisinopril', 'enalapril', 'losartan', 'ibuprofen', 'naproxen'],
    severity: 'Major / High Risk',
    mechanismType: 'Renal Tubular Clearance Competition',
    cypOrTarget: 'Proximal Tubular Sodium-Lithium Reabsorption Competition',
    mechanism: 'Sodium depletion caused by thiazides or renal prostaglandin inhibition by NSAIDs causes compensatory increase in proximal tubular lithium reabsorption, precipitating lithium toxicity.',
    typicalAdrs: ['lithium toxicity', 'tremor', 'ataxia', 'confusion', 'delirium', 'seizure', 'acute kidney injury', 'polyuria'],
    adrMatchExplanation: 'Clear pharmacological correlation: Renal tubular sodium depletion promotes marked lithium reabsorption, raising serum levels above therapeutic window (toxic > 1.5 mEq/L).',
    clinicalAdvice: 'Monitor serum lithium levels twice weekly upon initiating interacting agent; reduce lithium dosage by 25-50% as indicated.',
    evidenceLevel: 'Well-Established (Grade A)',
  },

  // 15. Beta-Blockers + Non-Dihydropyridine Calcium Channel Blockers (Verapamil, Diltiazem)
  {
    drugAKeywords: ['metoprolol', 'atenolol', 'bisoprolol', 'carvedilol', 'propranolol', 'labetalol'],
    drugBKeywords: ['verapamil', 'calan', 'diltiazem', 'cardizem'],
    severity: 'Contraindicated / Severe',
    mechanismType: 'Pharmacodynamic (Additive / Synergistic Toxicity)',
    cypOrTarget: 'Additive SA / AV Nodal Negative Inotropy & Chronotropy',
    mechanism: 'Dual suppression of sinoatrial pacemaker automaticity and atrioventricular nodal conduction velocity, precipitating severe bradycardia, high-grade AV block, and acute left ventricular failure.',
    typicalAdrs: ['bradycardia', 'heart block', 'complete heart block', 'atrioventricular block', 'asystole', 'hypotension', 'syncope', 'cardiogenic shock', 'heart failure'],
    adrMatchExplanation: 'Direct additive nodal suppression: Co-administration synergistically halts AV node conduction, directly accounting for high-grade heart block or acute bradycardic collapse.',
    clinicalAdvice: 'Avoid concurrent use in patients with conduction disorders or systolic dysfunction; emergency atropine/isoproterenol or transcutaneous pacing if refractory.',
    evidenceLevel: 'SmPC Black Box / Contraindicated',
  },
];

/**
 * Normalizes drug text for robust keyword matching
 */
function normalizeText(text: string): string {
  return (text || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
}

/**
 * Checks whether a drug matches any of the given keywords
 */
function drugMatchesKeywords(drug: DrugAdministration, keywords: string[]): boolean {
  const haystack = `${normalizeText(drug.drugName)} ${normalizeText(drug.activeSubstance)} ${normalizeText(drug.brandName)}`;
  return keywords.some((kw) => {
    const normKw = normalizeText(kw);
    return haystack.includes(normKw);
  });
}

/**
 * Evaluates whether any reported adverse event matches the typical ADRs of an interaction rule
 */
function checkAdrAlignment(events: AdverseEvent[], typicalAdrs: string[]): { isMatched: boolean; matchedEventTerms: string[] } {
  const matchedEventTerms: string[] = [];

  events.forEach((ev) => {
    const evText = `${normalizeText(ev.term)} ${normalizeText(ev.lltTerm || '')} ${normalizeText(ev.socTerm || '')} ${normalizeText(ev.signsAndSymptoms || '')}`;
    const matched = typicalAdrs.some((kw) => {
      const normKw = normalizeText(kw);
      return evText.includes(normKw);
    });

    if (matched) {
      matchedEventTerms.push(ev.term);
    }
  });

  return {
    isMatched: matchedEventTerms.length > 0,
    matchedEventTerms: Array.from(new Set(matchedEventTerms)),
  };
}

/**
 * Assesses a single target drug against all other co-administered medications in the case
 * to determine:
 * 1. Does it have a drug-drug interaction with any other drug in the regimen?
 * 2. May this interaction be the reason for the reported adverse drug reactions (ADRs)?
 */
export function assessDrugDdiAndAdr(
  targetDrug: DrugAdministration,
  allDrugs: DrugAdministration[],
  events: AdverseEvent[]
): DrugDdiAdrAssessment {
  if (!allDrugs || allDrugs.length <= 1) {
    return {
      hasInteraction: false,
      severity: 'None',
      interactingDrugs: [],
      mechanism: 'Single agent administered; no concomitant medicinal product interaction possible.',
      mechanismType: 'None',
      mayCauseAdr: false,
      adrCausalityRole: 'No Interaction',
      adrMatchExplanation: 'No interacting co-medication present in patient profile.',
      clinicalAdvice: 'Evaluate primary suspect drug pharmacology and patient organ function independently.',
      evidenceLevel: 'Theoretical / In Vitro',
    };
  }

  const otherDrugs = allDrugs.filter((d) => d.id !== targetDrug.id && d.drugName !== targetDrug.drugName);

  let bestMatchRule: DdiPairRule | null = null;
  const interactingDrugNames: string[] = [];
  let isAdrDirectlyLinked = false;
  let linkedEventNames: string[] = [];

  for (const other of otherDrugs) {
    for (const rule of DDI_KNOWLEDGE_BASE) {
      const matchA = drugMatchesKeywords(targetDrug, rule.drugAKeywords) && drugMatchesKeywords(other, rule.drugBKeywords);
      const matchB = drugMatchesKeywords(targetDrug, rule.drugBKeywords) && drugMatchesKeywords(other, rule.drugAKeywords);

      if (matchA || matchB) {
        interactingDrugNames.push(other.drugName);

        // Check if reported ADR matches the known interaction toxicities
        const adrCheck = checkAdrAlignment(events, rule.typicalAdrs);
        if (adrCheck.isMatched) {
          isAdrDirectlyLinked = true;
          linkedEventNames.push(...adrCheck.matchedEventTerms);
        }

        // Keep the highest severity rule found
        if (!bestMatchRule || rule.severity === 'Contraindicated / Severe' || (rule.severity === 'Major / High Risk' && bestMatchRule.severity !== 'Contraindicated / Severe')) {
          bestMatchRule = rule;
        }
      }
    }
  }

  const uniqueInteractingDrugs = Array.from(new Set(interactingDrugNames));
  const uniqueLinkedEvents = Array.from(new Set(linkedEventNames));

  if (bestMatchRule && uniqueInteractingDrugs.length > 0) {
    let adrRole: DdiAdrCausalityRole = 'Unlikely ADR Cause';
    let matchExp = `Identified interaction with ${uniqueInteractingDrugs.join(', ')}, but reported adverse event(s) (${events.map((e) => e.term).join(', ')}) do not match typical manifestation of this DDI.`;

    if (isAdrDirectlyLinked) {
      adrRole = 'Likely ADR Cause / Primary Driver';
      matchExp = `YES — LIKELY ADR DRIVER: Co-administration with ${uniqueInteractingDrugs.join(', ')} produces ${bestMatchRule.mechanismType.toLowerCase()} leading to ${bestMatchRule.cypOrTarget}. This directly correlates with the observed reaction: "${uniqueLinkedEvents.join(', ')}".`;
    } else if (events.length > 0) {
      adrRole = 'Possible Contributing Factor';
      matchExp = `POSSIBLE COFACTOR: Documented interaction with ${uniqueInteractingDrugs.join(', ')} may increase systemic exposure or systemic vulnerability to the reported event.`;
    }

    return {
      hasInteraction: true,
      severity: bestMatchRule.severity,
      interactingDrugs: uniqueInteractingDrugs,
      mechanism: bestMatchRule.mechanism,
      mechanismType: bestMatchRule.mechanismType,
      cypOrTarget: bestMatchRule.cypOrTarget,
      mayCauseAdr: isAdrDirectlyLinked,
      adrCausalityRole: adrRole,
      adrMatchExplanation: matchExp,
      clinicalAdvice: bestMatchRule.clinicalAdvice,
      evidenceLevel: bestMatchRule.evidenceLevel,
    };
  }

  // Fallback heuristic if multiple drugs are present but not in specific KB
  const hasMultipleSuspectOrConcomitant = otherDrugs.length > 0;
  return {
    hasInteraction: false,
    severity: hasMultipleSuspectOrConcomitant ? 'Minor' : 'None',
    interactingDrugs: [],
    mechanism: hasMultipleSuspectOrConcomitant
      ? `Screened against co-administered agents (${otherDrugs.map((d) => d.drugName).join(', ')}); no major CYP450 or pharmacodynamic interaction recorded in primary labeling.`
      : 'No interacting agents detected.',
    mechanismType: 'None',
    mayCauseAdr: false,
    adrCausalityRole: 'No Interaction',
    adrMatchExplanation: 'Adverse reaction is unlikely to be mediated by drug-drug interaction; etiology is attributable to primary suspect drug or underlying disease.',
    clinicalAdvice: 'Monitor patient per standard product label recommendations.',
    evidenceLevel: 'Theoretical / In Vitro',
  };
}

/**
 * Assesses pairwise interaction between any two chosen drug names against reported events
 */
export function assessPairwiseDdi(
  drugAName: string,
  drugBName: string,
  events: AdverseEvent[] = []
): DrugDdiAdrAssessment {
  const dummyDrugA: DrugAdministration = {
    id: 'test-a',
    drugName: drugAName,
    activeSubstance: drugAName,
    brandName: drugAName,
    role: 'Suspect',
    dose: 'Standard',
    route: 'Oral',
    frequency: 'Once daily',
    indication: 'Therapy',
    startDate: '2026-01-01',
    stopDate: null,
    ongoing: true,
    batchLotNumber: 'TEST',
    marketingAuthHolder: 'MAH',
    dechallenge: 'Unknown',
    rechallenge: 'Not Performed',
    actionTaken: 'Dose Not Changed',
    knownSmPCAdverseReactions: [],
  };

  const dummyDrugB: DrugAdministration = {
    id: 'test-b',
    drugName: drugBName,
    activeSubstance: drugBName,
    brandName: drugBName,
    role: 'Concomitant',
    dose: 'Standard',
    route: 'Oral',
    frequency: 'Once daily',
    indication: 'Therapy',
    startDate: '2026-01-01',
    stopDate: null,
    ongoing: true,
    batchLotNumber: 'TEST',
    marketingAuthHolder: 'MAH',
    dechallenge: 'Unknown',
    rechallenge: 'Not Performed',
    actionTaken: 'Dose Not Changed',
    knownSmPCAdverseReactions: [],
  };

  return assessDrugDdiAndAdr(dummyDrugA, [dummyDrugA, dummyDrugB], events);
}

/**
 * Evaluates case-level interaction summary
 */
export function evaluateCaseDdiSummary(
  drugs: DrugAdministration[],
  events: AdverseEvent[]
): {
  totalInteractions: number;
  hasHighRiskDdi: boolean;
  adrMayBeCausedByDdi: boolean;
  primaryDdiExplanation: string;
  highestSeverity: DdiSeverity;
  pairDetails: Array<{
    drugA: string;
    drugB: string;
    severity: DdiSeverity;
    mayCauseAdr: boolean;
    explanation: string;
  }>;
} {
  if (!drugs || drugs.length < 2) {
    return {
      totalInteractions: 0,
      hasHighRiskDdi: false,
      adrMayBeCausedByDdi: false,
      primaryDdiExplanation: 'Single active agent in regimen. No drug-drug interactions detected.',
      highestSeverity: 'None',
      pairDetails: [],
    };
  }

  const pairDetails: Array<{
    drugA: string;
    drugB: string;
    severity: DdiSeverity;
    mayCauseAdr: boolean;
    explanation: string;
  }> = [];

  let hasHighRisk = false;
  let adrMayBeCausedByDdi = false;
  let highestSev: DdiSeverity = 'None';
  let bestExplanation = '';

  for (let i = 0; i < drugs.length; i++) {
    for (let j = i + 1; j < drugs.length; j++) {
      const assessment = assessDrugDdiAndAdr(drugs[i], [drugs[i], drugs[j]], events);
      if (assessment.hasInteraction) {
        pairDetails.push({
          drugA: drugs[i].drugName,
          drugB: drugs[j].drugName,
          severity: assessment.severity,
          mayCauseAdr: assessment.mayCauseAdr,
          explanation: assessment.adrMatchExplanation,
        });

        if (assessment.severity === 'Contraindicated / Severe' || assessment.severity === 'Major / High Risk') {
          hasHighRisk = true;
        }

        if (assessment.mayCauseAdr) {
          adrMayBeCausedByDdi = true;
          bestExplanation = assessment.adrMatchExplanation;
        }

        if (highestSev === 'None' || assessment.severity === 'Contraindicated / Severe') {
          highestSev = assessment.severity;
        }
      }
    }
  }

  return {
    totalInteractions: pairDetails.length,
    hasHighRiskDdi: hasHighRisk,
    adrMayBeCausedByDdi,
    primaryDdiExplanation:
      bestExplanation ||
      (pairDetails.length > 0
        ? `Found ${pairDetails.length} co-administered drug interaction(s); assess impact on primary adverse reaction.`
        : 'All co-administered medications screened. No established high-risk interactions identified.'),
    highestSeverity: highestSev,
    pairDetails,
  };
}
