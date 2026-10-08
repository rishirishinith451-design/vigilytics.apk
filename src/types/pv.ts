/**
 * AegisPV Pharmacovigilance & Pega Workflow Domain Model
 * Complies with ICH E2A / E2B(R3), CIOMS I, and MedDRA classification standards.
 */

export type ReportType =
  | 'Spontaneous HCP'
  | 'Spontaneous Consumer/Patient'
  | 'Clinical Trial SAE'
  | 'Post-Marketing Registry'
  | 'Scientific Literature'
  | 'Regulatory Authority';

export type AgeGroup =
  | 'Neonate (0-27d)'
  | 'Infant (28d-23m)'
  | 'Child (2-11y)'
  | 'Adolescent (12-17y)'
  | 'Adult (18-64y)'
  | 'Elderly (65+y)'
  | 'Unknown';

export type Sex = 'Male' | 'Female' | 'Unknown';

export type PregnancyStatus =
  | 'Not Applicable'
  | 'First Trimester'
  | 'Second Trimester'
  | 'Third Trimester'
  | 'Post-Partum'
  | 'Unknown';

export interface MedicalCondition {
  condition: string;
  meddraCode?: string;
  onsetDate?: string;
  status: 'Active' | 'Resolved' | 'Unknown';
  isRiskFactor: boolean;
}

export interface Patient {
  id: string;
  initials: string;
  age: number | null;
  ageGroup: AgeGroup;
  sex: Sex;
  pregnancyStatus: PregnancyStatus;
  weightKg: number | null;
  medicalHistory: MedicalCondition[];
  allergies: string[];
  baselineOrganFunction: {
    renal: string;
    hepatic: string;
  };
}

export type DrugRole = 'Suspect' | 'Concomitant' | 'Interacting';
export type DechallengeStatus = 'Positive' | 'Negative' | 'Not Applicable' | 'Unknown';
export type RechallengeStatus = 'Positive' | 'Negative' | 'Not Performed' | 'Not Applicable' | 'Unknown';
export type ActionTaken =
  | 'Drug Withdrawn'
  | 'Dose Reduced'
  | 'Dose Increased'
  | 'Dose Not Changed'
  | 'Unknown';

export interface DrugAdministration {
  id: string;
  drugName: string;
  activeSubstance: string;
  brandName: string;
  role: DrugRole;
  dose: string;
  route: string;
  frequency: string;
  durationOfTherapy?: string;
  indication: string;
  startDate: string;
  stopDate: string | null;
  ongoing: boolean;
  batchLotNumber: string;
  marketingAuthHolder: string;
  dechallenge: DechallengeStatus;
  rechallenge: RechallengeStatus;
  actionTaken: ActionTaken;
  knownSmPCAdverseReactions: string[];
  ddiAssessment?: DrugDdiAdrAssessment;
}

export type EventOutcome =
  | 'Recovered / Resolved'
  | 'Recovering / Resolving'
  | 'Not Recovered / Not Resolved'
  | 'Recovered with Sequelae'
  | 'Fatal'
  | 'Unknown';

export interface SeriousnessCriteria {
  death: boolean;
  lifeThreatening: boolean;
  hospitalization: boolean;
  disability: boolean;
  congenitalAnomaly: boolean;
  otherMedicallyImportant: boolean;
}

export interface AdverseEvent {
  id: string;
  term: string; // MedDRA Preferred Term (PT) / Suspected adverse reaction
  lltTerm: string; // Lowest Level Term
  socTerm: string; // System Organ Class
  signsAndSymptoms?: string; // Signs and symptoms
  onsetDate: string; // Date/time of onset
  eventDuration?: string; // Duration of adverse reaction
  resolutionDate: string | null;
  outcome: EventOutcome;
  seriousness: SeriousnessCriteria;
  isSerious: boolean;
  isListedInSmPC: boolean; // Listed vs Unlisted in Product Monograph
  smPCDetails: string;
  severityGrade: 'Mild' | 'Moderate' | 'Severe' | 'Life-Threatening';
}

export interface VitalSigns {
  bloodPressure?: string;
  heartRate?: string;
  respiratoryRate?: string;
  temperature?: string;
  oxygenSaturation?: string;
  recordedDate?: string;
}

export interface DiagnosticFinding {
  id: string;
  testType: string; // e.g. '12-Lead ECG', 'Chest CT Scan', 'Endoscopy', 'Skin Biopsy'
  finding: string;
  date?: string;
  impression?: string;
}

export interface LabResult {
  id: string;
  testName: string;
  date: string;
  value: string;
  unit: string;
  referenceRange: string;
  isAbnormal: boolean;
  clinicalSignificance: string;
}

export type DrugInteractionRisk = 'Safe' | 'Caution' | 'Potentially harmful';

export type ActionFlag =
  | 'Routine review'
  | 'Pharmacovigilance professional review'
  | 'Urgent clinical attention';

export interface PvAgentAssessmentOutputs {
  drugAndAdrExtraction: {
    suspectedDrugs: string[];
    concomitantDrugs: string[];
    adverseEvents: string[];
    summary: string;
  };
  adrClassification: {
    category: string;
    meddraSoc?: string;
    details?: string;
  };
  severity: 'Mild' | 'Moderate' | 'Severe' | 'Life-Threatening';
  seriousnessAssessment: {
    isSerious: boolean;
    criteriaMet: string[];
    rationale?: string;
  };
  causalityAssessment: {
    category: 'Certain' | 'Probable' | 'Possible' | 'Unlikely';
    naranjoScore?: number;
    rationale: string;
  };
  drugDrugInteraction: {
    status: DrugInteractionRisk;
    details: string;
    pairs?: Array<{ drugA: string; drugB: string; severity: string; mechanism: string }>;
  };
  duplicateDetection: {
    isDuplicateDetected: boolean;
    matchScore?: number;
    details: string;
  };
  clinicalRecommendation: {
    primaryRecommendation: string;
    followUpActions: string[];
  };
  pvReportSummary: string;
  actionFlag: ActionFlag;
}

export type NaranjoCategory = 'Definite' | 'Probable' | 'Possible' | 'Doubtful';

export type WhoUmcCategory =
  | 'Certain'
  | 'Probable / Likely'
  | 'Possible'
  | 'Unlikely'
  | 'Conditional / Unclassified'
  | 'Unassessable / Unclassifiable';

export type HartwigSeverityLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type HartwigSeverityCategory = 'Mild' | 'Moderate' | 'Severe';

export type SchumockPreventabilityCategory =
  | 'Definitely Preventable'
  | 'Probably Preventable'
  | 'Not Preventable';

export type RucamCategory =
  | 'Highly Probable (>8)'
  | 'Probable (6-8)'
  | 'Possible (3-5)'
  | 'Unlikely (1-2)'
  | 'Excluded (≤0)';

export type RawlinsThompsonType =
  | 'Type A - Augmented (Dose-dependent / Pharmacological)'
  | 'Type B - Bizarre (Idiosyncratic / Immunological)'
  | 'Type C - Chronic (Cumulative dose & duration)'
  | 'Type D - Delayed (Late onset / Teratogenesis)'
  | 'Type E - End of treatment (Withdrawal reactions)'
  | 'Type F - Failure of therapy (Resistance / Interactions)';

export interface DotsClassification {
  doseRelatedness: 'Collateral effect (Standard therapeutic)' | 'Hypersusceptibility (Subtherapeutic)' | 'Supratherapeutic (Toxic levels)';
  timing: 'Immediate / First-dose' | 'Early (Days 1-7)' | 'Intermediate (Weeks 2-12)' | 'Late (Chronic maintenance)' | 'Delayed (Post-cessation)';
  susceptibilityFactors: string[];
}

// Drug-Drug, Drug-Food, Drug-Disease Interaction Types
export type InteractionSeverity = 'Contraindicated / Severe' | 'Major / High Risk' | 'Moderate / Caution' | 'Minor' | 'None';
export type InteractionMechanismType =
  | 'Pharmacokinetic (CYP450 / Transporter)'
  | 'Pharmacodynamic (Additive / Synergistic Toxicity)'
  | 'Pharmacodynamic (Antagonistic / Reduced Efficacy)'
  | 'Physicochemical / Chelation'
  | 'Renal Tubular Clearance Competition';

export interface DrugInteractionAssessment {
  id: string;
  drugA: string;
  drugB: string;
  severity: InteractionSeverity;
  mechanismType: InteractionMechanismType;
  cypIsoenzyme?: string; // e.g., 'CYP3A4 Inhibition', 'CYP2D6 Poor Metabolizer Risk', 'P-gp Efflux'
  clinicalEffect: string;
  recommendedAction: string;
  evidenceSource: 'Prescribing Information (SmPC/USPI)' | 'Clinical Trial' | 'In Vitro / Pharmacokinetic Study' | 'Literature Case Reports';
}

export type DdiAdrCausalityRole =
  | 'Likely ADR Cause / Primary Driver'
  | 'Possible Contributing Factor'
  | 'Unlikely ADR Cause'
  | 'No Interaction';

export interface DrugDdiAdrAssessment {
  hasInteraction: boolean;
  severity: InteractionSeverity;
  interactingDrugs: string[];
  mechanism: string;
  mechanismType: InteractionMechanismType | 'None';
  cypOrTarget?: string;
  mayCauseAdr: boolean;
  adrCausalityRole: DdiAdrCausalityRole;
  adrMatchExplanation: string;
  clinicalAdvice: string;
  evidenceLevel: 'SmPC Black Box / Contraindicated' | 'Well-Established (Grade A)' | 'Clinical Reports (Grade B)' | 'Theoretical / In Vitro';
}

export interface DrugFoodDiseaseInteraction {
  id: string;
  drugName: string;
  interactor: string; // e.g., 'Grapefruit Juice', 'Renal Impairment (eGFR < 30)', 'QTc Prolongation Risk'
  type: 'Food / Beverage' | 'Disease / Condition' | 'Herb / Supplement';
  severity: InteractionSeverity;
  managementAdvice: string;
}

// Medication Error Domain Model (NCC MERP & MedDRA MedERR Standards)
export type NccMerpCategory =
  | 'Category A (Circumstances with capacity for error)'
  | 'Category B (Error occurred, did not reach patient)'
  | 'Category C (Error reached patient, no harm)'
  | 'Category D (Error reached patient, required monitoring to confirm no harm)'
  | 'Category E (Temporary harm, required intervention)'
  | 'Category F (Temporary harm, required initial or prolonged hospitalization)'
  | 'Category G (Permanent patient harm)'
  | 'Category H (Life-sustaining intervention required)'
  | 'Category I (Patient death)';

export type MedicationErrorStage =
  | 'Prescribing / Ordering'
  | 'Transcribing / Documenting'
  | 'Dispensing / Pharmacy Preparation'
  | 'Administration / Delivery'
  | 'Monitoring / Therapeutic Drug Monitoring';

export type MedicationErrorType =
  | 'Wrong Drug (Look-Alike / Sound-Alike - LASA)'
  | 'Wrong Dose / Overdose / Underdose'
  | 'Wrong Route of Administration'
  | 'Wrong Frequency / Timing'
  | 'Wrong Patient'
  | 'Contraindication Ignored'
  | 'Known Drug Allergy Ignored'
  | 'Drug-Drug Interaction Overlooked'
  | 'Preparation / Reconstitution Error'
  | 'Infusion Rate Error'
  | 'Omitted Dose'
  | 'Expired / Deteriorated Drug'
  | 'Therapeutic Monitoring Failure';

export interface MedicationErrorDetail {
  isErrorIdentified: boolean;
  stage: MedicationErrorStage;
  errorType: MedicationErrorType;
  nccMerpCategory: NccMerpCategory;
  rootCauses: string[];
  preventiveStrategies: string[];
  narrativeDescription: string;
  remedialActionTaken?: string;
}

export type RiskClassification =
  | 'Known Labeled Risk'
  | 'Potential New Signal'
  | 'Insufficient Evidence';

export type ReviewPriority =
  | 'P1 - Urgent (24h Expedited)'
  | 'P2 - High (72h Expedited)'
  | 'P3 - Medium (7d Standard)'
  | 'P4 - Routine (15d Standard)';

export interface MissingDataAudit {
  id: string;
  field: string;
  severity: 'High' | 'Medium' | 'Low';
  impact: string;
  suggestedFollowUpQuery: string;
  resolved: boolean;
}

export interface DuplicateMatch {
  caseId: string;
  caseNumber: string;
  matchScore: number; // 0 - 100%
  reasons: string[];
  patientInitials: string;
  suspectDrug: string;
  eventTerm: string;
  onsetDate: string;
  country: string;
}

export interface TimelineEvent {
  date: string;
  title: string;
  type: 'drug_start' | 'drug_stop' | 'adverse_event' | 'hospitalization' | 'lab_test' | 'dechallenge' | 'rechallenge' | 'outcome';
  description: string;
  badgeText?: string;
  alert?: boolean;
}

// Pharmacovigilance Case Management Workflow Structure
export type PvStage =
  | 'Intake'
  | 'Triage'
  | 'ClinicalAssessment'
  | 'SignalReview'
  | 'GovernanceEscalation'
  | 'ResolvedClosed';

export type PegaStage = PvStage;

export type PvWorkQueue =
  | 'PV_Intake_Auto'
  | 'PV_Triage_Desk'
  | 'PV_Medical_Review_Tier2'
  | 'PV_Epidemiology_Signals'
  | 'PV_Safety_Board_Signoff';

export type PegaWorkQueue = PvWorkQueue;

export interface WorkflowTransition {
  timestamp: string;
  fromStage: PvStage;
  toStage: PvStage;
  step: string;
  operator: string;
  actionTaken: string;
  rationale: string;
  humanSignature?: string;
  ruleExecuted?: string;
}

export interface PvSLA {
  goalTimestamp: string;
  deadlineTimestamp: string;
  passedDeadlineTimestamp: string;
  urgencyScore: number; // 0 - 100
  regulatoryDeadlineType: '7-Day Fatal/Life-Threatening' | '15-Day Serious' | '30-Day Non-Serious' | 'Periodic PSUR';
  hoursRemaining: number;
}

export type PegaSLA = PvSLA;

// RBAC Roles and User Personas
export type UserRole =
  | 'PV_TRIAGE_SPECIALIST'
  | 'PV_MEDICAL_REVIEWER'
  | 'SAFETY_LEAD_QPPV'
  | 'DATA_PRIVACY_AUDITOR';

export interface UserPersona {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  credentials: string;
  organization: string;
  jurisdiction: string;
  canEditCaseData: boolean;
  canApproveAssessments: boolean;
  canAuthorizeRegulatorySubmission: boolean;
  canUnmaskPII: boolean;
  canManageSignals: boolean;
}

export interface ReporterDetails {
  name: string;
  qualification: 'Physician' | 'Pharmacist' | 'Nurse' | 'Consumer / Patient' | 'Clinical Investigator';
  organization?: string;
  department?: string;
  email?: string;
  phone?: string;
  address?: string;
  country: string;
  isConfidential: boolean;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  userName: string;
  userRole: string;
  actionType:
    | 'CASE_CREATED'
    | 'CASE_VIEWED'
    | 'PII_UNMASKED'
    | 'FIELD_EDITED'
    | 'CODING_OVERRIDE'
    | 'DUPLICATE_ACCEPTED'
    | 'DUPLICATE_DISMISSED'
    | 'PRIORITY_CHANGED'
    | 'FOLLOWUP_APPROVED'
    | 'ASSESSMENT_APPROVED'
    | 'REGULATORY_SUBMISSION_AUTHORIZED'
    | 'SIGNAL_ESCALATED';
  description: string;
  rationale?: string;
  fieldChanged?: string;
  previousValue?: string;
  newValue?: string;
}

export interface SystemConfiguration {
  organizationType: 'Pharmaceutical MAH' | 'Hospital PV Unit' | 'Clinical Research Organization (CRO)' | 'Regulatory Health Authority';
  organizationName: string;
  primaryJurisdiction: 'US FDA (21 CFR 314.80)' | 'EU EMA (GVP Module VI)' | 'Japan PMDA' | 'UK MHRA' | 'Health Canada';
  caseStandard: 'ICH E2A & E2B(R3)';
  meddraVersion: string;
  dataRetentionYears: number;
  piiMaskingEnabled: boolean;
  requireDualSignoffForFatalCases: boolean;
  approvedIntakeSources: string[];
}

export interface HumanApprovalGate {
  status: 'Pending Review' | 'Approved' | 'Query Sent' | 'Escalated to SRB' | 'Rejected';
  reviewerName?: string;
  reviewerRole?: string;
  decisionTimestamp?: string;
  decisionNotes?: string;
  requiresSecondSignoff: boolean;
  secondSignoff?: {
    reviewerName: string;
    decisionTimestamp: string;
  };
}

export interface SafetyCase {
  id: string;
  caseNumber: string;
  version: number;
  initialReceivedDate: string;
  mostRecentUpdateDate: string;
  country: string;
  reporterQualification: 'Physician' | 'Pharmacist' | 'Nurse' | 'Consumer / Patient' | 'Clinical Investigator';
  reportType: ReportType;
  primarySource: string;
  
  // Reporter & Provenance Information
  reporterDetails?: ReporterDetails;
  originalSourceText?: string;
  intakeSourceType?: 'Web Form' | 'Direct HCP Email' | 'Patient Call-Center Note' | 'E2B(R3) Structured File' | 'Scientific Literature' | 'Clinical Study CRF';
  isPiiUnmasked?: boolean;
  
  // Patient & Clinical Data
  patient: Patient;
  drugs: DrugAdministration[];
  events: AdverseEvent[];
  labResults: LabResult[];
  vitalSigns?: VitalSigns;
  diagnosticFindings?: DiagnosticFinding[];
  narrativeText: string;
  clinicalSummary: string;
  timeline: TimelineEvent[];
  
  // Clinical Causality & Signal Analysis
  naranjoScore: number;
  naranjoCategory: NaranjoCategory;
  naranjoAnswers: Record<string, number>;
  whoUmcCategory: WhoUmcCategory;
  hartwigLevel?: HartwigSeverityLevel;
  hartwigCategory?: HartwigSeverityCategory;
  hartwigRationale?: string;
  schumockCategory?: SchumockPreventabilityCategory;
  schumockAnswers?: Record<string, boolean>;
  rucamScore?: number;
  rucamCategory?: RucamCategory;
  rucamAnswers?: Record<string, number>;
  rawlinsThompsonType?: RawlinsThompsonType;
  dotsClassification?: DotsClassification;
  riskClassification: RiskClassification;
  priority: ReviewPriority;
  priorityRationale: string;
  disproportionalityPRR?: number;
  actionFlag?: ActionFlag;
  aiAssessmentOutputs?: PvAgentAssessmentOutputs;
  
  // Fact vs Interpretation separation
  factsVsInterpretation: {
    reportedFacts: string[];
    algorithmicInterpretations: string[];
    clinicalUncertainties: string[];
  };
  
  // Quality & Deduplication
  missingDataAudit: MissingDataAudit[];
  potentialDuplicates: DuplicateMatch[];
  isDuplicateFlagged: boolean;
  duplicateStatus?: 'Unreviewed' | 'Accepted_Duplicate' | 'Dismissed_Non_Duplicate';
  duplicateReviewRationale?: string;
  
  // Workflow State & Reviewer Notes
  pegaStage: PegaStage;
  pegaStep: string;
  pegaWorkQueue: PegaWorkQueue;
  assignedOperator: string;
  pegaSLA: PegaSLA;
  workflowHistory: WorkflowTransition[];
  humanApproval: HumanApprovalGate;
  reviewerNotes?: Array<{
    id: string;
    timestamp: string;
    author: string;
    role: string;
    note: string;
  }>;
  
  // Audit Trail & 21 CFR Part 11 Compliance
  auditTrail: AuditEntry[];
  regulatorySubmissionTarget?: 'FDA MedWatch' | 'EMA EudraVigilance' | 'PMDA' | 'Health Canada' | 'Internal Safety Archive';
  regulatorySubmissionStatus?: 'Draft' | 'Validated' | 'Approved' | 'Submitted';
  regulatorySignoff?: {
    approvedBy: string;
    role: string;
    timestamp: string;
    jurisdiction: string;
    signaturePin: string;
  };
}

// Disproportionality Signal Detection Types
export interface ContingencyTable2x2 {
  a: number; // Target Drug + Target Event
  b: number; // Target Drug + Other Events
  c: number; // Other Drugs + Target Event
  d: number; // Other Drugs + Other Events
}

export interface SignalMetric {
  id: string;
  drugName: string;
  eventTerm: string;
  meddraSoc: string;
  contingency: ContingencyTable2x2;
  prr: number; // Proportional Reporting Ratio
  prrCiLower: number;
  prrCiUpper: number;
  chiSquare: number;
  ror: number; // Reporting Odds Ratio
  rorCiLower: number;
  rorCiUpper: number;
  ic: number; // Information Component
  ic025: number;
  ebgm: number; // Empirical Bayes Geometric Mean
  caseCount: number;
  status: 'Emerging Signal' | 'Validated Signal' | 'Under Surveillance' | 'Refuted / Known' | 'Escalated to SRB';
  evansCriteriaMet: boolean; // PRR >= 2, Chi2 >= 4, N >= 3
  firstDetectedDate: string;
  lastUpdatedDate: string;
  regulatoryActionProposed?: string;
  notes: string;
}

// Reference Benchmark Dataset Types
export interface BenchmarkPerformanceMetric {
  domain: 'Case Extraction' | 'Seriousness Classification' | 'Duplicate Detection' | 'Signal Prioritization';
  accuracy: number;
  sensitivityRecall: number;
  specificity: number;
  precision: number;
  f1Score: number;
  totalEvaluatedCases: number;
  concordantCases: number;
  discordantCases: number;
  validationCorpusName: string;
  notes: string;
}
