import { BenchmarkPerformanceMetric } from '../types/pv';

export interface BenchmarkTestCase {
  id: string;
  sourceDocId: string;
  goldStandardSeriousness: boolean;
  predictedSeriousness: boolean;
  seriousnessConcordant: boolean;
  goldStandardDuplicateOf: string | null;
  predictedDuplicateOf: string | null;
  duplicateConcordant: boolean;
  goldStandardPriority: 'P1' | 'P2' | 'P3' | 'P4';
  predictedPriority: 'P1' | 'P2' | 'P3' | 'P4';
  priorityConcordant: boolean;
  extractedEntitiesGroundTruth: number;
  extractedEntitiesPredicted: number;
  extractionAccuracy: number;
  narrativeSnippet: string;
  knownLimitationDisclosed: string;
}

export const BENCHMARK_PERFORMANCE_METRICS: BenchmarkPerformanceMetric[] = [
  {
    domain: 'Case Extraction',
    accuracy: 98.4,
    sensitivityRecall: 97.9,
    specificity: 98.9,
    precision: 98.8,
    f1Score: 98.3,
    totalEvaluatedCases: 250,
    concordantCases: 246,
    discordantCases: 4,
    validationCorpusName: 'CIOMS-I / MedWatch 3500A Gold-Standard Validation Corpus (v2.4)',
    notes:
      'Field-level entity extraction for suspect drugs, MedDRA PT coding, lot numbers, and lab titers. Edge-case discordance arose from handwritten clinical abbreviations.',
  },
  {
    domain: 'Seriousness Classification',
    accuracy: 99.2,
    sensitivityRecall: 99.6,
    specificity: 98.8,
    precision: 98.9,
    f1Score: 99.2,
    totalEvaluatedCases: 250,
    concordantCases: 248,
    discordantCases: 2,
    validationCorpusName: 'ICH E2A Regulatory Criteria Reference Set',
    notes:
      '100% sensitivity on Death and Life-Threatening criteria (zero false negatives). Slight discordance on subjective "Other Medically Important" classifications requiring human clinical sign-off.',
  },
  {
    domain: 'Duplicate Detection',
    accuracy: 96.8,
    sensitivityRecall: 97.2,
    specificity: 96.5,
    precision: 95.4,
    f1Score: 96.3,
    totalEvaluatedCases: 250,
    concordantCases: 242,
    discordantCases: 8,
    validationCorpusName: 'FAERS / EudraVigilance Inter-reporter Multi-source Duplicate Benchmark',
    notes:
      'Multi-factor fuzzy matching on patient demographics, drug names, and event timing. Identified 42 confirmed duplicate pairs with high confidence; flagged 3 ambiguous border cases for manual reviewer arbitration.',
  },
  {
    domain: 'Signal Prioritization',
    accuracy: 97.6,
    sensitivityRecall: 96.5,
    specificity: 98.2,
    precision: 97.1,
    f1Score: 96.8,
    totalEvaluatedCases: 250,
    concordantCases: 244,
    discordantCases: 6,
    validationCorpusName: 'FDA Drug Safety Communications & PRAC Signal Outcomes (2023-2025)',
    notes:
      'Stratified triage priority (P1 24h to P4 Routine) aligned with Evans disproportionality criteria and SmPC label unlisted status. Fully preserves human oversight boundaries.',
  },
];

export const BENCHMARK_TEST_CASES: BenchmarkTestCase[] = [
  {
    id: 'BM-REF-001',
    sourceDocId: 'MW-3500A-9012',
    goldStandardSeriousness: true,
    predictedSeriousness: true,
    seriousnessConcordant: true,
    goldStandardDuplicateOf: null,
    predictedDuplicateOf: null,
    duplicateConcordant: true,
    goldStandardPriority: 'P1',
    predictedPriority: 'P1',
    priorityConcordant: true,
    extractedEntitiesGroundTruth: 14,
    extractedEntitiesPredicted: 14,
    extractionAccuracy: 100,
    narrativeSnippet: 'A 58yo M receiving pembrolizumab developed acute dyspnea, cardiogenic shock, and troponin I of 18.4 ng/mL within 14 days of cycle 2.',
    knownLimitationDisclosed: 'Cardiomyopathy vs myocarditis differentiation requires endomyocardial biopsy or cardiac MRI which was pending at time of report.',
  },
  {
    id: 'BM-REF-002',
    sourceDocId: 'CIOMS-EU-4419',
    goldStandardSeriousness: true,
    predictedSeriousness: true,
    seriousnessConcordant: true,
    goldStandardDuplicateOf: 'CIOMS-EU-4402',
    predictedDuplicateOf: 'CIOMS-EU-4402',
    duplicateConcordant: true,
    goldStandardPriority: 'P2',
    predictedPriority: 'P2',
    priorityConcordant: true,
    extractedEntitiesGroundTruth: 12,
    extractedEntitiesPredicted: 12,
    extractionAccuracy: 100,
    narrativeSnippet: '49yo F on semaglutide 1.0mg SC weekly experienced severe intractable vomiting, postprandial fullness, and was diagnosed with severe gastroparesis.',
    knownLimitationDisclosed: 'Duplicate detected from two separate hospital networks with 3-day discrepancy in recorded onset date.',
  },
  {
    id: 'BM-REF-003',
    sourceDocId: 'LIT-NEJM-8821',
    goldStandardSeriousness: true,
    predictedSeriousness: true,
    seriousnessConcordant: true,
    goldStandardDuplicateOf: null,
    predictedDuplicateOf: null,
    duplicateConcordant: true,
    goldStandardPriority: 'P1',
    predictedPriority: 'P1',
    priorityConcordant: true,
    extractedEntitiesGroundTruth: 18,
    extractedEntitiesPredicted: 17,
    extractionAccuracy: 94.4,
    narrativeSnippet: '34yo F prescribed lamotrigine for bipolar disorder developed targetoid lesions covering 35% BSA, mucosal sloughing, Nikolsky sign positive (TEN).',
    knownLimitationDisclosed: 'Rapid titration rate noted in narrative was parsed as concomitant instruction rather than dosing error; human PV reviewer corrected.',
  },
  {
    id: 'BM-REF-004',
    sourceDocId: 'MW-3500-1109',
    goldStandardSeriousness: true,
    predictedSeriousness: true,
    seriousnessConcordant: true,
    goldStandardDuplicateOf: null,
    predictedDuplicateOf: null,
    duplicateConcordant: true,
    goldStandardPriority: 'P3',
    predictedPriority: 'P3',
    priorityConcordant: true,
    extractedEntitiesGroundTruth: 11,
    extractedEntitiesPredicted: 11,
    extractionAccuracy: 100,
    narrativeSnippet: '72yo M taking rivaroxaban 20mg daily together with over-the-counter naproxen presented with melena and drop in hemoglobin from 14.1 to 8.9 g/dL.',
    knownLimitationDisclosed: 'Labeled bleeding risk exacerbated by drug-drug interaction; requires warning regarding concurrent NSAID usage in summary.',
  },
  {
    id: 'BM-REF-005',
    sourceDocId: 'SPON-PAT-0341',
    goldStandardSeriousness: false,
    predictedSeriousness: false,
    seriousnessConcordant: true,
    goldStandardDuplicateOf: null,
    predictedDuplicateOf: null,
    duplicateConcordant: true,
    goldStandardPriority: 'P4',
    predictedPriority: 'P4',
    priorityConcordant: true,
    extractedEntitiesGroundTruth: 8,
    extractedEntitiesPredicted: 8,
    extractionAccuracy: 100,
    narrativeSnippet: '61yo M on atorvastatin 40mg noticed bilateral calf soreness and stiffness after 3 months. Creatine kinase was within normal limits. Symptoms subsided upon dechallenge.',
    knownLimitationDisclosed: 'Mild known ADR; categorized as routine P4. No hospitalization or functional impairment documented.',
  },
  {
    id: 'BM-REF-006',
    sourceDocId: 'REG-FDA-7712',
    goldStandardSeriousness: true,
    predictedSeriousness: true,
    seriousnessConcordant: true,
    goldStandardDuplicateOf: null,
    predictedDuplicateOf: null,
    duplicateConcordant: true,
    goldStandardPriority: 'P2',
    predictedPriority: 'P2',
    priorityConcordant: true,
    extractedEntitiesGroundTruth: 15,
    extractedEntitiesPredicted: 14,
    extractionAccuracy: 93.3,
    narrativeSnippet: '28yo pregnant female (2nd trimester) on levetiracetam experienced intrauterine growth restriction and transient neonatal hypotonia.',
    knownLimitationDisclosed: 'Pregnancy registry case: outcome on infant requires 6-month pediatric follow-up before definitive causality adjudication.',
  },
];
