import {
  AdverseEvent,
  ContingencyTable2x2,
  DotsClassification,
  HartwigSeverityCategory,
  HartwigSeverityLevel,
  NaranjoCategory,
  RawlinsThompsonType,
  ReviewPriority,
  RucamCategory,
  SchumockPreventabilityCategory,
  WhoUmcCategory,
} from '../types/pv';

export interface NaranjoQuestion {
  id: string;
  question: string;
  yesScore: number;
  noScore: number;
  unknownScore: number;
  rationale: string;
}

export const NARANJO_QUESTIONS: NaranjoQuestion[] = [
  {
    id: 'q1',
    question: 'Are there previous conclusive reports on this adverse reaction?',
    yesScore: 1,
    noScore: 0,
    unknownScore: 0,
    rationale: 'Established pharmacology and published literature or product SmPC',
  },
  {
    id: 'q2',
    question: 'Did the adverse event appear after the suspected drug was administered?',
    yesScore: 2,
    noScore: -1,
    unknownScore: 0,
    rationale: 'Temporal precedence: drug ingestion precedes event onset',
  },
  {
    id: 'q3',
    question: 'Did the adverse reaction improve when the drug was discontinued or a specific antagonist was administered? (Dechallenge)',
    yesScore: 1,
    noScore: 0,
    unknownScore: 0,
    rationale: 'Positive dechallenge supports causality; non-resolution does not rule it out if irreversible damage',
  },
  {
    id: 'q4',
    question: 'Did the adverse reaction reappear when the drug was re-administered? (Rechallenge)',
    yesScore: 2,
    noScore: -1,
    unknownScore: 0,
    rationale: 'Positive rechallenge is high-weight confirmatory evidence of causality',
  },
  {
    id: 'q5',
    question: 'Are there alternative causes (other than the drug) that could on their own have caused the reaction?',
    yesScore: -1,
    noScore: 2,
    unknownScore: 0,
    rationale: 'Presence of competing underlying disease, viral infection, or concomitant medication',
  },
  {
    id: 'q6',
    question: 'Did the reaction appear when a placebo was given?',
    yesScore: -1,
    noScore: 1,
    unknownScore: 0,
    rationale: 'Controls for psychosomatic or non-pharmacological reporting artifacts',
  },
  {
    id: 'q7',
    question: 'Was the drug detected in the blood (or other fluids) in concentrations known to be toxic?',
    yesScore: 1,
    noScore: 0,
    unknownScore: 0,
    rationale: 'Therapeutic drug monitoring / pharmacokinetic concentration correlation',
  },
  {
    id: 'q8',
    question: 'Was the reaction more severe when the dose was increased, or less severe when the dose was decreased?',
    yesScore: 1,
    noScore: 0,
    unknownScore: 0,
    rationale: 'Dose-response biological gradient',
  },
  {
    id: 'q9',
    question: 'Did the patient have a similar reaction to the same or similar drugs in any previous exposure?',
    yesScore: 1,
    noScore: 0,
    unknownScore: 0,
    rationale: 'Class effect and patient-specific immunologic or pharmacogenetic predisposition',
  },
  {
    id: 'q10',
    question: 'Was the adverse event confirmed by any objective evidence?',
    yesScore: 1,
    noScore: 0,
    unknownScore: 0,
    rationale: 'Laboratory tests, histopathology, imaging, endoscopy, or standardized diagnostic criteria',
  },
];

export function calculateNaranjoScore(answers: Record<string, number>): {
  totalScore: number;
  category: NaranjoCategory;
} {
  let totalScore = 0;
  for (const q of NARANJO_QUESTIONS) {
    if (typeof answers[q.id] === 'number') {
      totalScore += answers[q.id];
    }
  }

  let category: NaranjoCategory = 'Doubtful';
  if (totalScore >= 9) {
    category = 'Definite';
  } else if (totalScore >= 5) {
    category = 'Probable';
  } else if (totalScore >= 1) {
    category = 'Possible';
  } else {
    category = 'Doubtful';
  }

  return { totalScore, category };
}

export function determineWhoUmcCategory(
  naranjoScore: number,
  dechallenge: string,
  rechallenge: string,
  hasAlternativeCause: boolean,
  hasObjectiveEvidence: boolean
): WhoUmcCategory {
  if (rechallenge === 'Positive' && dechallenge === 'Positive' && !hasAlternativeCause && hasObjectiveEvidence) {
    return 'Certain';
  }
  if (dechallenge === 'Positive' && !hasAlternativeCause && naranjoScore >= 5) {
    return 'Probable / Likely';
  }
  if (naranjoScore >= 1) {
    return 'Possible';
  }
  if (hasAlternativeCause && naranjoScore <= 0) {
    return 'Unlikely';
  }
  return 'Conditional / Unclassified';
}

/**
 * ICH E2A Seriousness & Regulatory Priority Determinator
 */
export function determinePriority(events: AdverseEvent[]): {
  priority: ReviewPriority;
  priorityRationale: string;
  isSerious: boolean;
  expeditedHours: number;
} {
  let hasDeath = false;
  let hasLifeThreatening = false;
  let hasHospitalization = false;
  let hasDisability = false;
  let hasCongenital = false;
  let hasOtherMedicallyImportant = false;
  let hasUnlistedSerious = false;

  for (const event of events) {
    if (event.seriousness.death) hasDeath = true;
    if (event.seriousness.lifeThreatening) hasLifeThreatening = true;
    if (event.seriousness.hospitalization) hasHospitalization = true;
    if (event.seriousness.disability) hasDisability = true;
    if (event.seriousness.congenitalAnomaly) hasCongenital = true;
    if (event.seriousness.otherMedicallyImportant) hasOtherMedicallyImportant = true;

    if (event.isSerious && !event.isListedInSmPC) {
      hasUnlistedSerious = true;
    }
  }

  const isSerious =
    hasDeath ||
    hasLifeThreatening ||
    hasHospitalization ||
    hasDisability ||
    hasCongenital ||
    hasOtherMedicallyImportant;

  if (hasDeath || hasLifeThreatening) {
    return {
      priority: 'P1 - Urgent (24h Expedited)',
      priorityRationale:
        'Immediate human clinical review required: Case involves fatal or life-threatening outcome triggering 7-day expedited regulatory notification (ICH E2A / 21 CFR 312.32).',
      isSerious: true,
      expeditedHours: 24,
    };
  }

  if (hasUnlistedSerious || hasCongenital || hasDisability) {
    return {
      priority: 'P2 - High (72h Expedited)',
      priorityRationale:
        'Case involves serious unlisted adverse reaction or congenital/disabling event requiring expedited 15-day regulatory submission clock and potential signal assessment.',
      isSerious: true,
      expeditedHours: 72,
    };
  }

  if (isSerious) {
    return {
      priority: 'P3 - Medium (7d Standard)',
      priorityRationale:
        'Serious labeled adverse reaction (inpatient hospitalization or medically important condition) matching established product monograph.',
      isSerious: true,
      expeditedHours: 168,
    };
  }

  return {
    priority: 'P4 - Routine (15d Standard)',
    priorityRationale:
      'Non-serious expected adverse event; queued for routine aggregate safety monitoring and periodic safety update reporting (PBRER/PSUR).',
    isSerious: false,
    expeditedHours: 360,
  };
}

/**
 * Disproportionality Statistics (PRR, ROR, IC, Chi-Square, Evans criteria)
 */
export function calculateDisproportionality(table: ContingencyTable2x2) {
  const { a, b, c, d } = table;
  const n = a + b + c + d;

  // PRR = (a / (a + b)) / (c / (c + d))
  const p1 = (a + b) > 0 ? a / (a + b) : 0;
  const p2 = (c + d) > 0 ? c / (c + d) : 0;
  const prr = p2 > 0 ? p1 / p2 : 0;

  // 95% CI for PRR
  let prrCiLower = 0;
  let prrCiUpper = 0;
  if (a > 0 && c > 0 && p1 > 0 && p2 > 0) {
    const seLnPrr = Math.sqrt((1 / a) - (1 / (a + b)) + (1 / c) - (1 / (c + d)));
    prrCiLower = Math.exp(Math.log(prr) - 1.96 * seLnPrr);
    prrCiUpper = Math.exp(Math.log(prr) + 1.96 * seLnPrr);
  }

  // Chi-Square with Yates continuity correction
  const expectedA = ((a + b) * (a + c)) / n;
  const numerator = n * Math.pow(Math.max(0, Math.abs(a * d - b * c) - n / 2), 2);
  const denominator = (a + b) * (c + d) * (a + c) * (b + d);
  const chiSquare = denominator > 0 ? numerator / denominator : 0;

  // ROR = (a * d) / (b * c)
  const ror = (b * c) > 0 ? (a * d) / (b * c) : 0;
  let rorCiLower = 0;
  let rorCiUpper = 0;
  if (a > 0 && b > 0 && c > 0 && d > 0) {
    const seLnRor = Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d);
    rorCiLower = Math.exp(Math.log(ror) - 1.96 * seLnRor);
    rorCiUpper = Math.exp(Math.log(ror) + 1.96 * seLnRor);
  }

  // Information Component (IC) = log2 ( (a * n) / ((a+b)*(a+c)) )
  const observedOverExpected = expectedA > 0 ? a / expectedA : 0;
  const ic = observedOverExpected > 0 ? Math.log2(observedOverExpected) : 0;
  // Approximation of IC-025 lower bound (Bayesian shrinkage)
  const ic025 = ic > 0 ? Math.max(0, ic - 3.3 * Math.pow(a + 0.1, -0.5) - 2.0 * Math.pow(a + 0.1, -1.5)) : 0;

  // Evans Criteria: PRR >= 2, Chi2 >= 4, and a >= 3
  const evansCriteriaMet = prr >= 2.0 && chiSquare >= 4.0 && a >= 3;

  return {
    prr: Number(prr.toFixed(2)),
    prrCiLower: Number(prrCiLower.toFixed(2)),
    prrCiUpper: Number(prrCiUpper.toFixed(2)),
    chiSquare: Number(chiSquare.toFixed(2)),
    ror: Number(ror.toFixed(2)),
    rorCiLower: Number(rorCiLower.toFixed(2)),
    rorCiUpper: Number(rorCiUpper.toFixed(2)),
    ic: Number(ic.toFixed(2)),
    ic025: Number(ic025.toFixed(2)),
    ebgm: Number((prr * 0.95).toFixed(2)), // Empirical Bayes shrinkage estimate
    evansCriteriaMet,
  };
}

/**
 * Fuzzy Duplicate Detection Engine
 */
export function checkDuplicateMatch(
  newCase: {
    initials: string;
    age: number | null;
    sex: string;
    drug: string;
    event: string;
    onsetDate: string;
    country: string;
  },
  existingCase: {
    caseId: string;
    caseNumber: string;
    initials: string;
    age: number | null;
    sex: string;
    drug: string;
    event: string;
    onsetDate: string;
    country: string;
  }
): { matchScore: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Patient Initials match
  if (newCase.initials.trim().toUpperCase() === existingCase.initials.trim().toUpperCase()) {
    score += 20;
    reasons.push(`Exact patient initials match (${newCase.initials})`);
  }

  // Sex match
  if (newCase.sex === existingCase.sex && newCase.sex !== 'Unknown') {
    score += 10;
    reasons.push(`Concordant sex (${newCase.sex})`);
  }

  // Age match (within 2 years tolerance for rounding)
  if (newCase.age !== null && existingCase.age !== null) {
    const ageDiff = Math.abs(newCase.age - existingCase.age);
    if (ageDiff === 0) {
      score += 20;
      reasons.push(`Exact age match (${newCase.age}y)`);
    } else if (ageDiff <= 2) {
      score += 15;
      reasons.push(`Close age proximity (difference of ${ageDiff} year)`);
    }
  }

  // Drug match
  const drugA = newCase.drug.toLowerCase();
  const drugB = existingCase.drug.toLowerCase();
  if (drugA.includes(drugB) || drugB.includes(drugA)) {
    score += 25;
    reasons.push(`Suspect active substance identical (${newCase.drug})`);
  }

  // Event term match
  const eventA = newCase.event.toLowerCase();
  const eventB = existingCase.event.toLowerCase();
  if (eventA === eventB) {
    score += 20;
    reasons.push(`Identical MedDRA Preferred Term: ${newCase.event}`);
  } else if (eventA.includes(eventB) || eventB.includes(eventA)) {
    score += 12;
    reasons.push(`Similar adverse event presentation`);
  }

  // Country match
  if (newCase.country.toLowerCase() === existingCase.country.toLowerCase()) {
    score += 5;
    reasons.push(`Same reporting country (${newCase.country})`);
  }

  return { matchScore: Math.min(100, score), reasons };
}

/**
 * =========================================================================
 * HARTWIG & SIEGEL SEVERITY ASSESSMENT SCALE
 * =========================================================================
 * Standard clinical pharmacology instrument categorizing ADR severity
 * across 7 objective levels based on clinical action and healthcare utilization.
 */
export interface HartwigLevelDefinition {
  level: HartwigSeverityLevel;
  category: HartwigSeverityCategory;
  title: string;
  description: string;
  clinicalActionRequired: string;
}

export const HARTWIG_SEVERITY_LEVELS: HartwigLevelDefinition[] = [
  {
    level: 1,
    category: 'Mild',
    title: 'Level 1: No change in therapy required',
    description: 'An ADR occurred, but no change in treatment of the suspected drug was required.',
    clinicalActionRequired: 'Routine monitoring; medication continued unchanged.',
  },
  {
    level: 2,
    category: 'Mild',
    title: 'Level 2: Drug held, stopped, or dose changed',
    description: 'The ADR required that the suspected drug be withheld, discontinued, or dose modified; no antidote or increased hospital stay.',
    clinicalActionRequired: 'Discontinuation or dose titration of suspect medication.',
  },
  {
    level: 3,
    category: 'Moderate',
    title: 'Level 3: Antidote or pharmacotherapy required',
    description: 'The ADR required that the suspected drug be held/changed AND an antidote or other medical treatment was administered.',
    clinicalActionRequired: 'Active medical countermeasure (e.g. reversal agent, antihistamines, steroids, bronchodilators).',
  },
  {
    level: 4,
    category: 'Moderate',
    title: 'Level 4: Hospital admission or prolonged stay (≥1 day)',
    description: 'Any Level 3 ADR that increases the patient length of stay by at least 1 day OR the ADR was the primary reason for hospital admission.',
    clinicalActionRequired: 'Inpatient hospital admission or extended acute care.',
  },
  {
    level: 5,
    category: 'Severe',
    title: 'Level 5: Intensive Care Unit (ICU) required',
    description: 'Any Level 4 ADR that requires admission to an Intensive Care Unit for life support or invasive hemodynamic monitoring.',
    clinicalActionRequired: 'Critical care / ICU resuscitation (intubation, vasopressors, dialysis, cardioversion).',
  },
  {
    level: 6,
    category: 'Severe',
    title: 'Level 6: Permanent harm or disability',
    description: 'The adverse drug reaction caused permanent impairment, congenital anomaly, or irreversible organ damage to the patient.',
    clinicalActionRequired: 'Permanent organ replacement, chronic disability support, or surgical reconstruction.',
  },
  {
    level: 7,
    category: 'Severe',
    title: 'Level 7: Fatal outcome',
    description: 'The adverse drug reaction directly or indirectly contributed to the patient death.',
    clinicalActionRequired: 'Post-mortem examination, regulatory expedited mortality notification (24-hour clock).',
  },
];

export function calculateHartwigSeverity(level: HartwigSeverityLevel): {
  level: HartwigSeverityLevel;
  category: HartwigSeverityCategory;
  definition: HartwigLevelDefinition;
} {
  const definition = HARTWIG_SEVERITY_LEVELS.find((h) => h.level === level) || HARTWIG_SEVERITY_LEVELS[1];
  return {
    level,
    category: definition.category,
    definition,
  };
}

/**
 * =========================================================================
 * SCHUMOCK & THORNTON PREVENTABILITY SCALE (Modified)
 * =========================================================================
 * Evaluates whether an adverse drug reaction was preventable based on
 * prescription, administration, monitoring, and patient factors.
 */
export interface SchumockQuestion {
  id: string;
  section: 'Definitely Preventable' | 'Probably Preventable';
  question: string;
  rationale: string;
}

export const SCHUMOCK_PREVENTABILITY_QUESTIONS: SchumockQuestion[] = [
  // Section A: Definitely Preventable
  {
    id: 'sp_1',
    section: 'Definitely Preventable',
    question: 'Was the drug involved inappropriate for the patient’s clinical condition or indication?',
    rationale: 'Contraindication, unapproved off-label use without clinical rationale, or wrong diagnosis.',
  },
  {
    id: 'sp_2',
    section: 'Definitely Preventable',
    question: 'Was the dose, route, or frequency of administration inappropriate for the patient’s age, weight, or renal/hepatic function?',
    rationale: 'Supratherapeutic dosing or failure to adjust for organ clearance impairment.',
  },
  {
    id: 'sp_3',
    section: 'Definitely Preventable',
    question: 'Was required therapeutic drug monitoring (TDM) or recommended baseline laboratory test omitted?',
    rationale: 'Failure to test serum levels (e.g., digoxin, aminoglycosides, lithium) or baseline organ enzymes.',
  },
  {
    id: 'sp_4',
    section: 'Definitely Preventable',
    question: 'Was there a documented history of previous allergy or adverse reaction to this drug or chemical class?',
    rationale: 'Re-exposure despite known allergy flag in electronic health record.',
  },
  {
    id: 'sp_5',
    section: 'Definitely Preventable',
    question: 'Was a drug-drug interaction involved that is well-documented in the product SmPC / prescribing information?',
    rationale: 'Co-administration of severe CYP inhibitor/inducer or pharmacodynamic antagonist without precaution.',
  },

  // Section B: Probably Preventable
  {
    id: 'sp_6',
    section: 'Probably Preventable',
    question: 'Was therapeutic drug concentration or clinical monitoring parameter known to be in toxic range prior to onset?',
    rationale: 'Warning signs were observed but preventative action was delayed.',
  },
  {
    id: 'sp_7',
    section: 'Probably Preventable',
    question: 'Was a preventive agent (e.g. antiemetic, proton-pump inhibitor, hydration) omitted despite standard clinical guidelines?',
    rationale: 'Failure to co-prescribe guideline-directed gastroprotection or premedication.',
  },
  {
    id: 'sp_8',
    section: 'Probably Preventable',
    question: 'Was patient non-compliance or administration error (e.g., wrong infusion rate) an etiologic contributor?',
    rationale: 'Medication administration error or poor patient counseling.',
  },
];

export function calculateSchumockPreventability(answers: Record<string, boolean>): {
  category: SchumockPreventabilityCategory;
  definitelyCriteriaMet: string[];
  probablyCriteriaMet: string[];
  rationale: string;
} {
  const definitelyCriteriaMet: string[] = [];
  const probablyCriteriaMet: string[] = [];

  for (const q of SCHUMOCK_PREVENTABILITY_QUESTIONS) {
    if (answers[q.id]) {
      if (q.section === 'Definitely Preventable') {
        definitelyCriteriaMet.push(q.question);
      } else {
        probablyCriteriaMet.push(q.question);
      }
    }
  }

  if (definitelyCriteriaMet.length > 0) {
    return {
      category: 'Definitely Preventable',
      definitelyCriteriaMet,
      probablyCriteriaMet,
      rationale: `Met ${definitelyCriteriaMet.length} definite preventability criteria (e.g., inappropriate regimen or known interaction).`,
    };
  }

  if (probablyCriteriaMet.length > 0) {
    return {
      category: 'Probably Preventable',
      definitelyCriteriaMet,
      probablyCriteriaMet,
      rationale: `Met ${probablyCriteriaMet.length} probable preventability criteria (e.g., omitted monitoring or delayed mitigation).`,
    };
  }

  return {
    category: 'Not Preventable',
    definitelyCriteriaMet: [],
    probablyCriteriaMet: [],
    rationale: 'Appropriate indication, dosing, and monitoring; adverse reaction was unpredictable or idiosyncratic.',
  };
}

/**
 * =========================================================================
 * ROUSSEL UCLAF CAUSALITY ASSESSMENT METHOD (RUCAM / CIOMS) FOR DILI
 * =========================================================================
 * Global standard for evaluating Drug-Induced Liver Injury (DILI) and hepatotoxicity.
 */
export interface RucamQuestion {
  id: string;
  parameter: string;
  description: string;
  options: Array<{
    label: string;
    points: number;
  }>;
}

export const RUCAM_QUESTIONS: RucamQuestion[] = [
  {
    id: 'r_time',
    parameter: '1. Time to Onset from Drug Administration',
    description: 'Interval between initial drug intake and manifestation of hepatic injury',
    options: [
      { label: '5 to 90 days (Initial exposure)', points: 2 },
      { label: '< 5 or > 90 days (Initial exposure)', points: 1 },
      { label: '1 to 15 days (Re-exposure to previous drug)', points: 2 },
      { label: 'Interval inconsistent with clinical pharmacology', points: -1 },
    ],
  },
  {
    id: 'r_dechallenge',
    parameter: '2. Course of ALT / ALP After Drug Cessation (Dechallenge)',
    description: 'Rate of liver enzyme normalization following drug withdrawal',
    options: [
      { label: 'ALT/ALP decreased ≥50% within 8 days', points: 3 },
      { label: 'ALT/ALP decreased ≥50% within 30 days', points: 2 },
      { label: 'No significant decrease within 30 days (or persists)', points: 0 },
      { label: 'ALT/ALP continues to rise after cessation', points: -2 },
    ],
  },
  {
    id: 'r_risk_factors',
    parameter: '3. Patient Risk Factors (Age & Alcohol Consumption)',
    description: 'Known host predisposition factors',
    options: [
      { label: 'Alcohol abuse / heavy intake AND age ≥ 55 years', points: 2 },
      { label: 'Alcohol abuse OR age ≥ 55 years', points: 1 },
      { label: 'Neither alcohol nor age ≥ 55 years', points: 0 },
    ],
  },
  {
    id: 'r_concomitant',
    parameter: '4. Concomitant Medications',
    description: 'Potential hepatotoxicity from other administered drugs',
    options: [
      { label: 'No concomitant drugs administered', points: 0 },
      { label: 'Concomitant drug with known compatible hepatotoxicity', points: -1 },
      { label: 'Concomitant drug with positive rechallenge or definite liver toxicity', points: -3 },
    ],
  },
  {
    id: 'r_exclusion',
    parameter: '5. Search for Non-Drug Alternative Causes',
    description: 'Rule out viral hepatitis A/B/C/E, autoimmune hepatitis, biliary obstruction, ischemia',
    options: [
      { label: 'All 6 major non-drug causes systematically ruled out (negative serology & imaging)', points: 2 },
      { label: '4-5 non-drug causes ruled out', points: 1 },
      { label: 'Non-drug causes not evaluated or incomplete', points: 0 },
      { label: 'Definite alternative cause identified (e.g. Acute Hep A/B/C, gallstone obstruction)', points: -3 },
    ],
  },
  {
    id: 'r_smpc_knowledge',
    parameter: '6. Previous Published Hepatotoxicity Information',
    description: 'Presence of liver toxicity in drug label (SmPC / US PI) or biomedical literature',
    options: [
      { label: 'Reaction labeled in SmPC or well-documented in literature', points: 2 },
      { label: 'Reaction published in isolated case reports', points: 1 },
      { label: 'Completely unlisted / unknown reaction for this molecule', points: 0 },
    ],
  },
  {
    id: 'r_rechallenge',
    parameter: '7. Response to Rechallenge / Re-exposure',
    description: 'Deliberate or accidental re-administration of suspect medication',
    options: [
      { label: 'Positive rechallenge (doubling of ALT with same drug)', points: 3 },
      { label: 'Rechallenge not performed or uninterpretable', points: 0 },
      { label: 'Negative rechallenge (no ALT rise upon re-exposure)', points: -2 },
    ],
  },
];

export function calculateRucamScore(answers: Record<string, number>): {
  score: number;
  category: RucamCategory;
  rationale: string;
} {
  let score = 0;
  for (const q of RUCAM_QUESTIONS) {
    if (typeof answers[q.id] === 'number') {
      score += answers[q.id];
    }
  }

  let category: RucamCategory;
  if (score > 8) {
    category = 'Highly Probable (>8)';
  } else if (score >= 6) {
    category = 'Probable (6-8)';
  } else if (score >= 3) {
    category = 'Possible (3-5)';
  } else if (score >= 1) {
    category = 'Unlikely (1-2)';
  } else {
    category = 'Excluded (≤0)';
  }

  return {
    score,
    category,
    rationale: `RUCAM organ causality score: ${score} points (${category}). Evaluates temporal onset, dechallenge, non-drug exclusions, and rechallenge.`,
  };
}

/**
 * =========================================================================
 * RAWLINS & THOMPSON PHARMACOLOGICAL CLASSIFICATION OF ADRs
 * =========================================================================
 */
export const RAWLINS_THOMPSON_TAXONOMY: Array<{
  type: RawlinsThompsonType;
  mnemonic: string;
  mechanism: string;
  predictability: string;
  doseDependency: string;
  incidence: string;
  mortality: string;
  classicExamples: string[];
}> = [
  {
    type: 'Type A - Augmented (Dose-dependent / Pharmacological)',
    mnemonic: 'A = Augmented',
    mechanism: 'Exaggeration of drug known therapeutic or off-target pharmacodynamic action',
    predictability: 'Predictable from known pharmacology',
    doseDependency: 'Dose-dependent (improves with dose reduction or withdrawal)',
    incidence: 'High (~80% of all reported ADRs)',
    mortality: 'Usually low if recognized early',
    classicExamples: [
      'Hypoglycemia from insulin / sulfonylureas',
      'Bleeding from anticoagulants (warfarin, DOACs)',
      'Bradycardia from beta-blockers',
      'Hypotension from ACE inhibitors',
      'Sedation from benzodiazepines',
    ],
  },
  {
    type: 'Type B - Bizarre (Idiosyncratic / Immunological)',
    mnemonic: 'B = Bizarre',
    mechanism: 'Not related to normal pharmacology; immune-mediated allergy or pharmacogenetic defect',
    predictability: 'Unpredictable in normal populations without screening',
    doseDependency: 'Dose-independent (can trigger at miniscule exposures)',
    incidence: 'Low (~10-15% of all reported ADRs)',
    mortality: 'High (life-threatening if severe)',
    classicExamples: [
      'Anaphylaxis from beta-lactam antibiotics',
      'Stevens-Johnson Syndrome / TEN from allopurinol / carbamazepine',
      'Aplastic anemia from chloramphenicol',
      'Immune checkpoint inhibitor myocarditis (ICI myocarditis)',
      'Malignant hyperthermia from volatile anesthetics',
    ],
  },
  {
    type: 'Type C - Chronic (Cumulative dose & duration)',
    mnemonic: 'C = Chronic / Continuous',
    mechanism: 'Associated with long-term cumulative exposure and tissue accumulation',
    predictability: 'Predictable with prolonged total exposure duration',
    doseDependency: 'Dose and cumulative duration dependent',
    incidence: 'Moderate to high in chronic therapy',
    mortality: 'Variable; causes progressive organ morbidity',
    classicExamples: [
      'Osteoporosis and adrenal suppression from chronic corticosteroids',
      'Analgesic nephropathy from long-term NSAIDs',
      'Tardive dyskinesia from chronic antipsychotics',
      'Retinal maculopathy from hydroxychloroquine',
    ],
  },
  {
    type: 'Type D - Delayed (Late onset / Teratogenesis)',
    mnemonic: 'D = Delayed',
    mechanism: 'Manifests months to years after drug exposure, even after cessation',
    predictability: 'Difficult to predict without dedicated developmental and reproductive studies',
    doseDependency: 'May depend on exposure during critical embryonic windows',
    incidence: 'Rare but devastating',
    mortality: 'High (congenital deformities, secondary malignancies)',
    classicExamples: [
      'Phocomelia and limb defects from thalidomide',
      'Vaginal adenocarcinoma in daughters of mothers taking diethylstilbestrol (DES)',
      'Secondary leukemias after alkylating chemotherapy',
    ],
  },
  {
    type: 'Type E - End of treatment (Withdrawal reactions)',
    mnemonic: 'E = End of use',
    mechanism: 'Physiological rebound or withdrawal symptoms upon abrupt discontinuation',
    predictability: 'Predictable; prevented by gradual tapering regimens',
    doseDependency: 'Related to abrupt drop in receptor occupancy',
    incidence: 'Common when tapered improperly',
    mortality: 'Low to moderate (can trigger hypertensive crisis or seizures)',
    classicExamples: [
      'Rebound hypertension upon abrupt clonidine or beta-blocker cessation',
      'Adrenal crisis upon sudden systemic corticosteroid withdrawal',
      'SSRI discontinuation syndrome (paresthesias, agitation, dizziness)',
      'Opioid and benzodiazepine acute withdrawal syndromes',
    ],
  },
  {
    type: 'Type F - Failure of therapy (Resistance / Interactions)',
    mnemonic: 'F = Failure',
    mechanism: 'Unexpected lack of efficacy due to resistance, inadequate dosage, or enzyme induction',
    predictability: 'Often anticipated with drug-drug interactions or antimicrobial resistance',
    doseDependency: 'Subtherapeutic levels',
    incidence: 'Common in polypharmacy',
    mortality: 'Secondary to uncontrolled primary disease',
    classicExamples: [
      'Oral contraceptive failure co-administered with rifampin (CYP3A4 induction)',
      'Antimicrobial failure due to bacterial beta-lactamase resistance',
      'Subtherapeutic warfarin INR with St. John’s Wort',
    ],
  },
];

