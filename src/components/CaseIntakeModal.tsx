import React, { useState } from 'react';
import {
  FilePlus,
  X,
  Sparkles,
  Plus,
  Trash2,
  Upload,
  ArrowRight,
  Info,
  Calendar,
  Pill,
  Activity,
  User,
  FlaskConical,
  FileText,
  HeartPulse,
  Stethoscope,
  Wand2,
  Brain,
  Camera,
} from 'lucide-react';
import {
  SafetyCase,
  ReportType,
  DrugAdministration,
  AdverseEvent,
  LabResult,
  DrugRole,
  DechallengeStatus,
  RechallengeStatus,
  EventOutcome,
  TimelineEvent,
} from '../types/pv';
import { showToast } from '../utils/toast';
import { DrugAutocompleteInput } from './DrugAutocompleteInput';
import { LabInvestigationsBuilder } from './LabInvestigationsBuilder';
import { DocumentCameraModal } from './DocumentCameraModal';
import {
  calculateNaranjoScore,
  checkDuplicateMatch,
  determinePriority,
  determineWhoUmcCategory,
} from '../utils/pvCalculators';

interface CaseIntakeModalProps {
  existingCases: SafetyCase[];
  onClose: () => void;
  onCaseCreated: (newCase: SafetyCase) => void;
}

export const CaseIntakeModal: React.FC<CaseIntakeModalProps> = ({
  existingCases,
  onClose,
  onCaseCreated,
}) => {
  // Report/Input Format: Structured form | Free-text case description | ADR report/document upload | JSON Data Import
  const [activeTab, setActiveTab] = useState<'form' | 'narrative' | 'upload' | 'json_import'>('form');

  // Case & Reporter
  const [caseNumber, setCaseNumber] = useState(
    `PV-${new Date().getFullYear()}-USER-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [country, setCountry] = useState('United States');
  const [reporterQual, setReporterQual] = useState<
    'Physician' | 'Pharmacist' | 'Nurse' | 'Consumer / Patient' | 'Clinical Investigator'
  >('Physician');
  const [reportType, setReportType] = useState<ReportType>('Spontaneous HCP');
  const [primarySource, setPrimarySource] = useState('Clinical Hospital Safety Dept');

  // Patient Information
  const [patientInitials, setPatientInitials] = useState('');
  const [patientAge, setPatientAge] = useState<number | ''>('');
  const [patientSex, setPatientSex] = useState<'Male' | 'Female' | 'Unknown'>('Unknown');
  const [pregnancyStatus, setPregnancyStatus] = useState<
    'Not Applicable' | 'First Trimester' | 'Second Trimester' | 'Third Trimester' | 'Post-Partum' | 'Unknown'
  >('Not Applicable');
  const [weightKg, setWeightKg] = useState<number | ''>('');
  const [medicalHistoryText, setMedicalHistoryText] = useState('');
  const [allergiesText, setAllergiesText] = useState('');
  const [renalFunction, setRenalFunction] = useState('Normal (eGFR > 60 mL/min)');
  const [hepaticFunction, setHepaticFunction] = useState('Normal transaminases');

  // Drug Information (Suspect & Concomitant Drugs List)
  const [drugs, setDrugs] = useState<
    Array<{
      drugName: string;
      activeSubstance: string;
      role: DrugRole;
      dose: string;
      route: string;
      frequency: string;
      durationOfTherapy: string;
      indication: string;
      startDate: string;
      stopDate: string;
      lotNumber: string;
      dechallenge: DechallengeStatus;
      rechallenge: RechallengeStatus;
    }>
  >([
    {
      drugName: '',
      activeSubstance: '',
      role: 'Suspect',
      dose: '100 mg',
      route: 'Oral',
      frequency: 'Once daily',
      durationOfTherapy: '14 days',
      indication: 'Target Condition',
      startDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
      stopDate: '',
      lotNumber: '',
      dechallenge: 'Positive',
      rechallenge: 'Not Performed',
    },
  ]);

  // Adverse Event Information
  const [events, setEvents] = useState<
    Array<{
      term: string;
      socTerm: string;
      signsAndSymptoms: string;
      onsetDate: string;
      eventDuration: string;
      outcome: EventOutcome;
      isListed: boolean;
      death: boolean;
      lifeThreatening: boolean;
      hospitalization: boolean;
      disability: boolean;
      congenitalAnomaly: boolean;
      otherMedicallyImportant: boolean;
      severityGrade: 'Mild' | 'Moderate' | 'Severe' | 'Life-Threatening';
    }>
  >([
    {
      term: '',
      socTerm: 'General disorders',
      signsAndSymptoms: '',
      onsetDate: new Date().toISOString().split('T')[0],
      eventDuration: '3 days',
      outcome: 'Recovering / Resolving',
      isListed: false,
      death: false,
      lifeThreatening: false,
      hospitalization: true,
      disability: false,
      congenitalAnomaly: false,
      otherMedicallyImportant: true,
      severityGrade: 'Severe',
    },
  ]);

  // Laboratory / Clinical Data (Optional)
  const [labs, setLabs] = useState<
    Array<{
      testName: string;
      date: string;
      value: string;
      unit: string;
      referenceRange: string;
      isAbnormal: boolean;
      significance: string;
    }>
  >([]);

  // Vital Signs
  const [vitalSigns, setVitalSigns] = useState({
    bloodPressure: '120/80 mmHg',
    heartRate: '78 bpm',
    respiratoryRate: '16 breaths/min',
    temperature: '37.0 °C',
    oxygenSaturation: '98% SpO2',
  });

  // Diagnostic Findings
  const [diagnostics, setDiagnostics] = useState<
    Array<{
      testType: string;
      finding: string;
      impression: string;
    }>
  >([]);

  // Free-Text Case Description State
  const [freeTextDescription, setFreeTextDescription] = useState('');
  const [isExtractingModalAI, setIsExtractingModalAI] = useState(false);
  const [modalExtractSuccess, setModalExtractSuccess] = useState<string | null>(null);

  // Document Upload State
  const [uploadedModalDoc, setUploadedModalDoc] = useState<{
    name: string;
    size: string;
    type: string;
    base64: string;
    previewUrl?: string;
    textContent?: string;
  } | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);

  // File upload handler
  const handleFileUploadModal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1] || '';
      const previewUrl = file.type.startsWith('image/') ? (reader.result as string) : undefined;
      let textContent = '';
      if (file.type.startsWith('text/') || file.name.endsWith('.json') || file.name.endsWith('.xml') || file.name.endsWith('.csv')) {
        try {
          textContent = atob(base64);
        } catch {}
      }
      setUploadedModalDoc({
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        type: file.type || 'application/octet-stream',
        base64,
        previewUrl,
        textContent,
      });
      if (textContent) {
        setFreeTextDescription(textContent);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = (file: File, previewUrl: string) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1] || '';
      setUploadedModalDoc({
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        type: file.type || 'image/jpeg',
        base64,
        previewUrl,
        textContent: '',
      });
      showToast('Document camera photo captured successfully!', 'success');
    };
    reader.readAsDataURL(file);
  };

  // Clinical Narrative
  const [narrativeText, setNarrativeText] = useState('');

  // JSON Raw Import
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // AI Auto-Extract Handler for Modal
  const handleExtractFromFreeTextOrDoc = async (sourceText?: string, fileObj?: any) => {
    const textToUse = sourceText || freeTextDescription;
    const docToUse = fileObj || uploadedModalDoc;

    if (!textToUse.trim() && !docToUse) {
      showToast('Please enter subjective evidence or upload a file first.', 'warning');
      return;
    }

    setIsExtractingModalAI(true);
    setModalExtractSuccess(null);

    try {
      const res = await fetch('/api/agent/extract-to-chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narrative: textToUse,
          fileData: docToUse?.base64,
          fileMimeType: docToUse?.type,
          fileName: docToUse?.name,
        }),
      });

      const data = await res.json();
      if (data.extracted) {
        const ext = data.extracted;
        if (ext.drugs && Array.isArray(ext.drugs) && ext.drugs.length > 0) {
          setDrugs(
            ext.drugs.map((d: any) => ({
              drugName: d.drugName || 'Medication',
              activeSubstance: d.activeSubstance || d.drugName || '',
              role: d.role || 'Suspect',
              dose: d.dose || 'Standard dose',
              route: d.route || 'Oral',
              frequency: d.frequency || 'Once daily',
              durationOfTherapy: d.durationOfTherapy || '14 days',
              indication: d.indication || 'Unspecified',
              startDate: d.startDate || new Date().toISOString().split('T')[0],
              stopDate: d.stopDate || '',
              lotNumber: 'LOT-' + Math.floor(10000 + Math.random() * 90000),
              dechallenge: d.dechallenge || 'Positive',
              rechallenge: d.rechallenge || 'Not Performed',
            }))
          );
        }

        if (ext.adverseEvent) {
          setEvents([
            {
              term: ext.adverseEvent,
              socTerm: 'General disorders',
              signsAndSymptoms: ext.signsAndSymptoms || '',
              onsetDate: ext.onsetDate || new Date().toISOString().split('T')[0],
              eventDuration: ext.eventDuration || '3 days',
              outcome: ext.outcome || 'Recovering / Resolving',
              isListed: Boolean(ext.isListedInSmPC),
              death: Boolean(ext.death),
              lifeThreatening: Boolean(ext.lifeThreatening),
              hospitalization: typeof ext.hospitalization === 'boolean' ? ext.hospitalization : true,
              disability: Boolean(ext.disability),
              congenitalAnomaly: Boolean(ext.congenitalAnomaly),
              otherMedicallyImportant: typeof ext.otherMedicallyImportant === 'boolean' ? ext.otherMedicallyImportant : true,
              severityGrade: ext.severityGrade || 'Severe',
            },
          ]);
        }

        if (ext.patientAge) setPatientAge(Number(ext.patientAge));
        if (ext.patientSex) setPatientSex(ext.patientSex);
        if (ext.patientInitials) setPatientInitials(ext.patientInitials);
        if (ext.weightKg) setWeightKg(Number(ext.weightKg));
        if (ext.medicalHistory) setMedicalHistoryText(ext.medicalHistory);

        if (ext.vitalSigns) {
          setVitalSigns({
            bloodPressure: ext.vitalSigns.bloodPressure || '120/80 mmHg',
            heartRate: ext.vitalSigns.heartRate || '78 bpm',
            respiratoryRate: ext.vitalSigns.respiratoryRate || '16 breaths/min',
            temperature: ext.vitalSigns.temperature || '37.0 °C',
            oxygenSaturation: ext.vitalSigns.oxygenSaturation || '98% SpO2',
          });
        }

        if (ext.labs && Array.isArray(ext.labs) && ext.labs.length > 0) {
          setLabs(
            ext.labs.map((l: any) => ({
              testName: l.testName || 'Laboratory Test',
              date: new Date().toISOString().split('T')[0],
              value: l.value || '',
              unit: l.unit || 'mg/dL',
              referenceRange: l.referenceRange || 'Normal',
              isAbnormal: Boolean(l.isAbnormal),
              significance: 'Biomarker evaluated',
            }))
          );
        }

        if (ext.diagnosticFindings && Array.isArray(ext.diagnosticFindings) && ext.diagnosticFindings.length > 0) {
          setDiagnostics(
            ext.diagnosticFindings.map((df: any) => ({
              testType: df.testType || 'Diagnostic Procedure',
              finding: df.finding || '',
              impression: df.impression || '',
            }))
          );
        }

        if (textToUse) setNarrativeText(textToUse);

        setActiveTab('form');
        setModalExtractSuccess('Data successfully extracted and populated into Patient Information!');
        setTimeout(() => setModalExtractSuccess(null), 4000);
      }
    } catch (err: any) {
      showToast(`AI Extraction note: ${err.message}`, 'error');
    } finally {
      setIsExtractingModalAI(false);
    }
  };

  // Drug Handlers
  const handleAddDrug = () => {
    setDrugs([
      ...drugs,
      {
        drugName: '',
        activeSubstance: '',
        role: 'Concomitant',
        dose: 'Standard dose',
        route: 'Oral',
        frequency: 'Once daily',
        durationOfTherapy: 'Standard course',
        indication: '',
        startDate: '',
        stopDate: '',
        lotNumber: '',
        dechallenge: 'Not Applicable',
        rechallenge: 'Not Applicable',
      },
    ]);
  };

  const handleRemoveDrug = (index: number) => {
    if (drugs.length > 1) {
      setDrugs(drugs.filter((_, i) => i !== index));
    }
  };

  const handleUpdateDrug = (index: number, field: string, value: any) => {
    const updated = [...drugs];
    (updated[index] as any)[field] = value;
    setDrugs(updated);
  };

  // Event Handlers
  const handleAddEvent = () => {
    setEvents([
      ...events,
      {
        term: '',
        socTerm: 'General disorders',
        signsAndSymptoms: '',
        onsetDate: new Date().toISOString().split('T')[0],
        eventDuration: '',
        outcome: 'Recovering / Resolving',
        isListed: false,
        death: false,
        lifeThreatening: false,
        hospitalization: false,
        disability: false,
        congenitalAnomaly: false,
        otherMedicallyImportant: false,
        severityGrade: 'Moderate',
      },
    ]);
  };

  const handleRemoveEvent = (index: number) => {
    if (events.length > 1) {
      setEvents(events.filter((_, i) => i !== index));
    }
  };

  const handleUpdateEvent = (index: number, field: string, value: any) => {
    const updated = [...events];
    (updated[index] as any)[field] = value;
    setEvents(updated);
  };

  // Lab Handlers
  const handleAddLab = () => {
    setLabs([
      ...labs,
      {
        testName: '',
        date: new Date().toISOString().split('T')[0],
        value: '',
        unit: 'mg/dL',
        referenceRange: 'Normal',
        isAbnormal: true,
        significance: '',
      },
    ]);
  };

  const handleRemoveLab = (index: number) => {
    setLabs(labs.filter((_, i) => i !== index));
  };

  const handleUpdateLab = (index: number, field: string, value: any) => {
    const updated = [...labs];
    (updated[index] as any)[field] = value;
    setLabs(updated);
  };

  // Submit and Run Full Analysis Engine
  const handleSubmitForm = () => {
    const primaryDrug = drugs[0];
    const primaryEvent = events[0];

    const safeDrugName = primaryDrug.drugName.trim() || 'Suspect Medication';
    const safeSubstance = primaryDrug.activeSubstance.trim() || safeDrugName;
    const safeEventTerm = primaryEvent.term.trim() || 'Adverse Drug Reaction';

    // Map Adverse Events
    const formattedEvents: AdverseEvent[] = events.map((ev, i) => {
      const isSerious =
        ev.death ||
        ev.lifeThreatening ||
        ev.hospitalization ||
        ev.disability ||
        ev.congenitalAnomaly ||
        ev.otherMedicallyImportant;

      return {
        id: `ev-${Date.now()}-${i}`,
        term: ev.term.trim() || 'Adverse Event',
        lltTerm: ev.term.trim() || 'Adverse Event',
        socTerm: ev.socTerm,
        signsAndSymptoms: ev.signsAndSymptoms,
        onsetDate: ev.onsetDate || new Date().toISOString().split('T')[0],
        eventDuration: ev.eventDuration,
        resolutionDate: null,
        outcome: ev.outcome,
        seriousness: {
          death: ev.death,
          lifeThreatening: ev.lifeThreatening,
          hospitalization: ev.hospitalization,
          disability: ev.disability,
          congenitalAnomaly: ev.congenitalAnomaly,
          otherMedicallyImportant: ev.otherMedicallyImportant,
        },
        isSerious,
        isListedInSmPC: ev.isListed,
        smPCDetails: ev.isListed
          ? 'Labeled risk identified in reference product monograph.'
          : 'Unlisted / unexpected adverse reaction requiring safety assessment.',
        severityGrade: ev.severityGrade,
      };
    });

    // Map Drugs
    const formattedDrugs: DrugAdministration[] = drugs.map((d, i) => ({
      id: `drug-${Date.now()}-${i}`,
      drugName: d.drugName.trim() || `Drug ${i + 1}`,
      activeSubstance: d.activeSubstance.trim() || d.drugName.trim() || `Substance ${i + 1}`,
      brandName: d.drugName.trim(),
      role: d.role,
      dose: d.dose,
      route: d.route,
      frequency: d.frequency,
      durationOfTherapy: d.durationOfTherapy,
      indication: d.indication || 'Unspecified',
      startDate: d.startDate || new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0],
      stopDate: d.stopDate || null,
      ongoing: !d.stopDate,
      batchLotNumber: d.lotNumber || 'Not Reported',
      marketingAuthHolder: 'Marketing Authorization Holder',
      dechallenge: d.dechallenge,
      rechallenge: d.rechallenge,
      actionTaken: d.stopDate ? 'Drug Withdrawn' : 'Dose Not Changed',
      knownSmPCAdverseReactions: ['Known ADR profile'],
    }));

    // Map Labs
    const formattedLabs: LabResult[] = labs.map((l, i) => ({
      id: `lab-${Date.now()}-${i}`,
      testName: l.testName.trim() || `Biomarker ${i + 1}`,
      date: l.date,
      value: l.value,
      unit: l.unit,
      referenceRange: l.referenceRange,
      isAbnormal: l.isAbnormal,
      clinicalSignificance: l.significance || 'Clinical evaluation biomarker',
    }));

    // Regulatory Priority & Seriousness
    const priorityResult = determinePriority(formattedEvents);

    // Initial Naranjo scoring
    const isPositiveDechallenge = formattedDrugs.some((d) => d.dechallenge === 'Positive');
    const isPositiveRechallenge = formattedDrugs.some((d) => d.rechallenge === 'Positive');
    const naranjoAnswers: Record<string, number> = {
      q1: formattedEvents.some((e) => e.isListedInSmPC) ? 1 : 0,
      q2: 2, // Event appeared after drug
      q3: isPositiveDechallenge ? 1 : 0,
      q4: isPositiveRechallenge ? 2 : 0,
      q5: 1, // Alternative cause considered
      q6: 0,
      q7: 0,
      q8: 0,
      q9: 0,
      q10: formattedLabs.length > 0 ? 1 : 0,
    };
    const { totalScore, category } = calculateNaranjoScore(naranjoAnswers);
    const whoCategory = determineWhoUmcCategory(totalScore, isPositiveDechallenge ? 'Positive' : 'Unknown', isPositiveRechallenge ? 'Positive' : 'Not Performed', false, formattedLabs.length > 0);

    // Duplicate Check against existing cases
    const duplicateMatches = existingCases
      .map((ex) => {
        const matchResult = checkDuplicateMatch(
          {
            initials: patientInitials,
            age: typeof patientAge === 'number' ? patientAge : null,
            sex: patientSex,
            drug: safeSubstance,
            event: safeEventTerm,
            onsetDate: formattedEvents[0]?.onsetDate || '',
            country,
          },
          {
            caseId: ex.id,
            caseNumber: ex.caseNumber,
            initials: ex.patient.initials,
            age: ex.patient.age,
            sex: ex.patient.sex,
            drug: ex.drugs[0]?.activeSubstance || '',
            event: ex.events[0]?.term || '',
            onsetDate: ex.events[0]?.onsetDate || '',
            country: ex.country,
          }
        );
        return {
          caseId: ex.id,
          caseNumber: ex.caseNumber,
          matchScore: matchResult.matchScore,
          reasons: matchResult.reasons,
          patientInitials: ex.patient.initials,
          suspectDrug: ex.drugs[0]?.drugName || '',
          eventTerm: ex.events[0]?.term || '',
          onsetDate: ex.events[0]?.onsetDate || '',
          country: ex.country,
        };
      })
      .filter((m) => m.matchScore >= 50);

    // Timeline construction
    const timeline: TimelineEvent[] = [
      {
        date: formattedDrugs[0].startDate,
        title: `${safeDrugName} Initiated`,
        type: 'drug_start',
        description: `${safeDrugName} (${formattedDrugs[0].dose} ${formattedDrugs[0].route}) started for ${formattedDrugs[0].indication}.`,
        badgeText: 'Drug Admin',
      },
      {
        date: formattedEvents[0].onsetDate,
        title: `${safeEventTerm} (Onset)`,
        type: 'adverse_event',
        description: `Acute clinical onset of ${safeEventTerm}. Seriousness: ${formattedEvents[0].severityGrade}.`,
        badgeText: 'Onset',
        alert: formattedEvents[0].isSerious,
      },
    ];

    if (formattedDrugs[0].stopDate) {
      timeline.push({
        date: formattedDrugs[0].stopDate,
        title: `${safeDrugName} Dechallenge`,
        type: 'dechallenge',
        description: `Medication discontinued with ${formattedDrugs[0].dechallenge} dechallenge response.`,
        badgeText: 'Dechallenge',
      });
    }

    const narrative =
      narrativeText.trim() ||
      `Patient ${patientInitials} (${patientAge || 'Unknown'}yo ${patientSex}) was prescribed ${safeDrugName} for ${formattedDrugs[0].indication}. Developed ${safeEventTerm} on ${formattedEvents[0].onsetDate}. Outcome reported as ${formattedEvents[0].outcome}.`;

    const parsedConditions = medicalHistoryText
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((cond) => ({
        condition: cond,
        status: 'Active' as const,
        isRiskFactor: true,
      }));

    const newCase: SafetyCase = {
      id: `case-${Date.now()}`,
      caseNumber: caseNumber.trim() || `PV-${Date.now()}`,
      version: 1,
      initialReceivedDate: new Date().toISOString(),
      mostRecentUpdateDate: new Date().toISOString(),
      country,
      reporterQualification: reporterQual,
      reportType,
      primarySource,
      patient: {
        id: `PT-${Date.now()}`,
        initials: patientInitials || 'N.N.',
        age: typeof patientAge === 'number' ? patientAge : null,
        ageGroup:
          typeof patientAge === 'number'
            ? patientAge >= 65
              ? 'Elderly (65+y)'
              : patientAge >= 18
              ? 'Adult (18-64y)'
              : 'Child (2-11y)'
            : 'Unknown',
        sex: patientSex,
        pregnancyStatus,
        weightKg: typeof weightKg === 'number' ? weightKg : null,
        medicalHistory: parsedConditions,
        allergies: allergiesText ? [allergiesText] : [],
        baselineOrganFunction: {
          renal: renalFunction,
          hepatic: hepaticFunction,
        },
      },
      drugs: formattedDrugs,
      events: formattedEvents,
      labResults: formattedLabs,
      vitalSigns,
      diagnosticFindings: diagnostics.map((dg, idx) => ({
        id: `diag-${Date.now()}-${idx}`,
        testType: dg.testType,
        finding: dg.finding,
        impression: dg.impression,
      })),
      narrativeText: narrative,
      clinicalSummary: `${patientAge || 'Patient'} ${patientSex} on ${safeDrugName} experienced ${safeEventTerm}. Evaluated as ${priorityResult.priority}. Causality: ${category}.`,
      timeline,
      naranjoScore: totalScore,
      naranjoCategory: category,
      naranjoAnswers,
      whoUmcCategory: whoCategory,
      riskClassification: formattedEvents.some((e) => !e.isListedInSmPC && e.isSerious)
        ? 'Potential New Signal'
        : 'Known Labeled Risk',
      priority: priorityResult.priority,
      priorityRationale: priorityResult.priorityRationale,
      actionFlag: priorityResult.priority.startsWith('P1')
        ? 'Urgent clinical attention'
        : priorityResult.priority.startsWith('P2')
        ? 'Pharmacovigilance professional review'
        : 'Routine review',
      aiAssessmentOutputs: {
        drugAndAdrExtraction: {
          suspectedDrugs: formattedDrugs.filter((d) => d.role === 'Suspect').map((d) => d.drugName),
          concomitantDrugs: formattedDrugs.filter((d) => d.role !== 'Suspect').map((d) => d.drugName),
          adverseEvents: formattedEvents.map((e) => e.term),
          summary: `Identified ${formattedDrugs.filter((d) => d.role === 'Suspect').length} suspect drug(s) and ${formattedEvents.length} adverse reaction(s).`,
        },
        adrClassification: {
          category: formattedEvents.some((e) => e.term.toLowerCase().includes('myocarditis') || e.term.toLowerCase().includes('syndrome'))
            ? 'Type B - Idiosyncratic / Immune-mediated'
            : 'Type A - Dose-dependent / Augmented Pharmacologic',
          meddraSoc: formattedEvents[0]?.socTerm || 'General disorders',
        },
        severity: formattedEvents.some((e) => e.severityGrade === 'Severe' || e.severityGrade === 'Life-Threatening')
          ? 'Severe'
          : formattedEvents.some((e) => e.severityGrade === 'Moderate')
          ? 'Moderate'
          : 'Mild',
        seriousnessAssessment: {
          isSerious: priorityResult.isSerious,
          criteriaMet: [
            formattedEvents.some((e) => e.seriousness.death) && 'Death / Fatal outcome',
            formattedEvents.some((e) => e.seriousness.lifeThreatening) && 'Life-Threatening',
            formattedEvents.some((e) => e.seriousness.hospitalization) && 'Hospitalization (Initial or Prolonged)',
            formattedEvents.some((e) => e.seriousness.disability) && 'Disability / Incapacity',
            formattedEvents.some((e) => e.seriousness.congenitalAnomaly) && 'Congenital Anomaly',
            formattedEvents.some((e) => e.seriousness.otherMedicallyImportant) && 'Medically Important Event',
          ].filter(Boolean) as string[],
        },
        causalityAssessment: {
          category: category === 'Definite' ? 'Certain' : category === 'Probable' ? 'Probable' : category === 'Possible' ? 'Possible' : 'Unlikely',
          naranjoScore: totalScore,
          rationale: `Standardized causality calculated: score ${totalScore} (${category}).`,
        },
        drugDrugInteraction: {
          status: formattedDrugs.length > 1 ? (formattedDrugs.some((d) => d.role === 'Interacting') ? 'Potentially harmful' : 'Caution') : 'Safe',
          details: formattedDrugs.length > 1 ? `Screened ${formattedDrugs.length} co-administered medicines.` : 'Single agent regimen.',
        },
        duplicateDetection: {
          isDuplicateDetected: duplicateMatches.length > 0,
          matchScore: duplicateMatches[0]?.matchScore || 0,
          details: duplicateMatches.length > 0 ? `Identified ${duplicateMatches.length} matching record(s).` : 'No duplicate cases detected.',
        },
        clinicalRecommendation: {
          primaryRecommendation: priorityResult.isSerious
            ? 'Urgent clinical evaluation recommended. Discontinue suspect agent and monitor biomarkers.'
            : 'Routine clinical review recommended.',
          followUpActions: ['Monitor patient vital signs', 'Confirm lab findings', 'HCP follow-up query'],
        },
        pvReportSummary: narrative,
        actionFlag: priorityResult.priority.startsWith('P1')
          ? 'Urgent clinical attention'
          : priorityResult.priority.startsWith('P2')
          ? 'Pharmacovigilance professional review'
          : 'Routine review',
      },
      factsVsInterpretation: {
        reportedFacts: [
          `Patient ${patientInitials} administered ${safeDrugName} (${formattedDrugs[0].dose}).`,
          `Event reported: ${safeEventTerm} on ${formattedEvents[0].onsetDate}.`,
          `Reported outcome: ${formattedEvents[0].outcome}.`,
        ],
        algorithmicInterpretations: [
          `Naranjo Algorithm Score: ${totalScore} (${category} causality).`,
          `ICH E2A Seriousness: ${priorityResult.isSerious ? 'Serious' : 'Non-Serious'}.`,
          `Recommended Triage: ${priorityResult.priority}.`,
        ],
        clinicalUncertainties: [
          'Further longitudinal dechallenge/rechallenge verification recommended.',
        ],
      },
      missingDataAudit: [
        {
          id: `miss-${Date.now()}-1`,
          field: 'Batch / Lot Number',
          severity: 'Medium',
          impact: 'Required to track manufacturing quality deviations.',
          suggestedFollowUpQuery: 'Please confirm manufacturer batch or lot number.',
          resolved: Boolean(formattedDrugs[0].batchLotNumber && formattedDrugs[0].batchLotNumber !== 'Not Reported'),
        },
      ],
      potentialDuplicates: duplicateMatches,
      isDuplicateFlagged: duplicateMatches.length > 0,
      pegaStage: 'Triage',
      pegaStep: 'Triage & Seriousness Verification',
      pegaWorkQueue: priorityResult.priority.startsWith('P1') ? 'PV_Medical_Review_Tier2' : 'PV_Triage_Desk',
      assignedOperator: 'PV Medical Reviewer',
      pegaSLA: {
        goalTimestamp: new Date(Date.now() + priorityResult.expeditedHours * 3600 * 1000).toISOString(),
        deadlineTimestamp: new Date(Date.now() + (priorityResult.expeditedHours + 12) * 3600 * 1000).toISOString(),
        passedDeadlineTimestamp: new Date(Date.now() + (priorityResult.expeditedHours + 24) * 3600 * 1000).toISOString(),
        urgencyScore: priorityResult.priority.startsWith('P1') ? 95 : priorityResult.priority.startsWith('P2') ? 75 : 40,
        regulatoryDeadlineType: priorityResult.priority.startsWith('P1') ? '7-Day Fatal/Life-Threatening' : '15-Day Serious',
        hoursRemaining: priorityResult.expeditedHours,
      },
      workflowHistory: [
        {
          timestamp: new Date().toISOString(),
          fromStage: 'Intake',
          toStage: 'Triage',
          step: 'User Safety Case Intake',
          operator: 'Direct User Entry',
          actionTaken: 'User-provided case analyzed and ingested.',
          rationale: 'Clinical fields and narrative evaluated by AegisPV intelligence engine.',
        },
      ],
      humanApproval: {
        status: 'Pending Review',
        requiresSecondSignoff: priorityResult.priority.startsWith('P1'),
      },
      intakeSourceType: 'Web Form',
      originalSourceText: narrative,
      isPiiUnmasked: false,
      reporterDetails: {
        name: 'Reporting Healthcare Professional',
        qualification: reporterQual,
        organization: primarySource,
        email: 'reporter@clinic.org',
        phone: '+1-555-0199',
        country,
        isConfidential: true,
      },
      reviewerNotes: [],
      auditTrail: [
        {
          id: `aud-${Date.now()}-1`,
          timestamp: new Date().toISOString(),
          userName: 'Authorized Intake Officer',
          userRole: 'PV_TRIAGE_SPECIALIST',
          actionType: 'CASE_CREATED',
          description: 'Case created via structured intake console.',
          rationale: 'Initial intake of spontaneous/clinical safety information.',
        },
      ],
      regulatorySubmissionTarget: 'FDA MedWatch',
      regulatorySubmissionStatus: 'Draft',
    };

    onCaseCreated(newCase);
    onClose();
  };

  // JSON Import Handler
  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (Array.isArray(parsed)) {
        parsed.forEach((c) => onCaseCreated(c));
      } else if (parsed && typeof parsed === 'object') {
        onCaseCreated(parsed as SafetyCase);
      }
      onClose();
    } catch (err: any) {
      setJsonError(`Invalid JSON format: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-4xl w-full my-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FilePlus className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold">Input New Safety Case for Analysis</h3>
              <p className="text-[11px] text-slate-400">
                Enter your own clinical report data; the system analyzes causality, seriousness, and duplicate matches
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-800 p-0.5 rounded text-xs gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                  activeTab === 'form' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Pill className="w-3 h-3" />
                <span>Patient Information</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('narrative')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                  activeTab === 'narrative' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileText className="w-3 h-3" />
                <span>Subjective Evidence</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                  activeTab === 'upload' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Upload className="w-3 h-3" />
                <span>ADR Report / Document Upload</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('json_import')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  activeTab === 'json_import' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>JSON Import</span>
              </button>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer ml-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {activeTab === 'form' ? (
          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            {/* Section 1: Case Identification & Source */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>1. Case Identification & Source</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Case Reference ID</label>
                  <input
                    type="text"
                    value={caseNumber}
                    onChange={(e) => setCaseNumber(e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Reporting Country</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Reporter Qualification</label>
                  <select
                    value={reporterQual}
                    onChange={(e) => setReporterQual(e.target.value as any)}
                    className="mt-1 w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
                  >
                    <option value="Physician">Physician</option>
                    <option value="Pharmacist">Pharmacist</option>
                    <option value="Nurse">Nurse</option>
                    <option value="Consumer / Patient">Consumer / Patient</option>
                    <option value="Clinical Investigator">Clinical Investigator</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Report Source Type</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value as any)}
                    className="mt-1 w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
                  >
                    <option value="Spontaneous HCP">Spontaneous HCP</option>
                    <option value="Spontaneous Consumer/Patient">Consumer / Patient</option>
                    <option value="Clinical Trial SAE">Clinical Trial SAE</option>
                    <option value="Post-Marketing Registry">Post-Marketing Registry</option>
                    <option value="Scientific Literature">Scientific Literature</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Patient Characteristics */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1">
                <User className="w-4 h-4 text-indigo-600" />
                <span>2. Patient Characteristics</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Patient Initials</label>
                  <input
                    type="text"
                    value={patientInitials}
                    onChange={(e) => setPatientInitials(e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Age (Years)</label>
                  <input
                    type="number"
                    value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value === '' ? '' : parseInt(e.target.value))}
                    className="mt-1 w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Sex</label>
                  <select
                    value={patientSex}
                    onChange={(e) => setPatientSex(e.target.value as any)}
                    className="mt-1 w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Weight (kg)</label>
                  <input
                    type="number"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="mt-1 w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Pregnancy Status</label>
                  <select
                    value={pregnancyStatus}
                    onChange={(e) => setPregnancyStatus(e.target.value as any)}
                    className="mt-1 w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
                  >
                    <option value="Not Applicable">Not Applicable</option>
                    <option value="First Trimester">First Trimester</option>
                    <option value="Second Trimester">Second Trimester</option>
                    <option value="Third Trimester">Third Trimester</option>
                    <option value="Post-Partum">Post-Partum</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Medical History / Risk Factors</label>
                  <input
                    type="text"
                    value={medicalHistoryText}
                    onChange={(e) => setMedicalHistoryText(e.target.value)}
                    placeholder="Comma separated: Diabetes, Hypertension..."
                    className="mt-1 w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Known Allergies</label>
                  <input
                    type="text"
                    value={allergiesText}
                    onChange={(e) => setAllergiesText(e.target.value)}
                    placeholder="e.g. Penicillin, NSAIDs, None"
                    className="mt-1 w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Suspected & Concomitant Medicines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 uppercase tracking-wider">
                  <Pill className="w-4 h-4 text-indigo-600" />
                  <span>3. Suspected & Concomitant Medicines ({drugs.length})</span>
                </div>
                <button
                  onClick={handleAddDrug}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another Medication</span>
                </button>
              </div>

              <div className="space-y-3">
                {drugs.map((drug, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-[11px]">Medication #{idx + 1}</span>
                      {drugs.length > 1 && (
                        <button
                          onClick={() => handleRemoveDrug(idx)}
                          className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Drug Name (Autocomplete) *</label>
                        <DrugAutocompleteInput
                          value={drug.drugName}
                          onChange={(val) => handleUpdateDrug(idx, 'drugName', val)}
                          onSelectDrug={(sel) => {
                            handleUpdateDrug(idx, 'drugName', sel.drugName);
                            handleUpdateDrug(idx, 'activeSubstance', sel.activeSubstance);
                            if (!drug.dose) handleUpdateDrug(idx, 'dose', sel.defaultDose);
                            if (!drug.route || drug.route === 'Oral') handleUpdateDrug(idx, 'route', sel.defaultRoute);
                            if (!drug.frequency || drug.frequency === 'Once daily') handleUpdateDrug(idx, 'frequency', sel.defaultFrequency);
                            if (!drug.indication) handleUpdateDrug(idx, 'indication', sel.typicalIndication);
                          }}
                          placeholder="Search drug (e.g. Simvastatin, Warfarin, Vancomycin)..."
                          className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Active Substance</label>
                        <input
                          type="text"
                          value={drug.activeSubstance}
                          onChange={(e) => handleUpdateDrug(idx, 'activeSubstance', e.target.value)}
                          placeholder="e.g. Pembrolizumab"
                          className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Role</label>
                        <select
                          value={drug.role}
                          onChange={(e) => handleUpdateDrug(idx, 'role', e.target.value)}
                          className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded font-medium text-slate-800"
                        >
                          <option value="Suspect">Suspect Drug</option>
                          <option value="Concomitant">Concomitant</option>
                          <option value="Interacting">Interacting</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Dose *</label>
                        <input
                          type="text"
                          value={drug.dose}
                          onChange={(e) => handleUpdateDrug(idx, 'dose', e.target.value)}
                          placeholder="e.g. 200 mg"
                          className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Route of Administration *</label>
                        <input
                          type="text"
                          value={drug.route}
                          onChange={(e) => handleUpdateDrug(idx, 'route', e.target.value)}
                          placeholder="e.g. IV Infusion, Oral"
                          className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Frequency *</label>
                        <input
                          type="text"
                          value={drug.frequency}
                          onChange={(e) => handleUpdateDrug(idx, 'frequency', e.target.value)}
                          placeholder="e.g. Once daily, Every 3 weeks"
                          className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Duration of Therapy *</label>
                        <input
                          type="text"
                          value={drug.durationOfTherapy}
                          onChange={(e) => handleUpdateDrug(idx, 'durationOfTherapy', e.target.value)}
                          placeholder="e.g. 6 weeks, 14 days, Ongoing"
                          className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Indication</label>
                        <input
                          type="text"
                          value={drug.indication}
                          onChange={(e) => handleUpdateDrug(idx, 'indication', e.target.value)}
                          placeholder="e.g. Melanoma, T2DM"
                          className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Start Date</label>
                        <input
                          type="date"
                          value={drug.startDate}
                          onChange={(e) => handleUpdateDrug(idx, 'startDate', e.target.value)}
                          className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Stop Date (Optional)</label>
                        <input
                          type="date"
                          value={drug.stopDate}
                          onChange={(e) => handleUpdateDrug(idx, 'stopDate', e.target.value)}
                          className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Dechallenge (Withdrawn?)</label>
                        <select
                          value={drug.dechallenge}
                          onChange={(e) => handleUpdateDrug(idx, 'dechallenge', e.target.value)}
                          className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
                        >
                          <option value="Positive">Positive (Improved)</option>
                          <option value="Negative">Negative (Did not improve)</option>
                          <option value="Not Applicable">Not Applicable / Ongoing</option>
                          <option value="Unknown">Unknown</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Rechallenge (Re-given?)</label>
                        <select
                          value={drug.rechallenge}
                          onChange={(e) => handleUpdateDrug(idx, 'rechallenge', e.target.value)}
                          className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
                        >
                          <option value="Not Performed">Not Performed</option>
                          <option value="Positive">Positive (Recurred)</option>
                          <option value="Negative">Negative (No recurrence)</option>
                          <option value="Unknown">Unknown</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Batch / Lot No.</label>
                        <input
                          type="text"
                          value={drug.lotNumber}
                          onChange={(e) => handleUpdateDrug(idx, 'lotNumber', e.target.value)}
                          placeholder="e.g. W049182"
                          className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 4: Adverse Reactions & Seriousness */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 uppercase tracking-wider">
                  <Activity className="w-4 h-4 text-rose-600" />
                  <span>4. Adverse Reaction(s) & ICH E2A Seriousness ({events.length})</span>
                </div>
                <button
                  onClick={handleAddEvent}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another Adverse Event</span>
                </button>
              </div>

              <div className="space-y-3">
                {events.map((ev, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-[11px]">Adverse Event #{idx + 1}</span>
                      {events.length > 1 && (
                        <button
                          onClick={() => handleRemoveEvent(idx)}
                          className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Suspected Adverse Reaction *</label>
                        <input
                          type="text"
                          value={ev.term}
                          onChange={(e) => handleUpdateEvent(idx, 'term', e.target.value)}
                          placeholder="e.g. Immune-mediated myocarditis, Stevens-Johnson Syndrome"
                          className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Date/Time of Onset *</label>
                        <input
                          type="text"
                          value={ev.onsetDate}
                          onChange={(e) => handleUpdateEvent(idx, 'onsetDate', e.target.value)}
                          placeholder="YYYY-MM-DD or YYYY-MM-DD HH:MM"
                          className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Duration of Adverse Event *</label>
                        <input
                          type="text"
                          value={ev.eventDuration}
                          onChange={(e) => handleUpdateEvent(idx, 'eventDuration', e.target.value)}
                          placeholder="e.g. 4 days, 48 hours, Ongoing"
                          className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase">Signs and Symptoms *</label>
                      <textarea
                        rows={2}
                        value={ev.signsAndSymptoms}
                        onChange={(e) => handleUpdateEvent(idx, 'signsAndSymptoms', e.target.value)}
                        placeholder="Clinical presentation: Acute retrosternal chest pain, dyspnea at rest, diaphoresis, palpitations, nausea..."
                        className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Severity *</label>
                        <select
                          value={ev.severityGrade}
                          onChange={(e) => handleUpdateEvent(idx, 'severityGrade', e.target.value as any)}
                          className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-800"
                        >
                          <option value="Mild">Mild</option>
                          <option value="Moderate">Moderate</option>
                          <option value="Severe">Severe</option>
                          <option value="Life-Threatening">Life-Threatening</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">Outcome *</label>
                        <select
                          value={ev.outcome}
                          onChange={(e) => handleUpdateEvent(idx, 'outcome', e.target.value)}
                          className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
                        >
                          <option value="Recovering / Resolving">Recovering / Resolving</option>
                          <option value="Recovered / Resolved">Recovered / Resolved</option>
                          <option value="Not Recovered / Not Resolved">Not Recovered / Not Resolved</option>
                          <option value="Recovered with Sequelae">Recovered with Sequelae</option>
                          <option value="Fatal">Fatal</option>
                          <option value="Unknown">Unknown</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">SmPC Listedness</label>
                        <select
                          value={ev.isListed ? 'true' : 'false'}
                          onChange={(e) => handleUpdateEvent(idx, 'isListed', e.target.value === 'true')}
                          className="mt-1 w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-800"
                        >
                          <option value="false">Unlisted / New Potential Risk</option>
                          <option value="true">Listed in Product Monograph</option>
                        </select>
                      </div>
                    </div>

                    {/* Seriousness Checkboxes */}
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                        ICH E2A Seriousness Criteria (Check all that apply):
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ev.death}
                            onChange={(e) => handleUpdateEvent(idx, 'death', e.target.checked)}
                          />
                          <span className="text-slate-800 font-medium">Death</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ev.lifeThreatening}
                            onChange={(e) => handleUpdateEvent(idx, 'lifeThreatening', e.target.checked)}
                          />
                          <span className="text-rose-700 font-bold">Life-Threatening</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ev.hospitalization}
                            onChange={(e) => handleUpdateEvent(idx, 'hospitalization', e.target.checked)}
                          />
                          <span className="text-amber-700 font-semibold">Hospitalization</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ev.disability}
                            onChange={(e) => handleUpdateEvent(idx, 'disability', e.target.checked)}
                          />
                          <span className="text-slate-800">Disability / Incapacity</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ev.congenitalAnomaly}
                            onChange={(e) => handleUpdateEvent(idx, 'congenitalAnomaly', e.target.checked)}
                          />
                          <span className="text-slate-800">Congenital Anomaly</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ev.otherMedicallyImportant}
                            onChange={(e) => handleUpdateEvent(idx, 'otherMedicallyImportant', e.target.checked)}
                          />
                          <span className="text-slate-800">Other Medically Important</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 5: Laboratory & Clinical Data (Optional) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 uppercase tracking-wider">
                  <FlaskConical className="w-4 h-4 text-emerald-600" />
                  <span>5. Laboratory & Clinical Data (Optional)</span>
                </div>
              </div>

              {/* Vital signs */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                  <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                  <span>Vital Signs</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Blood Pressure</label>
                    <input
                      type="text"
                      value={vitalSigns.bloodPressure}
                      onChange={(e) => setVitalSigns({ ...vitalSigns, bloodPressure: e.target.value })}
                      placeholder="e.g. 118/76 mmHg"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Heart Rate</label>
                    <input
                      type="text"
                      value={vitalSigns.heartRate}
                      onChange={(e) => setVitalSigns({ ...vitalSigns, heartRate: e.target.value })}
                      placeholder="e.g. 112 bpm"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Respiratory Rate</label>
                    <input
                      type="text"
                      value={vitalSigns.respiratoryRate}
                      onChange={(e) => setVitalSigns({ ...vitalSigns, respiratoryRate: e.target.value })}
                      placeholder="e.g. 22 breaths/min"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Temperature</label>
                    <input
                      type="text"
                      value={vitalSigns.temperature}
                      onChange={(e) => setVitalSigns({ ...vitalSigns, temperature: e.target.value })}
                      placeholder="e.g. 38.4 °C"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Oxygen Saturation</label>
                    <input
                      type="text"
                      value={vitalSigns.oxygenSaturation}
                      onChange={(e) => setVitalSigns({ ...vitalSigns, oxygenSaturation: e.target.value })}
                      placeholder="e.g. 93% SpO2"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Relevant Laboratory Values Component (LFT, RFT, URINE PCR, CBC, CPK/Troponin, TDM) */}
              <LabInvestigationsBuilder
                labs={labs as any}
                onChange={setLabs as any}
              />

              {/* Relevant Diagnostic Findings */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Relevant Diagnostic Findings ({diagnostics.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setDiagnostics([
                        ...diagnostics,
                        { testType: '12-Lead ECG', finding: '', impression: '' },
                      ])
                    }
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Diagnostic Finding</span>
                  </button>
                </div>

                {diagnostics.length > 0 ? (
                  <div className="space-y-2">
                    {diagnostics.map((dg, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <input
                            type="text"
                            value={dg.testType}
                            onChange={(e) =>
                              setDiagnostics((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, testType: e.target.value } : item))
                              )
                            }
                            placeholder="Procedure (e.g. 12-Lead ECG, CT, Echo)"
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-semibold"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <input
                            type="text"
                            value={dg.finding}
                            onChange={(e) =>
                              setDiagnostics((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, finding: e.target.value } : item))
                              )
                            }
                            placeholder="Finding (e.g. Global left ventricular hypokinesia)"
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={dg.impression}
                            onChange={(e) =>
                              setDiagnostics((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, impression: e.target.value } : item))
                              )
                            }
                            placeholder="Impression"
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded"
                          />
                          <button
                            type="button"
                            onClick={() => setDiagnostics((prev) => prev.filter((_, i) => i !== idx))}
                            className="ml-auto text-slate-400 hover:text-rose-600 cursor-pointer p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 italic bg-slate-50 p-2.5 rounded border border-slate-200">
                    No diagnostic findings recorded. Click "+ Add Diagnostic Finding" to add ECG, CT, MRI, biopsy, or endoscopy findings.
                  </div>
                )}
              </div>
            </div>

            {/* Section 6: Clinical Narrative */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                6. Clinical Narrative Description / CIOMS Section 7
              </label>
              <textarea
                rows={4}
                value={narrativeText}
                onChange={(e) => setNarrativeText(e.target.value)}
                placeholder="Describe patient course, onset timing, concomitant therapies, dechallenge/rechallenge observations, and clinical recovery status..."
                className="w-full p-3 font-serif text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 leading-relaxed focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Submit Action Ribbon */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Submitting runs automated Naranjo calculation, seriousness classification, and duplicate detection.</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitForm}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>Analyze & Ingest Safety Case</span>
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'narrative' ? (
          /* Subjective Evidence (Clinical Narrative) View */
          <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>Subjective Evidence (Clinical Narrative & Symptoms)</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFreeTextDescription(
                      'A 58-year-old male (weight: 78.5 kg) with metastatic melanoma and hypertension was treated with pembrolizumab 200mg IV every 3 weeks (duration: 6 weeks, 2 cycles). Also taking concomitant amlodipine 5mg oral daily. Following cycle 2, the patient developed acute retrosternal chest pain, severe dyspnea, and diaphoresis on 2026-09-21 14:30. Admitted to the coronary care unit. Peak troponin I reached 18.42 ng/mL (abnormal), BP 118/76 mmHg, HR 112 bpm, SpO2 93%. Echocardiogram revealed severe global hypokinesia with ejection fraction 32%. Diagnosed with immune-mediated myocarditis. Pembrolizumab discontinued with positive clinical improvement.'
                    );
                  }}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline"
                >
                  Load Sample Narrative
                </button>
                <button
                  type="button"
                  onClick={() => handleExtractFromFreeTextOrDoc()}
                  disabled={isExtractingModalAI || !freeTextDescription.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 disabled:bg-slate-100 text-indigo-700 disabled:text-slate-400 rounded-md font-bold text-xs border border-indigo-200 transition-colors cursor-pointer"
                >
                  {isExtractingModalAI ? (
                    <>
                      <span className="animate-spin w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full"></span>
                      <span>Extracting to Patient Information...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>AI Auto-Extract to Patient Information</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {modalExtractSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs">
                {modalExtractSuccess}
              </div>
            )}

            <textarea
              rows={10}
              value={freeTextDescription}
              onChange={(e) => setFreeTextDescription(e.target.value)}
              placeholder="Enter free-text clinical description: Patient age, sex, weight, relevant medical history, drug name, dose, route, frequency, duration of therapy, concomitant medications, adverse reaction, signs and symptoms, date/time of onset, duration, severity, outcome, vital signs, and relevant lab/diagnostic findings..."
              className="w-full p-3.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 leading-relaxed focus:bg-white focus:ring-1 focus:ring-indigo-500 font-normal"
            />

            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200">
              <span>{freeTextDescription.trim().split(/\s+/).filter(Boolean).length} words · {freeTextDescription.length} characters</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await handleExtractFromFreeTextOrDoc();
                    handleSubmitForm();
                  }}
                  disabled={!freeTextDescription.trim()}
                  className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>Analyze & Ingest Safety Case</span>
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'upload' ? (
          /* ADR Report / Document Upload View */
          <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
            <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-8 text-center bg-slate-50 hover:bg-indigo-50/20 transition-all">
              <div className="flex justify-center items-center gap-2 mb-2">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
              </div>

              <div className="font-bold text-slate-800 text-sm">
                Upload ADR Report, Medical Document, or Clinical Scan
              </div>
              <p className="text-slate-500 text-xs mt-1 max-w-lg mx-auto leading-relaxed">
                Accepts <strong>PDF</strong> safety reports, medical scans / photos (<strong>JPG, PNG, WEBP</strong>), discharge summaries, <strong>ICSR XML / JSON</strong>, <strong>CSV</strong>, and physician notes.
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCameraModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs transition-colors"
                  title="Open camera to scan medical paperwork, prescriptions, or discharge summaries"
                >
                  <Camera className="w-4 h-4" />
                  <span>Scan with Camera</span>
                </button>

                <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs transition-colors">
                  <Upload className="w-4 h-4" />
                  <span>Browse / Select File</span>
                  <input
                    type="file"
                    accept="*/*"
                    onChange={handleFileUploadModal}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {uploadedModalDoc && (
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {uploadedModalDoc.previewUrl ? (
                      <img
                        src={uploadedModalDoc.previewUrl}
                        alt={uploadedModalDoc.name}
                        className="w-14 h-14 rounded-lg object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                        <FileText className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                        <span>{uploadedModalDoc.name}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                          {uploadedModalDoc.size}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {uploadedModalDoc.type} · Ready for Vigilytics AI Extraction
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setUploadedModalDoc(null)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleExtractFromFreeTextOrDoc(undefined, uploadedModalDoc)}
                    disabled={isExtractingModalAI}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-xs border border-indigo-200 cursor-pointer"
                  >
                    {isExtractingModalAI ? (
                      <span>Extracting to Patient Information...</span>
                    ) : (
                      <>
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>AI Auto-Extract to Patient Information</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleExtractFromFreeTextOrDoc(undefined, uploadedModalDoc);
                      handleSubmitForm();
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Analyze & Ingest Uploaded Report</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* JSON Import View */
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Paste JSON Safety Case Object or Array of Cases
              </label>
            </div>

            <textarea
              rows={14}
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                setJsonError(null);
              }}
              placeholder={`{\n  "caseNumber": "PV-CUSTOM-001",\n  "country": "United States",\n  "patient": { "initials": "A.B.", "age": 45, "sex": "Female" },\n  "drugs": [...],\n  "events": [...]\n}`}
              className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500"
            />

            {jsonError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
                {jsonError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleImportJson}
                disabled={!jsonInput.trim()}
                className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Import & Analyze JSON Cases</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DOCUMENT CAMERA MODAL FOR MOBILE & PC */}
      <DocumentCameraModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={handleCameraCapture}
        title="Scan Medical Document for Case Intake"
      />
    </div>
  );
};
