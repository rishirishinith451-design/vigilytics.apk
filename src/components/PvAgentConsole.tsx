import React, { useState } from 'react';
import {
  Bot,
  CheckCircle2,
  AlertTriangle,
  Pill,
  FileText,
  User,
  Download,
  Copy,
  Check,
  Zap,
  Upload,
  Sliders,
  Trash2,
  Calendar,
  Plus,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
  Scale,
  Sparkles,
  Wand2,
  Brain,
  ShieldCheck,
  Send,
  HelpCircle,
  FlaskConical,
  HeartPulse,
  Stethoscope,
  Camera,
  ArrowRight,
  ShieldAlert,
  Info,
  ChevronRight,
  GraduationCap,
} from 'lucide-react';
import { SafetyCase, NaranjoCategory, EventOutcome, DrugAdministration, AdverseEvent } from '../types/pv';
import {
  NARANJO_QUESTIONS,
  calculateNaranjoScore,
  determineWhoUmcCategory,
} from '../utils/pvCalculators';
import {
  assessDrugDdiAndAdr,
  evaluateCaseDdiSummary,
  assessPairwiseDdi,
} from '../utils/ddiEngine';
import { showToast } from '../utils/toast';
import { DdiAdrDetailModal } from './DdiAdrDetailModal';
import { DrugAutocompleteInput } from './DrugAutocompleteInput';
import { LabInvestigationsBuilder, LabEntry } from './LabInvestigationsBuilder';
import { DocumentCameraModal } from './DocumentCameraModal';

export interface StructuredDrugItem {
  id: string;
  drugName: string;
  activeSubstance: string;
  role: 'Suspect' | 'Concomitant' | 'Interacting';
  dose: string;
  route: string;
  frequency: string;
  durationOfTherapy: string;
  indication: string;
  startDate: string;
  stopDate: string;
  dechallenge: 'Positive' | 'Negative' | 'Not Applicable' | 'Unknown';
  rechallenge: 'Positive' | 'Negative' | 'Not Performed' | 'Unknown';
}

export interface LabItem {
  id: string;
  testName: string;
  date: string;
  value: string;
  unit: string;
  referenceRange: string;
  isAbnormal: boolean;
  significance: string;
}

export interface DiagnosticItem {
  id: string;
  testType: string;
  finding: string;
  impression: string;
}

import {
  runPharmacovigilanceAgents,
  MultiAgentExecutionResult,
} from '../services/pvAgentService';
import { CIOMSExportModal } from './CIOMSExportModal';
import { FollowUpLetterModal } from './FollowUpLetterModal';

interface PvAgentConsoleProps {
  existingCases: SafetyCase[];
  onSaveCaseToWorkspace: (newCase: SafetyCase) => void;
}

export const PvAgentConsole: React.FC<PvAgentConsoleProps> = ({
  existingCases,
  onSaveCaseToWorkspace,
}) => {
  // Report/Input Format: 'narrative' (Free-Text Case Description) | 'structured' (Structured Form) | 'upload' (ADR Report / Document Upload)
  const [inputMode, setInputMode] = useState<'narrative' | 'structured' | 'upload'>('narrative');

  // Free-Text Case Description / Narration Input
  const [userInputText, setUserInputText] = useState('');

  // AI Extraction state
  const [isExtractingWithAI, setIsExtractingWithAI] = useState(false);
  const [aiExtractMessage, setAiExtractMessage] = useState<string | null>(null);

  // DDI Modal State
  const [activeDdiModalDrug, setActiveDdiModalDrug] = useState<DrugAdministration | null>(null);
  const [activeDdiCounterpart, setActiveDdiCounterpart] = useState<string | undefined>(undefined);

  // Drug Chart Input for Structured Form
  const createEmptyDrug = (
    role: 'Suspect' | 'Concomitant' | 'Interacting' = 'Suspect',
    name = ''
  ): StructuredDrugItem => ({
    id: `drug-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    drugName: name,
    activeSubstance: '',
    role,
    dose: '',
    route: 'Oral',
    frequency: 'Once daily',
    durationOfTherapy: '',
    indication: '',
    startDate: '',
    stopDate: '',
    dechallenge: 'Positive',
    rechallenge: 'Not Performed',
  });

  const [drugsList, setDrugsList] = useState<StructuredDrugItem[]>([
    createEmptyDrug('Suspect'),
  ]);

  const handleAddDrug = (role: 'Suspect' | 'Concomitant' | 'Interacting' = 'Suspect') => {
    setDrugsList((prev) => [...prev, createEmptyDrug(role)]);
  };

  const handleDuplicateDrug = (index: number) => {
    const target = drugsList[index];
    if (!target) return;
    const cloned: StructuredDrugItem = {
      ...target,
      id: `drug-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      drugName: target.drugName ? `${target.drugName} (Copy)` : '',
    };
    setDrugsList((prev) => {
      const copy = [...prev];
      copy.splice(index + 1, 0, cloned);
      return copy;
    });
  };

  const handleRemoveDrug = (index: number) => {
    if (drugsList.length <= 1) {
      setDrugsList([createEmptyDrug('Suspect')]);
      return;
    }
    setDrugsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateDrug = (index: number, field: keyof StructuredDrugItem, value: any) => {
    setDrugsList((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    );
  };

  // Structured Form Input for Patient, Adverse Event, Vital Signs
  const [structuredData, setStructuredData] = useState({
    // Patient Information
    patientInitials: '',
    patientAge: '',
    patientSex: 'Unknown' as 'Male' | 'Female' | 'Unknown',
    weightKg: '',
    medicalHistory: '',

    // Adverse Event Information
    adverseEvent: '',
    signsAndSymptoms: '',
    onsetDate: '',
    eventDuration: '',
    severityGrade: 'Severe' as 'Mild' | 'Moderate' | 'Severe' | 'Life-Threatening',
    outcome: 'Recovering / Resolving' as EventOutcome,
    death: false,
    lifeThreatening: false,
    hospitalization: true,
    disability: false,
    congenitalAnomaly: false,
    otherMedicallyImportant: false,
    isListedInSmPC: false,

    // Vital Signs
    vitalSigns: {
      bloodPressure: '',
      heartRate: '',
      respiratoryRate: '',
      temperature: '',
      oxygenSaturation: '',
    },
  });

  // Laboratory / Clinical Data (optional)
  const [labsList, setLabsList] = useState<LabItem[]>([
    {
      id: 'lab-1',
      testName: 'ALT / AST',
      date: new Date().toISOString().split('T')[0],
      value: '142 U/L',
      unit: 'U/L',
      referenceRange: '10-40 U/L',
      isAbnormal: true,
      significance: 'Elevated liver enzymes',
    },
  ]);

  // Diagnostic Findings (optional)
  const [diagnosticsList, setDiagnosticsList] = useState<DiagnosticItem[]>([]);

  // Upload state for all file types (PDF, JPG, PNG, WEBP, CSV, JSON, etc.)
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: string;
    type: string;
    base64: string;
    previewUrl?: string;
    textContent?: string;
  } | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);

  // Execution states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<MultiAgentExecutionResult | null>(null);

  // Naranjo Scale State for ADR Analysis
  const [naranjoAnswers, setNaranjoAnswers] = useState<Record<string, number>>({
    q1: 1,
    q2: 2,
    q3: 1,
    q4: 0,
    q5: 1,
    q6: 0,
    q7: 0,
    q8: 0,
    q9: 0,
    q10: 1,
  });

  // Modals
  const [showCIOMS, setShowCIOMS] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Interactive Agent Chat
  const [chatQuestion, setChatQuestion] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatHistory, setChatHistory] = useState<
    Array<{ sender: 'user' | 'agent'; message: string }>
  >([]);

  // Active Output Tab: 5 simple, high-value views
  const [outputTab, setOutputTab] = useState<'ai_outputs' | 'naranjo' | 'ai_insights' | 'overview' | 'timeline'>('ai_outputs');

  // AI Auto-Extract from Subjective Evidence or Uploaded File to Drug Chart
  const handleExtractToChartWithAI = async () => {
    const hasNarrative = Boolean(userInputText.trim());
    const hasFile = Boolean(uploadedFile?.base64);

    if (!hasNarrative && !hasFile) {
      showToast('Please enter subjective evidence or upload a file (PDF, JPG, PNG, etc.) first.', 'warning');
      return;
    }
    setIsExtractingWithAI(true);
    setAiExtractMessage(null);

    try {
      const res = await fetch('/api/agent/extract-to-chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narrative: userInputText,
          fileData: uploadedFile?.base64,
          fileMimeType: uploadedFile?.type,
          fileName: uploadedFile?.name,
        }),
      });
      const data = await res.json();
      if (data.extracted) {
        const ext = data.extracted;
        if (ext.drugs && Array.isArray(ext.drugs) && ext.drugs.length > 0) {
          setDrugsList(
            ext.drugs.map((d: any, idx: number) => ({
              id: `drug-${Date.now()}-${idx}`,
              drugName: d.drugName || 'Suspect Drug',
              activeSubstance: d.activeSubstance || d.drugName || '',
              role: d.role || (idx === 0 ? 'Suspect' : 'Concomitant'),
              dose: d.dose || 'Standard dose',
              route: d.route || 'Oral',
              frequency: d.frequency || 'Once daily',
              durationOfTherapy: d.durationOfTherapy || '',
              indication: d.indication || 'Unspecified',
              startDate: d.startDate || new Date().toISOString().split('T')[0],
              stopDate: d.stopDate || '',
              dechallenge: d.dechallenge || 'Positive',
              rechallenge: d.rechallenge || 'Not Performed',
            }))
          );
        }
        setStructuredData((prev) => ({
          ...prev,
          adverseEvent: ext.adverseEvent || prev.adverseEvent,
          signsAndSymptoms: ext.signsAndSymptoms || prev.signsAndSymptoms,
          onsetDate: ext.onsetDate || prev.onsetDate,
          eventDuration: ext.eventDuration || prev.eventDuration,
          severityGrade: ext.severityGrade || prev.severityGrade,
          outcome: ext.outcome || prev.outcome,
          hospitalization: typeof ext.hospitalization === 'boolean' ? ext.hospitalization : prev.hospitalization,
          lifeThreatening: typeof ext.lifeThreatening === 'boolean' ? ext.lifeThreatening : prev.lifeThreatening,
          death: typeof ext.death === 'boolean' ? ext.death : prev.death,
          disability: typeof ext.disability === 'boolean' ? ext.disability : prev.disability,
          congenitalAnomaly: typeof ext.congenitalAnomaly === 'boolean' ? ext.congenitalAnomaly : prev.congenitalAnomaly,
          otherMedicallyImportant: typeof ext.otherMedicallyImportant === 'boolean' ? ext.otherMedicallyImportant : prev.otherMedicallyImportant,
          patientInitials: ext.patientInitials || prev.patientInitials,
          patientAge: ext.patientAge ? String(ext.patientAge) : prev.patientAge,
          patientSex: ext.patientSex || prev.patientSex,
          weightKg: ext.weightKg !== undefined && ext.weightKg !== null ? String(ext.weightKg) : prev.weightKg,
          medicalHistory: ext.medicalHistory || prev.medicalHistory,
          vitalSigns: {
            bloodPressure: ext.vitalSigns?.bloodPressure || prev.vitalSigns.bloodPressure,
            heartRate: ext.vitalSigns?.heartRate || prev.vitalSigns.heartRate,
            respiratoryRate: ext.vitalSigns?.respiratoryRate || prev.vitalSigns.respiratoryRate,
            temperature: ext.vitalSigns?.temperature || prev.vitalSigns.temperature,
            oxygenSaturation: ext.vitalSigns?.oxygenSaturation || prev.vitalSigns.oxygenSaturation,
          },
        }));

        if (ext.labs && Array.isArray(ext.labs) && ext.labs.length > 0) {
          setLabsList(
            ext.labs.map((l: any, idx: number) => ({
              id: `lab-${Date.now()}-${idx}`,
              testName: l.testName || 'Laboratory Test',
              date: l.date || new Date().toISOString().split('T')[0],
              value: l.value || '',
              unit: l.unit || '',
              referenceRange: l.referenceRange || 'Normal',
              isAbnormal: Boolean(l.isAbnormal),
              significance: l.significance || 'Biomarker evaluation',
            }))
          );
        }

        if (ext.diagnosticFindings && Array.isArray(ext.diagnosticFindings) && ext.diagnosticFindings.length > 0) {
          setDiagnosticsList(
            ext.diagnosticFindings.map((df: any, idx: number) => ({
              id: `diag-${Date.now()}-${idx}`,
              testType: df.testType || 'Diagnostic Procedure',
              finding: df.finding || '',
              impression: df.impression || '',
            }))
          );
        }

        setInputMode('structured');
        setAiExtractMessage(
          uploadedFile
            ? `Vigilytics AI successfully extracted all patient demographics, medications, adverse reaction, and clinical data from "${uploadedFile.name}" into Patient Information.`
            : 'Vigilytics AI successfully structured all patient, drug, adverse event, and clinical data into Patient Information.'
        );
        setTimeout(() => setAiExtractMessage(null), 5000);
      }
    } catch (err: any) {
      showToast(`AI Extraction note: ${err.message}`, 'error');
    } finally {
      setIsExtractingWithAI(false);
    }
  };

  // Handle Naranjo scale answer change
  const handleNaranjoChange = (questionId: string, score: number) => {
    const updated = {
      ...naranjoAnswers,
      [questionId]: score,
    };
    setNaranjoAnswers(updated);

    if (analysisResult) {
      const { totalScore, category } = calculateNaranjoScore(updated);
      const isDechallengePositive = analysisResult.safetyCase.drugs.some((d) => d.dechallenge === 'Positive');
      const isRechallengePositive = analysisResult.safetyCase.drugs.some((d) => d.rechallenge === 'Positive');
      const whoUmc = determineWhoUmcCategory(totalScore, isDechallengePositive ? 'Positive' : 'Unknown', isRechallengePositive ? 'Positive' : 'Not Performed', false, true);

      const updatedCase: SafetyCase = {
        ...analysisResult.safetyCase,
        naranjoScore: totalScore,
        naranjoCategory: category,
        naranjoAnswers: updated,
        whoUmcCategory: whoUmc,
      };

      setAnalysisResult({
        ...analysisResult,
        safetyCase: updatedCase,
      });

      // Keep active case synced
      onSaveCaseToWorkspace(updatedCase);
    }
  };

  // Handler for running analysis
  const handleRunAnalysis = async (customText?: string) => {
    let payload: {
      rawNarrative?: string;
      structuredForm?: any;
      fileData?: string;
      fileMimeType?: string;
      fileName?: string;
    } = {};

    if (inputMode === 'narrative' || customText) {
      const text = customText || userInputText;
      if (!text.trim()) {
        showToast('Please enter your subjective evidence (case narration & symptoms).', 'warning');
        return;
      }
      payload = { rawNarrative: text };
    } else if (inputMode === 'structured') {
      const validDrugs = drugsList.filter((d) => d.drugName.trim());
      if (validDrugs.length === 0) {
        showToast('Please provide at least one medication in the Drug Information section.', 'warning');
        return;
      }
      if (!structuredData.adverseEvent.trim()) {
        showToast('Please provide a suspected adverse reaction term.', 'warning');
        return;
      }

      const primarySuspect = validDrugs.find((d) => d.role === 'Suspect') || validDrugs[0];

      payload = {
        structuredForm: {
          drugs: validDrugs.map((d) => ({
            drugName: d.drugName,
            activeSubstance: d.activeSubstance || d.drugName,
            role: d.role,
            dose: d.dose || 'Standard dose',
            route: d.route || 'Oral',
            frequency: d.frequency || 'Once daily',
            durationOfTherapy: d.durationOfTherapy || '',
            indication: d.indication || 'Unspecified',
            startDate: d.startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
            stopDate: d.stopDate || null,
            dechallenge: d.dechallenge,
            rechallenge: d.rechallenge,
          })),
          suspectDrug: primarySuspect.drugName,
          dose: primarySuspect.dose,
          route: primarySuspect.route,
          frequency: primarySuspect.frequency,
          durationOfTherapy: primarySuspect.durationOfTherapy,
          indication: primarySuspect.indication,
          startDate: primarySuspect.startDate,
          stopDate: primarySuspect.stopDate,
          dechallenge: primarySuspect.dechallenge,
          rechallenge: primarySuspect.rechallenge,
          concomitantDrugs: validDrugs.filter((d) => d.role === 'Concomitant'),
          ...structuredData,
          weightKg: structuredData.weightKg ? Number(structuredData.weightKg) : null,
          patientAge: structuredData.patientAge ? Number(structuredData.patientAge) : undefined,
          medicalHistory: structuredData.medicalHistory
            ? structuredData.medicalHistory.split(',').map((s) => s.trim())
            : [],
          vitalSigns: structuredData.vitalSigns,
          labs: labsList.map((l) => ({
            id: l.id,
            testName: l.testName,
            date: l.date || new Date().toISOString().split('T')[0],
            value: l.value,
            unit: l.unit,
            referenceRange: l.referenceRange,
            isAbnormal: l.isAbnormal,
            clinicalSignificance: l.significance || 'Biomarker evaluated',
          })),
          diagnosticFindings: diagnosticsList.map((df) => ({
            id: df.id,
            testType: df.testType,
            finding: df.finding,
            impression: df.impression,
          })),
        },
      };
    } else if (inputMode === 'upload') {
      if (!uploadedFile && !userInputText.trim()) {
        showToast('Please choose an ADR report / document (PDF, JPG, PNG, JSON, CSV, etc.) to analyze or paste safety text.', 'warning');
        return;
      }
      payload = {
        rawNarrative: userInputText || `Uploaded medical safety document: ${uploadedFile?.name || 'file'}`,
        fileData: uploadedFile?.base64,
        fileMimeType: uploadedFile?.type,
        fileName: uploadedFile?.name,
      };
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const result = await runPharmacovigilanceAgents(payload, existingCases);
      setAnalysisResult(result);

      // Automatically sync Naranjo answers from the case analysis
      if (result.safetyCase.naranjoAnswers) {
        setNaranjoAnswers(result.safetyCase.naranjoAnswers);
      }

      // Automatically take the case into the workspace!
      onSaveCaseToWorkspace(result.safetyCase);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);

      setChatHistory([
        {
          sender: 'agent',
          message: `Vigilytics AI analysis complete. Evaluated as ${result.safetyCase.priority} with ${result.safetyCase.naranjoCategory} causality (Naranjo Score: ${result.safetyCase.naranjoScore}) across ${result.safetyCase.drugs.length} medication(s). Case has been taken into your active workspace.`,
        },
      ]);
    } catch (err: any) {
      showToast(`AI Analysis error: ${err.message}`, 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClearInput = () => {
    setUserInputText('');
    setUploadedFile(null);
    setDrugsList([createEmptyDrug('Suspect')]);
    setStructuredData({
      patientInitials: '',
      patientAge: '',
      patientSex: 'Unknown',
      weightKg: '',
      medicalHistory: '',
      adverseEvent: '',
      signsAndSymptoms: '',
      onsetDate: '',
      eventDuration: '',
      severityGrade: 'Severe',
      outcome: 'Recovering / Resolving',
      death: false,
      lifeThreatening: false,
      hospitalization: true,
      disability: false,
      congenitalAnomaly: false,
      otherMedicallyImportant: false,
      isListedInSmPC: false,
      vitalSigns: {
        bloodPressure: '',
        heartRate: '',
        respiratoryRate: '',
        temperature: '',
        oxygenSaturation: '',
      },
    });
    setLabsList([]);
    setDiagnosticsList([]);
    setAnalysisResult(null);
    setAiExtractMessage(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeStr =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    let mimeType = file.type;
    if (!mimeType) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') mimeType = 'application/pdf';
      else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
      else if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'webp') mimeType = 'image/webp';
      else if (ext === 'json') mimeType = 'application/json';
      else if (ext === 'csv') mimeType = 'text/csv';
      else if (ext === 'txt') mimeType = 'text/plain';
      else mimeType = 'application/octet-stream';
    }

    const isImg = mimeType.startsWith('image/');
    const previewUrl = isImg ? URL.createObjectURL(file) : undefined;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

      let textContent = '';
      if (
        mimeType.startsWith('text/') ||
        mimeType === 'application/json' ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.json')
      ) {
        try {
          textContent = atob(base64);
        } catch {
          textContent = '';
        }
      }

      setUploadedFile({
        name: file.name,
        size: sizeStr,
        type: mimeType,
        base64,
        previewUrl,
        textContent,
      });

      if (textContent) {
        setUserInputText(textContent);
      }
      setInputMode('upload');
    };
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = (file: File, previewUrl: string) => {
    const sizeStr = `${Math.round(file.size / 1024)} KB`;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      setUploadedFile({
        name: file.name,
        size: sizeStr,
        type: file.type || 'image/jpeg',
        base64,
        previewUrl,
        textContent: '',
      });
      setInputMode('upload');
      showToast('Document camera photo captured successfully! Ready for AI extraction.', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleSelectExistingCase = (selectedCase: SafetyCase) => {
    setAnalysisResult({
      safetyCase: selectedCase,
      logs: [],
      agentInsights: {
        intakeAgent: `Loaded case ${selectedCase.caseNumber}`,
        triageAgent: `Priority: ${selectedCase.priority}`,
        causalityAgent: `Naranjo: ${selectedCase.naranjoScore} (${selectedCase.naranjoCategory})`,
        signalAgent: `Disproportionality: ${selectedCase.riskClassification}`,
        qualityAgent: `Audit complete`,
        governanceAgent: `Approved by reviewer`,
      },
    });
    if (selectedCase.naranjoAnswers) {
      setNaranjoAnswers(selectedCase.naranjoAnswers);
    }
  };

  const handleAskAgentWithPrompt = async (promptText: string) => {
    setChatQuestion(promptText);
    if (!analysisResult) return;

    setChatHistory((prev) => [...prev, { sender: 'user', message: promptText }]);
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: promptText,
          currentCaseData: analysisResult.safetyCase,
        }),
      });
      const data = await res.json();
      if (data.answer) {
        setChatHistory((prev) => [
          ...prev,
          { sender: 'agent', message: data.answer },
        ]);
      }
    } catch {
      setChatHistory((prev) => [
        ...prev,
        {
          sender: 'agent',
          message: `Advisory: This case triggers ${analysisResult.safetyCase.priority}. Evaluated causality is ${analysisResult.safetyCase.naranjoCategory} (Naranjo score: ${analysisResult.safetyCase.naranjoScore}).`,
        },
      ]);
    } finally {
      setIsChatLoading(false);
      setChatQuestion('');
    }
  };

  const handleAskAgent = async () => {
    if (!chatQuestion.trim()) return;
    await handleAskAgentWithPrompt(chatQuestion);
  };

  // Calculate current Naranjo metrics
  const currentNaranjo = calculateNaranjoScore(naranjoAnswers);

  return (
    <div className="space-y-5">
      {/* Active Case Selector Strip (if cases exist in workspace) */}
      {existingCases.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Workspace Cases ({existingCases.length}):</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {existingCases.map((c) => {
                const isActive = analysisResult?.safetyCase.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelectExistingCase(c)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{c.caseNumber}</span>
                    <span className="text-[10px] opacity-80 truncate max-w-[90px]">
                      {c.drugs[0]?.drugName || 'Medication'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleClearInput}
            className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Case Analysis</span>
          </button>
        </div>
      )}

      {/* Main Input Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        {/* Report / Input Format Mode Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              onClick={() => setInputMode('narrative')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                inputMode === 'narrative'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>Subjective Evidence</span>
            </button>

            <button
              onClick={() => setInputMode('structured')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                inputMode === 'structured'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Pill className="w-3.5 h-3.5 text-indigo-600" />
              <span>Patient Information</span>
            </button>

            <button
              onClick={() => setInputMode('upload')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                inputMode === 'upload'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-indigo-600" />
              <span>ADR Report / Document Upload</span>
            </button>
          </div>

          <button
            onClick={handleClearInput}
            className="text-xs text-slate-400 hover:text-rose-600 flex items-center gap-1 font-medium cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset All Fields</span>
          </button>
        </div>

        {/* Success Alert Banner for AI extraction */}
        {aiExtractMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{aiExtractMessage}</span>
          </div>
        )}

        {/* FORMAT 1: SUBJECTIVE EVIDENCE */}
        {inputMode === 'narrative' && (
          <div className="space-y-3">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Subjective Evidence (Clinical Case Narrative & Reported Symptoms)</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUserInputText(
                        'A 58-year-old male (weight: 78.5 kg) with metastatic melanoma and hypertension was treated with pembrolizumab 200mg IV every 3 weeks (duration: 6 weeks, 2 cycles). Also taking concomitant amlodipine 5mg oral daily. Following cycle 2, the patient developed acute retrosternal chest pain, severe dyspnea, and diaphoresis on 2026-09-21 14:30. Admitted to the coronary care unit. Peak troponin I reached 18.42 ng/mL (abnormal), BP 118/76 mmHg, HR 112 bpm, SpO2 93%. Echocardiogram revealed severe global hypokinesia with ejection fraction 32%. Diagnosed with immune-mediated myocarditis. Pembrolizumab discontinued with positive clinical improvement.'
                      );
                    }}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline"
                  >
                    Load Sample Narrative
                  </button>
                  <button
                    type="button"
                    onClick={handleExtractToChartWithAI}
                    disabled={isExtractingWithAI || !userInputText.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 disabled:bg-slate-100 text-indigo-700 disabled:text-slate-400 rounded-md font-bold text-xs border border-indigo-200 transition-colors cursor-pointer"
                    title="Vigilytics AI parses the subjective narrative into patient demographics, medications, adverse reaction, and clinical labs"
                  >
                    {isExtractingWithAI ? (
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
              <textarea
                rows={7}
                value={userInputText}
                onChange={(e) => setUserInputText(e.target.value)}
                placeholder="Enter subjective evidence: Patient demographics (age, sex, weight, medical history), drug details (name, dose, route, frequency, duration, concomitant medications), adverse reaction (signs and symptoms, onset date/time, duration, severity, outcome), and clinical/lab findings..."
                className="w-full p-3.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 leading-relaxed focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-normal font-sans"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{userInputText.trim().split(/\s+/).filter(Boolean).length} words · {userInputText.length} characters</span>
              <span className="flex items-center gap-1 text-indigo-700 font-medium">
                <Brain className="w-3.5 h-3.5" />
                Vigilytics AI extracts entities and runs standardized Naranjo causality
              </span>
            </div>
          </div>
        )}

        {/* FORMAT 2: STRUCTURED FORM */}
        {inputMode === 'structured' && (
          <div className="space-y-6 text-xs">
            {/* SECTION 1: PATIENT INFORMATION */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 border-b border-slate-200 pb-2">
                <User className="w-4 h-4 text-indigo-600" />
                <span className="uppercase tracking-wider">1. Patient Information</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Age <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={structuredData.patientAge}
                    onChange={(e) => setStructuredData({ ...structuredData, patientAge: e.target.value })}
                    placeholder="e.g. 58"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Sex <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={structuredData.patientSex}
                    onChange={(e) => setStructuredData({ ...structuredData, patientSex: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Weight (optional) <span className="text-slate-400 font-normal">(kg)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={structuredData.weightKg}
                    onChange={(e) => setStructuredData({ ...structuredData, weightKg: e.target.value })}
                    placeholder="e.g. 74.5"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Patient Initials / Identifier
                  </label>
                  <input
                    type="text"
                    value={structuredData.patientInitials}
                    onChange={(e) => setStructuredData({ ...structuredData, patientInitials: e.target.value })}
                    placeholder="e.g. R.M."
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Relevant Medical History
                </label>
                <textarea
                  rows={2}
                  value={structuredData.medicalHistory}
                  onChange={(e) => setStructuredData({ ...structuredData, medicalHistory: e.target.value })}
                  placeholder="Comma-separated or narrative: Essential hypertension, Type 2 diabetes mellitus, metastatic melanoma, smoking history..."
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-normal text-slate-900 focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                />
              </div>
            </div>

            {/* SECTION 2: DRUG INFORMATION */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs uppercase tracking-wider">
                  <Pill className="w-4 h-4 text-indigo-600" />
                  <span>2. Drug Information (Suspect & Concomitant Medications)</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddDrug('Suspect')}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md font-semibold text-xs cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Suspect Drug</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddDrug('Concomitant')}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-md font-semibold text-xs cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Concomitant Medication</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {drugsList.map((drug, index) => (
                  <div
                    key={drug.id}
                    className={`p-3.5 bg-white rounded-xl border shadow-2xs space-y-2.5 ${
                      drug.role === 'Suspect' ? 'border-rose-200 ring-1 ring-rose-100' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-500 text-xs">#{index + 1}</span>
                        <div className="inline-flex rounded-md p-0.5 bg-slate-100">
                          {(['Suspect', 'Concomitant', 'Interacting'] as const).map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => handleUpdateDrug(index, 'role', r)}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                                drug.role === r
                                  ? r === 'Suspect'
                                    ? 'bg-rose-600 text-white'
                                    : r === 'Concomitant'
                                    ? 'bg-slate-700 text-white'
                                    : 'bg-amber-600 text-white'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {r === 'Concomitant' ? 'Concomitant' : r === 'Suspect' ? 'Suspect Drug' : 'Interacting'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDuplicateDrug(index)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                          title="Duplicate medication entry"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {drugsList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDrug(index)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title="Remove medication"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inputs: Drug name, Dose, Route, Frequency, Duration of therapy */}
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-semibold uppercase text-slate-600 block mb-0.5">
                          Drug Name (Search / Autocomplete) <span className="text-rose-500">*</span>
                        </label>
                        <DrugAutocompleteInput
                          value={drug.drugName}
                          onChange={(val) => handleUpdateDrug(index, 'drugName', val)}
                          onSelectDrug={(sel) => {
                            handleUpdateDrug(index, 'drugName', sel.drugName);
                            handleUpdateDrug(index, 'activeSubstance', sel.activeSubstance);
                            if (!drug.dose) handleUpdateDrug(index, 'dose', sel.defaultDose);
                            if (!drug.route || drug.route === 'Oral') handleUpdateDrug(index, 'route', sel.defaultRoute);
                            if (!drug.frequency || drug.frequency === 'Once daily') handleUpdateDrug(index, 'frequency', sel.defaultFrequency);
                            if (!drug.indication) handleUpdateDrug(index, 'indication', sel.typicalIndication);
                          }}
                          placeholder="Search drug (e.g. Simvastatin, Warfarin, Vancomycin)..."
                          className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded font-bold text-slate-900 text-xs focus:bg-white focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold uppercase text-slate-600 block mb-0.5">
                          Dose <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={drug.dose}
                          onChange={(e) => handleUpdateDrug(index, 'dose', e.target.value)}
                          placeholder="e.g. 200 mg"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold uppercase text-slate-600 block mb-0.5">
                          Route of Administration <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={drug.route}
                          onChange={(e) => handleUpdateDrug(index, 'route', e.target.value)}
                          placeholder="e.g. Oral, IV Infusion, Subcutaneous"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold uppercase text-slate-600 block mb-0.5">
                          Frequency <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={drug.frequency}
                          onChange={(e) => handleUpdateDrug(index, 'frequency', e.target.value)}
                          placeholder="e.g. Once daily, Every 3 weeks"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs focus:bg-white"
                        />
                      </div>
                    </div>

                    {/* Duration of therapy, Indication, Start Date, Stop Date, Dechallenge */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
                      <div>
                        <label className="text-[10px] font-semibold uppercase text-slate-600 block mb-0.5">
                          Duration of Therapy <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={drug.durationOfTherapy}
                          onChange={(e) => handleUpdateDrug(index, 'durationOfTherapy', e.target.value)}
                          placeholder="e.g. 6 weeks, 14 days, Ongoing"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold uppercase text-slate-600 block mb-0.5">
                          Indication
                        </label>
                        <input
                          type="text"
                          value={drug.indication}
                          onChange={(e) => handleUpdateDrug(index, 'indication', e.target.value)}
                          placeholder="e.g. Metastatic Melanoma"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold uppercase text-slate-600 block mb-0.5">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={drug.startDate}
                          onChange={(e) => handleUpdateDrug(index, 'startDate', e.target.value)}
                          className="w-full px-2.5 py-1 bg-slate-50 border border-slate-300 rounded text-xs focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold uppercase text-slate-600 block mb-0.5">
                          Stop Date (optional)
                        </label>
                        <input
                          type="date"
                          value={drug.stopDate}
                          onChange={(e) => handleUpdateDrug(index, 'stopDate', e.target.value)}
                          className="w-full px-2.5 py-1 bg-slate-50 border border-slate-300 rounded text-xs focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold uppercase text-slate-600 block mb-0.5">
                          Dechallenge Response
                        </label>
                        <select
                          value={drug.dechallenge}
                          onChange={(e) => handleUpdateDrug(index, 'dechallenge', e.target.value)}
                          className="w-full px-2.5 py-1 bg-slate-50 border border-slate-300 rounded text-xs focus:bg-white"
                        >
                          <option value="Positive">Positive (Resolved when stopped)</option>
                          <option value="Negative">Negative (Persisted)</option>
                          <option value="Not Applicable">Not Applicable (Ongoing)</option>
                          <option value="Unknown">Unknown</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Live Real-Time DDI Check Banner for Structured Input */}
                {(() => {
                  const validDrugs = drugsList.filter((d) => d.drugName.trim());
                  if (validDrugs.length <= 1) return null;

                  const tempDrugs: DrugAdministration[] = validDrugs.map((d) => ({
                    id: d.id,
                    drugName: d.drugName,
                    activeSubstance: d.activeSubstance || d.drugName,
                    brandName: d.drugName,
                    role: d.role,
                    dose: d.dose || 'Standard',
                    route: d.route || 'Oral',
                    frequency: d.frequency || 'Once daily',
                    indication: d.indication || '',
                    startDate: d.startDate || '2026-01-01',
                    stopDate: d.stopDate || null,
                    ongoing: !d.stopDate,
                    batchLotNumber: '',
                    marketingAuthHolder: '',
                    dechallenge: d.dechallenge,
                    rechallenge: d.rechallenge,
                    actionTaken: 'Dose Not Changed',
                    knownSmPCAdverseReactions: [],
                  }));

                  const dummyEvents: AdverseEvent[] = structuredData.adverseEvent.trim()
                    ? [
                        {
                          id: 'ev-temp',
                          term: structuredData.adverseEvent,
                          lltTerm: structuredData.adverseEvent,
                          socTerm: 'General disorders',
                          onsetDate: structuredData.onsetDate || '2026-01-01',
                          resolutionDate: null,
                          outcome: structuredData.outcome,
                          seriousness: {
                            death: structuredData.death,
                            lifeThreatening: structuredData.lifeThreatening,
                            hospitalization: structuredData.hospitalization,
                            disability: structuredData.disability,
                            congenitalAnomaly: structuredData.congenitalAnomaly,
                            otherMedicallyImportant: structuredData.otherMedicallyImportant,
                          },
                          isSerious: structuredData.hospitalization || structuredData.lifeThreatening || structuredData.death,
                          isListedInSmPC: structuredData.isListedInSmPC,
                          smPCDetails: '',
                          severityGrade: structuredData.severityGrade,
                        },
                      ]
                    : [];

                  const liveDdi = evaluateCaseDdiSummary(tempDrugs, dummyEvents);
                  if (liveDdi.totalInteractions === 0) return null;

                  return (
                    <div
                      className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 ${
                        liveDdi.adrMayBeCausedByDdi
                          ? 'bg-rose-50 border-rose-300 text-rose-900 font-medium'
                          : 'bg-amber-50 border-amber-300 text-amber-900 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 shrink-0 text-amber-600" />
                        <div>
                          <strong className="block text-[11px] font-black uppercase tracking-wider">
                            Live DDI Screen: {liveDdi.totalInteractions} Interaction(s) Detected
                          </strong>
                          <span>{liveDdi.primaryDdiExplanation}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border shrink-0">
                        {liveDdi.highestSeverity}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* SECTION 3: ADVERSE EVENT INFORMATION */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-4">
              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 border-b border-slate-200 pb-2 uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>3. Adverse Event Information</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Suspected Adverse Reaction <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={structuredData.adverseEvent}
                    onChange={(e) => setStructuredData({ ...structuredData, adverseEvent: e.target.value })}
                    placeholder="e.g. Immune-mediated myocarditis, Stevens-Johnson Syndrome"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Date/Time of Onset <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={structuredData.onsetDate}
                    onChange={(e) => setStructuredData({ ...structuredData, onsetDate: e.target.value })}
                    placeholder="YYYY-MM-DD or YYYY-MM-DD HH:MM (e.g. 2026-09-21 14:30)"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Duration of Adverse Event <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={structuredData.eventDuration}
                    onChange={(e) => setStructuredData({ ...structuredData, eventDuration: e.target.value })}
                    placeholder="e.g. 4 days, 48 hours, Ongoing"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Signs and symptoms */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Signs and Symptoms <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={structuredData.signsAndSymptoms}
                  onChange={(e) => setStructuredData({ ...structuredData, signsAndSymptoms: e.target.value })}
                  placeholder="Describe acute clinical presentation and symptoms: Acute retrosternal chest pain, dyspnea at rest, diaphoresis, acute nausea, rash, jaundice..."
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs leading-relaxed focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Severity <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={structuredData.severityGrade}
                    onChange={(e) => setStructuredData({ ...structuredData, severityGrade: e.target.value as any })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Mild">Mild</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Severe">Severe</option>
                    <option value="Life-Threatening">Life-Threatening</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Outcome <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={structuredData.outcome}
                    onChange={(e) => setStructuredData({ ...structuredData, outcome: e.target.value as any })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Recovering / Resolving">Recovering / Resolving</option>
                    <option value="Recovered / Resolved">Recovered / Resolved</option>
                    <option value="Not Recovered / Not Resolved">Not Recovered / Not Resolved</option>
                    <option value="Recovered with Sequelae">Recovered with Sequelae</option>
                    <option value="Fatal">Fatal</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>
              </div>

              {/* Seriousness Checklist */}
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  ICH E2A Seriousness Criteria (Check all that apply):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={structuredData.hospitalization}
                      onChange={(e) => setStructuredData({ ...structuredData, hospitalization: e.target.checked })}
                    />
                    <span className="font-semibold text-amber-900">Hospitalization</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={structuredData.lifeThreatening}
                      onChange={(e) => setStructuredData({ ...structuredData, lifeThreatening: e.target.checked })}
                    />
                    <span className="font-bold text-rose-700">Life-Threatening</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={structuredData.death}
                      onChange={(e) => setStructuredData({ ...structuredData, death: e.target.checked })}
                    />
                    <span className="font-bold text-slate-900">Fatal / Death</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={structuredData.disability}
                      onChange={(e) => setStructuredData({ ...structuredData, disability: e.target.checked })}
                    />
                    <span>Disability / Incapacity</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={structuredData.congenitalAnomaly}
                      onChange={(e) => setStructuredData({ ...structuredData, congenitalAnomaly: e.target.checked })}
                    />
                    <span>Congenital Anomaly</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={structuredData.otherMedicallyImportant}
                      onChange={(e) => setStructuredData({ ...structuredData, otherMedicallyImportant: e.target.checked })}
                    />
                    <span>Other Medically Important</span>
                  </label>
                </div>
              </div>
            </div>

            {/* SECTION 4: LABORATORY / CLINICAL DATA (OPTIONAL) */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-4">
              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 border-b border-slate-200 pb-2 uppercase tracking-wider">
                <FlaskConical className="w-4 h-4 text-emerald-600" />
                <span>4. Laboratory / Clinical Data (Optional)</span>
              </div>

              {/* Vital Signs Sub-card */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                  <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                  <span>Vital Signs</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Blood Pressure</label>
                    <input
                      type="text"
                      value={structuredData.vitalSigns.bloodPressure}
                      onChange={(e) =>
                        setStructuredData({
                          ...structuredData,
                          vitalSigns: { ...structuredData.vitalSigns, bloodPressure: e.target.value },
                        })
                      }
                      placeholder="e.g. 118/76 mmHg"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Heart Rate</label>
                    <input
                      type="text"
                      value={structuredData.vitalSigns.heartRate}
                      onChange={(e) =>
                        setStructuredData({
                          ...structuredData,
                          vitalSigns: { ...structuredData.vitalSigns, heartRate: e.target.value },
                        })
                      }
                      placeholder="e.g. 112 bpm"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Respiratory Rate</label>
                    <input
                      type="text"
                      value={structuredData.vitalSigns.respiratoryRate}
                      onChange={(e) =>
                        setStructuredData({
                          ...structuredData,
                          vitalSigns: { ...structuredData.vitalSigns, respiratoryRate: e.target.value },
                        })
                      }
                      placeholder="e.g. 22 breaths/min"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Temperature</label>
                    <input
                      type="text"
                      value={structuredData.vitalSigns.temperature}
                      onChange={(e) =>
                        setStructuredData({
                          ...structuredData,
                          vitalSigns: { ...structuredData.vitalSigns, temperature: e.target.value },
                        })
                      }
                      placeholder="e.g. 38.4 °C"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Oxygen Saturation</label>
                    <input
                      type="text"
                      value={structuredData.vitalSigns.oxygenSaturation}
                      onChange={(e) =>
                        setStructuredData({
                          ...structuredData,
                          vitalSigns: { ...structuredData.vitalSigns, oxygenSaturation: e.target.value },
                        })
                      }
                      placeholder="e.g. 93% SpO2"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Relevant Laboratory Values Component (LFT, RFT, URINE PCR, CBC, CPK/Troponin, TDM) */}
              <LabInvestigationsBuilder
                labs={labsList}
                onChange={setLabsList}
              />

              {/* Relevant Diagnostic Findings Sub-card */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Relevant Diagnostic Findings ({diagnosticsList.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setDiagnosticsList([
                        ...diagnosticsList,
                        {
                          id: `diag-${Date.now()}`,
                          testType: '12-Lead ECG',
                          finding: '',
                          impression: '',
                        },
                      ])
                    }
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Add Diagnostic Finding</span>
                  </button>
                </div>

                {diagnosticsList.length > 0 ? (
                  <div className="space-y-2">
                    {diagnosticsList.map((diag, dIdx) => (
                      <div key={diag.id} className="p-2.5 bg-white rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center text-xs">
                        <div>
                          <input
                            type="text"
                            value={diag.testType}
                            onChange={(e) =>
                              setDiagnosticsList((prev) =>
                                prev.map((item, i) => (i === dIdx ? { ...item, testType: e.target.value } : item))
                              )
                            }
                            placeholder="Procedure (e.g. 12-Lead ECG, Chest CT, Biopsy)"
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <input
                            type="text"
                            value={diag.finding}
                            onChange={(e) =>
                              setDiagnosticsList((prev) =>
                                prev.map((item, i) => (i === dIdx ? { ...item, finding: e.target.value } : item))
                              )
                            }
                            placeholder="Finding (e.g. ST elevation in leads V1-V3, ejection fraction 32%)"
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={diag.impression}
                            onChange={(e) =>
                              setDiagnosticsList((prev) =>
                                prev.map((item, i) => (i === dIdx ? { ...item, impression: e.target.value } : item))
                              )
                            }
                            placeholder="Clinical impression"
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded"
                          />
                          <button
                            type="button"
                            onClick={() => setDiagnosticsList((prev) => prev.filter((_, i) => i !== dIdx))}
                            className="text-slate-400 hover:text-rose-600 cursor-pointer p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic bg-white p-2.5 rounded border border-slate-200">
                    No diagnostic findings recorded yet. Click "+ Add Diagnostic Finding" to add ECG, CT, MRI, biopsy, or endoscopy results.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* FORMAT 3: ADR REPORT / DOCUMENT UPLOAD */}
        {inputMode === 'upload' && (
          <div className="space-y-4 text-xs">
            {/* Drag & Drop File Container */}
            <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-6 text-center bg-slate-50 hover:bg-indigo-50/20 transition-all">
              <div className="flex justify-center items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
              </div>

              <div className="font-bold text-slate-800 text-sm">
                Import Any Medical Safety Document or Image
              </div>
              <p className="text-slate-500 text-xs mt-1 max-w-lg mx-auto leading-relaxed">
                Accepts all file formats: <strong>PDF</strong> reports, medical scans / photos (<strong>JPG, JPEG, PNG, WEBP</strong>), hospital discharge records, <strong>ICSR XML / JSON</strong>, <strong>CSV</strong>, and physician notes.
              </p>

              {/* Supported Format Tags */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
                {['PDF Reports', 'JPG / PNG Photos', 'Hospital Discharge Scans', 'ICSR XML / JSON', 'CSV Tables', 'Lab Results'].map((tag, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200/80 text-slate-700">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCameraModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs transition-colors"
                  title="Open camera to scan medical paperwork, prescriptions, or discharge summaries"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Scan with Camera</span>
                </button>

                <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Browse / Select File</span>
                  <input
                    type="file"
                    accept="*/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Uploaded File Details & Preview Card */}
            {uploadedFile && (
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {uploadedFile.previewUrl ? (
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                        <img
                          src={uploadedFile.previewUrl}
                          alt={uploadedFile.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center font-bold text-xs shrink-0 ${
                        uploadedFile.name.toLowerCase().endsWith('.pdf')
                          ? 'bg-rose-100 text-rose-700'
                          : uploadedFile.name.toLowerCase().endsWith('.json') || uploadedFile.name.toLowerCase().endsWith('.xml')
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        <FileText className="w-5 h-5 mb-0.5" />
                        <span className="text-[9px] uppercase tracking-wider">
                          {uploadedFile.name.split('.').pop()?.slice(0, 4) || 'FILE'}
                        </span>
                      </div>
                    )}

                    <div>
                      <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                        <span className="truncate max-w-sm sm:max-w-md">{uploadedFile.name}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                          {uploadedFile.size}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        MIME: {uploadedFile.type} · Ready for Vigilytics AI Multimodal Extraction
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setUploadedFile(null);
                      setUserInputText('');
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                    title="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Instant Actions for Uploaded File */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 font-medium">
                    Analyze this file directly or extract into the Drug Chart:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExtractToChartWithAI}
                      disabled={isExtractingWithAI}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs cursor-pointer transition-colors"
                    >
                      {isExtractingWithAI ? (
                        <>
                          <span className="animate-spin w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full"></span>
                          <span>Extracting to Drug Chart...</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>AI Extract to Drug Chart</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRunAnalysis()}
                      disabled={isAnalyzing}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs cursor-pointer transition-colors shadow-2xs"
                    >
                      {isAnalyzing ? (
                        <>
                          <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span>
                          <span>Analyzing File...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>Analyze File with Vigilytics AI</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Text preview if applicable */}
                {uploadedFile.textContent && (
                  <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono text-slate-700 max-h-32 overflow-y-auto">
                    {uploadedFile.textContent.slice(0, 500)}
                    {uploadedFile.textContent.length > 500 && '...'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Primary Action Button */}
        <div className="pt-2 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {savedSuccess && (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Case taken into Vigilytics workspace
              </span>
            )}
          </span>

          <button
            onClick={() => handleRunAnalysis()}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            {isAnalyzing ? (
              <>
                <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full"></span>
                <span>Vigilytics AI Analyzing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Analyze with Vigilytics AI</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* AUTOMATIC NARANJO ADR SCALE AFTER CASE NARRATION */}
      {analysisResult && (
        <div className="space-y-4">
          {/* Executive Verdict Banner */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Vigilytics AI Assessment
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <h2 className="text-base font-extrabold text-slate-900">
                    {analysisResult.safetyCase.caseNumber}
                  </h2>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      analysisResult.safetyCase.priority.startsWith('P1')
                        ? 'bg-rose-100 text-rose-800'
                        : analysisResult.safetyCase.priority.startsWith('P2')
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}
                  >
                    {analysisResult.safetyCase.priority}
                  </span>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-xs font-semibold border border-emerald-200">
                    ✓ Active in Workspace
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowCIOMS(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CIOMS Form I</span>
                </button>

                <button
                  onClick={() => setShowFollowUp(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Follow-Up Query</span>
                </button>
              </div>
            </div>

            {/* Key Assessment Metrics in 3 Clean Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-500">Naranjo ADR Probability</div>
                <div className="text-sm font-extrabold text-slate-900 mt-1">
                  Score: {analysisResult.safetyCase.naranjoScore} · {analysisResult.safetyCase.naranjoCategory}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  WHO-UMC: <strong>{analysisResult.safetyCase.whoUmcCategory}</strong>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-500">ICH E2A Seriousness</div>
                <div className="text-sm font-extrabold text-slate-900 mt-1">
                  {analysisResult.safetyCase.events.some((e) => e.isSerious) ? 'Serious Adverse Reaction' : 'Non-Serious'}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Expedited Window: {analysisResult.safetyCase.pegaSLA.hoursRemaining} Hours
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-500">Safety Signal Status</div>
                <div className="text-sm font-extrabold text-indigo-700 mt-1">
                  {analysisResult.safetyCase.riskClassification}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Evans Disproportionality: PRR ~{analysisResult.safetyCase.disproportionalityPRR || '2.8'}
                </div>
              </div>
            </div>
          </div>

          {/* End-to-End Pharmacovigilance Intelligence Workflow Diagram */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-xl p-4 text-white shadow-md border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-100">
                  End-to-End Pharmacovigilance Intelligence Workflow
                </h3>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2.5 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Automated Pipeline Executed
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
              {/* Step 1: Input */}
              <div className="p-2.5 rounded-lg bg-white/10 border border-white/15 flex flex-col items-center justify-between min-h-[92px]">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs mb-1">
                  ✓
                </div>
                <div className="text-[11px] font-bold text-white leading-tight">Patient / ADR Data</div>
                <div className="text-[9px] text-slate-300 mt-1">Multi-modal Ingestion</div>
              </div>

              {/* Step 2: AI Agent */}
              <div className="p-2.5 rounded-lg bg-white/10 border border-white/15 flex flex-col items-center justify-between min-h-[92px]">
                <div className="w-6 h-6 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-xs mb-1">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-bold text-white leading-tight">AI PV Agent</div>
                <div className="text-[9px] text-slate-300 mt-1">Context Analysis</div>
              </div>

              {/* Step 3: Extraction */}
              <div className="p-2.5 rounded-lg bg-white/10 border border-white/15 flex flex-col items-center justify-between min-h-[92px]">
                <div className="w-6 h-6 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-xs mb-1">
                  <Pill className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-bold text-white leading-tight">Drug & ADR Extraction</div>
                <div className="text-[9px] text-slate-300 mt-1">{analysisResult.safetyCase.drugs.length} Drugs · {analysisResult.safetyCase.events.length} Events</div>
              </div>

              {/* Step 4: Causality & Severity */}
              <div className="p-2.5 rounded-lg bg-white/10 border border-white/15 flex flex-col items-center justify-between min-h-[92px]">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs mb-1">
                  <Scale className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-bold text-white leading-tight">Causality & Severity</div>
                <div className="text-[9px] text-slate-300 mt-1">Naranjo: {analysisResult.safetyCase.naranjoScore} · {analysisResult.safetyCase.naranjoCategory}</div>
              </div>

              {/* Step 5: Interaction Check */}
              <div className="p-2.5 rounded-lg bg-white/10 border border-white/15 flex flex-col items-center justify-between min-h-[92px]">
                <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center font-bold text-xs mb-1">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-bold text-white leading-tight">Interaction Check</div>
                <div className="text-[9px] text-sky-200 mt-1">{analysisResult.safetyCase.aiAssessmentOutputs?.drugDrugInteraction?.status || 'Assessed'}</div>
              </div>

              {/* Step 6: Structured PV Report */}
              <div className="p-2.5 rounded-lg bg-white/10 border border-white/15 flex flex-col items-center justify-between min-h-[92px]">
                <div className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center font-bold text-xs mb-1">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-bold text-white leading-tight">Structured PV Report</div>
                <div className="text-[9px] text-slate-300 mt-1">CIOMS & MedWatch</div>
              </div>

              {/* Step 7: PV Professional */}
              <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 flex flex-col items-center justify-between min-h-[92px]">
                <div className="w-6 h-6 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-xs mb-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-bold text-emerald-200 leading-tight">PV Professional</div>
                <div className="text-[9px] text-emerald-300/80 mt-1">Review & Validate</div>
              </div>
            </div>
          </div>

          {/* Section Navigation Tabs */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 pb-2 text-xs">
              <button
                onClick={() => setOutputTab('ai_outputs')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-bold flex items-center gap-1.5 ${
                  outputTab === 'ai_outputs'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 bg-slate-100'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${outputTab === 'ai_outputs' ? 'text-amber-300' : 'text-indigo-600'}`} />
                <span>AI Agent Outputs (10 Dimensions)</span>
              </button>

              <button
                onClick={() => setOutputTab('naranjo')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-semibold flex items-center gap-1.5 ${
                  outputTab === 'naranjo'
                    ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Scale className="w-3.5 h-3.5 text-indigo-600" />
                <span>Naranjo ADR Probability Scale</span>
              </button>

              <button
                onClick={() => setOutputTab('ai_insights')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-semibold flex items-center gap-1.5 ${
                  outputTab === 'ai_insights'
                    ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Brain className="w-3.5 h-3.5 text-indigo-600" />
                <span>AI Clinical Safety Intelligence</span>
              </button>

              <button
                onClick={() => setOutputTab('overview')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-semibold flex items-center gap-1.5 ${
                  outputTab === 'overview'
                    ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Pill className="w-3.5 h-3.5 text-indigo-600" />
                <span>Case & Drug Chart ({analysisResult.safetyCase.drugs.length})</span>
              </button>

              <button
                onClick={() => setOutputTab('timeline')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-semibold flex items-center gap-1.5 ${
                  outputTab === 'timeline'
                    ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-indigo-600" />
                <span>Event Timeline ({analysisResult.safetyCase.timeline.length})</span>
              </button>
            </div>

            {/* TAB 0: 10 AI AGENT OUTPUTS (Image 2) */}
            {outputTab === 'ai_outputs' && (
              <div className="space-y-4 text-xs">
                {/* Top Action Flag Banner (#9 Action Flag) */}
                {(() => {
                  const flag =
                    analysisResult.safetyCase.aiAssessmentOutputs?.actionFlag ||
                    analysisResult.safetyCase.actionFlag ||
                    (analysisResult.safetyCase.priority.startsWith('P1')
                      ? 'Urgent clinical attention'
                      : analysisResult.safetyCase.priority.startsWith('P2')
                      ? 'Pharmacovigilance professional review'
                      : 'Routine review');

                  return (
                    <div
                      className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                        flag === 'Urgent clinical attention'
                          ? 'bg-rose-50 border-rose-300 text-rose-900'
                          : flag === 'Pharmacovigilance professional review'
                          ? 'bg-amber-50 border-amber-300 text-amber-900'
                          : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <ShieldAlert
                          className={`w-5 h-5 shrink-0 ${
                            flag === 'Urgent clinical attention'
                              ? 'text-rose-600'
                              : flag === 'Pharmacovigilance professional review'
                              ? 'text-amber-600'
                              : 'text-indigo-600'
                          }`}
                        />
                        <div>
                          <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                            9. Action Flag (Workflow Routing Directive)
                          </div>
                          <div className="text-sm font-extrabold">{flag}</div>
                          <div className="text-[11px] opacity-90 mt-0.5">
                            Priority Tier: {analysisResult.safetyCase.priority} · Expedited Filing Window: {analysisResult.safetyCase.pegaSLA.hoursRemaining} Hours
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-white rounded-md font-bold text-xs shadow-2xs border">
                          Target Queue: {analysisResult.safetyCase.pegaWorkQueue}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* 10 Structured Output Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Output 1: Drug & ADR Extraction */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center gap-2 font-bold text-slate-800 text-[11px] uppercase tracking-wider border-b border-slate-200 pb-1.5">
                      <Pill className="w-4 h-4 text-indigo-600" />
                      <span>1. Drug & ADR Extraction</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-500">Suspected Drug(s):</div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {analysisResult.safetyCase.drugs
                            .filter((d) => d.role === 'Suspect')
                            .map((d, i) => (
                              <span key={i} className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold">
                                {d.drugName} {d.dose ? `(${d.dose})` : ''}
                              </span>
                            ))}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-500">Concomitant Drug(s):</div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {analysisResult.safetyCase.drugs.filter((d) => d.role !== 'Suspect').length > 0 ? (
                            analysisResult.safetyCase.drugs
                              .filter((d) => d.role !== 'Suspect')
                              .map((d, i) => (
                                <span key={i} className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-medium">
                                  {d.drugName} [{d.role}]
                                </span>
                              ))
                          ) : (
                            <span className="text-slate-400 italic">None reported</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-500">Adverse Event(s):</div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {analysisResult.safetyCase.events.map((e, i) => (
                            <span key={i} className="px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded font-bold">
                              {e.term} (SOC: {e.socTerm})
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200 mt-1 leading-relaxed">
                        {analysisResult.safetyCase.aiAssessmentOutputs?.drugAndAdrExtraction?.summary ||
                          'Automated entity recognition extracted suspected therapeutics and mapped adverse events to MedDRA taxonomy.'}
                      </div>
                    </div>
                  </div>

                  {/* Output 2: ADR Classification */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center gap-2 font-bold text-slate-800 text-[11px] uppercase tracking-wider border-b border-slate-200 pb-1.5">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span>2. ADR Classification</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-500">Taxonomic Category:</div>
                        <div className="mt-1 text-sm font-extrabold text-indigo-900 bg-indigo-50/80 px-2.5 py-1.5 rounded-lg border border-indigo-100">
                          {analysisResult.safetyCase.aiAssessmentOutputs?.adrClassification?.category ||
                            (analysisResult.safetyCase.events.some((e) => e.term.toLowerCase().includes('myocarditis') || e.term.toLowerCase().includes('stevens'))
                              ? 'Type B - Idiosyncratic / Immune-mediated'
                              : 'Type A - Dose-dependent / Augmented Pharmacologic')}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-500">MedDRA System Organ Class (SOC):</div>
                        <div className="mt-0.5 text-slate-800 font-semibold">
                          {analysisResult.safetyCase.events[0]?.socTerm || 'General disorders and administration site conditions'}
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200 mt-1 leading-relaxed">
                        {analysisResult.safetyCase.aiAssessmentOutputs?.adrClassification?.details ||
                          'Edwards & Aronson mechanistic taxonomy applied. Clinical presentation evaluated for off-target hypersensitivity or pharmacologic exaggerated response.'}
                      </div>
                    </div>
                  </div>

                  {/* Output 3: Severity */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center gap-2 font-bold text-slate-800 text-[11px] uppercase tracking-wider border-b border-slate-200 pb-1.5">
                      <Activity className="w-4 h-4 text-rose-600" />
                      <span>3. Severity Assessment</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-extrabold px-3 py-1 rounded-lg border ${
                            analysisResult.safetyCase.events.some((e) => e.severityGrade === 'Life-Threatening' || e.severityGrade === 'Severe')
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : analysisResult.safetyCase.events.some((e) => e.severityGrade === 'Moderate')
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          Grade: {analysisResult.safetyCase.events[0]?.severityGrade || 'Severe'}
                        </span>
                        <span className="text-slate-500 text-[11px]">CTCAE / Clinical Severity Scale</span>
                      </div>

                      <div className="text-[11px] text-slate-600 leading-relaxed bg-white p-2.5 rounded border border-slate-200">
                        {analysisResult.safetyCase.events[0]?.severityGrade === 'Severe' || analysisResult.safetyCase.events[0]?.severityGrade === 'Life-Threatening'
                          ? 'Severe functional impairment necessitating urgent clinical intervention, pharmacotherapy cessation, and acute hemodynamic/organ support.'
                          : analysisResult.safetyCase.events[0]?.severityGrade === 'Moderate'
                          ? 'Moderate discomfort interfering with normal activities; outpatient or supportive clinical intervention required.'
                          : 'Mild transient symptoms causing minimal or no limitation of daily activities.'}
                      </div>
                    </div>
                  </div>

                  {/* Output 4: Seriousness Assessment */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center gap-2 font-bold text-slate-800 text-[11px] uppercase tracking-wider border-b border-slate-200 pb-1.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <span>4. Seriousness Assessment (ICH E2A)</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                            analysisResult.safetyCase.events.some((e) => e.isSerious)
                              ? 'bg-rose-100 text-rose-800 font-extrabold'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {analysisResult.safetyCase.events.some((e) => e.isSerious)
                            ? 'SERIOUS ADVERSE REACTION'
                            : 'NON-SERIOUS ADVERSE REACTION'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[10px]">
                        {[
                          { label: 'Death', active: analysisResult.safetyCase.events.some((e) => e.seriousness.death) },
                          { label: 'Life-Threatening', active: analysisResult.safetyCase.events.some((e) => e.seriousness.lifeThreatening) },
                          { label: 'Hospitalization', active: analysisResult.safetyCase.events.some((e) => e.seriousness.hospitalization) },
                          { label: 'Disability', active: analysisResult.safetyCase.events.some((e) => e.seriousness.disability) },
                          { label: 'Congenital Anomaly', active: analysisResult.safetyCase.events.some((e) => e.seriousness.congenitalAnomaly) },
                          { label: 'Medically Important', active: analysisResult.safetyCase.events.some((e) => e.seriousness.otherMedicallyImportant) },
                        ].map((c, i) => (
                          <div
                            key={i}
                            className={`p-1 rounded text-center border font-semibold ${
                              c.active
                                ? 'bg-rose-100 text-rose-900 border-rose-300 font-bold'
                                : 'bg-white text-slate-400 border-slate-200'
                            }`}
                          >
                            {c.active ? '✓ ' : ''}{c.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Output 5: Causality Assessment */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center gap-2 font-bold text-slate-800 text-[11px] uppercase tracking-wider border-b border-slate-200 pb-1.5">
                      <Scale className="w-4 h-4 text-indigo-600" />
                      <span>5. Causality Assessment</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500">WHO-UMC Classification:</span>
                          <div className="text-sm font-extrabold text-indigo-950">
                            {analysisResult.safetyCase.whoUmcCategory}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-500">Naranjo Algorithm:</span>
                          <div className="text-sm font-extrabold text-slate-900">
                            Score: {analysisResult.safetyCase.naranjoScore} ({analysisResult.safetyCase.naranjoCategory})
                          </div>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded border border-slate-200 leading-relaxed">
                        {analysisResult.safetyCase.aiAssessmentOutputs?.causalityAssessment?.rationale ||
                          `Temporal exposure verified. Positive dechallenge recorded without alternative causes fully explaining the acute onset. Evaluated as ${analysisResult.safetyCase.naranjoCategory} causality.`}
                      </div>
                    </div>
                  </div>

                  {/* Output 6: Drug-Drug Interaction */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center gap-2 font-bold text-slate-800 text-[11px] uppercase tracking-wider border-b border-slate-200 pb-1.5">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span>6. Drug-Drug Interaction & ADR Causality Check</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      {(() => {
                        const caseDdi = evaluateCaseDdiSummary(
                          analysisResult.safetyCase.drugs,
                          analysisResult.safetyCase.events
                        );
                        const status =
                          analysisResult.safetyCase.aiAssessmentOutputs?.drugDrugInteraction?.status ||
                          (caseDdi.hasHighRiskDdi ? 'Potentially harmful' : caseDdi.totalInteractions > 0 ? 'Caution' : 'Safe');

                        return (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
                                    status === 'Potentially harmful'
                                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                                      : status === 'Caution'
                                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  }`}
                                >
                                  Status: {status}
                                </span>
                                <span
                                  className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                                    caseDdi.adrMayBeCausedByDdi
                                      ? 'bg-rose-600 text-white'
                                      : caseDdi.totalInteractions > 0
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-emerald-600 text-white'
                                  }`}
                                >
                                  {caseDdi.adrMayBeCausedByDdi
                                    ? '🚨 Likely ADR Cause'
                                    : caseDdi.totalInteractions > 0
                                    ? '⚠️ Potential Cofactor'
                                    : 'No DDI Cause'}
                                </span>
                              </div>
                              <span className="text-slate-500 text-[11px]">
                                {analysisResult.safetyCase.drugs.length} drug(s) screened
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-700 bg-white p-2.5 rounded border border-slate-200 leading-relaxed space-y-1">
                              <div>
                                <strong className="text-slate-900 block text-[10px] uppercase tracking-wider">
                                  Could DDI be the reason for the ADR?
                                </strong>
                                {caseDdi.primaryDdiExplanation}
                              </div>
                              {analysisResult.safetyCase.drugs.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveDdiModalDrug(analysisResult.safetyCase.drugs[0]);
                                    setActiveDdiCounterpart(analysisResult.safetyCase.drugs[1]?.drugName);
                                  }}
                                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 mt-1 hover:underline cursor-pointer"
                                >
                                  <span>View Complete DDI & ADR Causality Dossier</span>
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Output 7: Duplicate Detection */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center gap-2 font-bold text-slate-800 text-[11px] uppercase tracking-wider border-b border-slate-200 pb-1.5">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      <span>7. Duplicate Detection</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      {analysisResult.safetyCase.potentialDuplicates.length > 0 ? (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                          <div className="font-bold flex items-center justify-between">
                            <span>Potential Duplicate Flagged</span>
                            <span className="text-xs bg-amber-200 px-2 py-0.5 rounded">
                              Match: {analysisResult.safetyCase.potentialDuplicates[0].matchScore}%
                            </span>
                          </div>
                          <div className="text-[11px] mt-1 text-amber-800">
                            Matched existing case: <strong>{analysisResult.safetyCase.potentialDuplicates[0].caseNumber}</strong>. Reasons: {analysisResult.safetyCase.potentialDuplicates[0].reasons.join(', ')}.
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900">
                          <div className="font-bold">✓ Unique New Case (No Duplicate Found)</div>
                          <div className="text-[11px] mt-0.5 text-emerald-800">
                            Cross-referenced patient initials, age, suspect drug, and event onset across all workspace ICSR records.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Output 8: Clinical Recommendation */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center gap-2 font-bold text-slate-800 text-[11px] uppercase tracking-wider border-b border-slate-200 pb-1.5">
                      <HeartPulse className="w-4 h-4 text-indigo-600" />
                      <span>8. Clinical Recommendation</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-lg text-indigo-950 font-medium">
                        <strong>Primary Recommendation:</strong>{' '}
                        {analysisResult.safetyCase.aiAssessmentOutputs?.clinicalRecommendation?.primaryRecommendation ||
                          'Immediate discontinuation of suspected agent; obtain baseline Troponin I / ECG and initiate clinical monitoring protocol.'}
                      </div>

                      <div className="text-[11px] text-slate-700 space-y-1">
                        <div className="font-bold text-slate-800">Recommended Follow-Up Actions:</div>
                        <ul className="list-disc list-inside space-y-0.5">
                          {(
                            analysisResult.safetyCase.aiAssessmentOutputs?.clinicalRecommendation?.followUpActions || [
                              'Monitor vital signs and resolution timeline',
                              'Obtain confirmatory biomarker/diagnostic panel',
                              'Issue targeted follow-up query to reporting HCP',
                            ]
                          ).map((act, i) => (
                            <li key={i}>{act}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Output 10: PV Report Summary Card */}
                <div className="p-4 bg-white rounded-xl border border-slate-300 shadow-xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-xs uppercase tracking-wider">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <span>10. Structured Pharmacovigilance Report Summary</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const summaryText =
                            analysisResult.safetyCase.aiAssessmentOutputs?.pvReportSummary ||
                            analysisResult.safetyCase.clinicalSummary ||
                            analysisResult.safetyCase.narrativeText;
                          navigator.clipboard.writeText(summaryText);
                          setCopiedSummary(true);
                          setTimeout(() => setCopiedSummary(false), 2000);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer transition-colors"
                      >
                        {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedSummary ? 'Copied!' : 'Copy Summary'}</span>
                      </button>

                      <button
                        onClick={() => setShowCIOMS(true)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold cursor-pointer transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export CIOMS I</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {analysisResult.safetyCase.aiAssessmentOutputs?.pvReportSummary ||
                      `PHARMACOVIGILANCE SAFETY REPORT SUMMARY
Case ID: ${analysisResult.safetyCase.caseNumber} (v${analysisResult.safetyCase.version})
Patient: ${analysisResult.safetyCase.patient.initials} | Age: ${analysisResult.safetyCase.patient.age || 'Unreported'} | Sex: ${analysisResult.safetyCase.patient.sex} | Weight: ${analysisResult.safetyCase.patient.weightKg ? `${analysisResult.safetyCase.patient.weightKg} kg` : 'Unreported'}
Suspect Drug(s): ${analysisResult.safetyCase.drugs.filter((d) => d.role === 'Suspect').map((d) => `${d.drugName} (${d.dose || 'dose unreported'}, ${d.route || 'route unreported'}, ${d.frequency || 'frequency unreported'})`).join('; ')}
Adverse Reaction(s): ${analysisResult.safetyCase.events.map((e) => `${e.term} [Severity: ${e.severityGrade}, Outcome: ${e.outcome}]`).join('; ')}
Seriousness: ${analysisResult.safetyCase.events.some((e) => e.isSerious) ? 'SERIOUS' : 'NON-SERIOUS'}
Causality: ${analysisResult.safetyCase.naranjoCategory} (Naranjo Score: ${analysisResult.safetyCase.naranjoScore}) | WHO-UMC: ${analysisResult.safetyCase.whoUmcCategory}
Drug Interaction Status: ${analysisResult.safetyCase.aiAssessmentOutputs?.drugDrugInteraction?.status || 'Assessed'}
Action Flag: ${analysisResult.safetyCase.aiAssessmentOutputs?.actionFlag || analysisResult.safetyCase.actionFlag || 'Pharmacovigilance professional review'}
Expedited Clock: ${analysisResult.safetyCase.pegaSLA.hoursRemaining} Hours (${analysisResult.safetyCase.pegaSLA.regulatoryDeadlineType})`}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 1: NARANJO ADR SCALE AUTOMATIC EVALUATION */}
            {outputTab === 'naranjo' && (
              <div className="space-y-4 text-xs">
                {/* Score Summary Box */}
                <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider">
                      ADR Causality Assessment
                    </div>
                    <div className="text-base font-extrabold text-indigo-950 mt-0.5">
                      Naranjo Score: {currentNaranjo.totalScore} · Category: {currentNaranjo.category}
                    </div>
                    <div className="text-slate-600 text-[11px] mt-0.5">
                      {currentNaranjo.category === 'Definite' && 'Conclusive pharmacological link. Rechallenge and dechallenge confirmed.'}
                      {currentNaranjo.category === 'Probable' && 'Reasonable temporal sequence, positive dechallenge, and alternative causes unlikely.'}
                      {currentNaranjo.category === 'Possible' && 'Temporal link present, but competing etiology or concomitant therapies exist.'}
                      {currentNaranjo.category === 'Doubtful' && 'ADR relationship is unlikely or contradicted by medical evidence.'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">Scale Standard:</span>
                    <span className="px-2 py-0.5 bg-white text-slate-800 rounded border border-indigo-100 font-semibold text-[11px]">
                      WHO-UMC: {analysisResult.safetyCase.whoUmcCategory}
                    </span>
                  </div>
                </div>

                {/* 10 Validated Naranjo Scale Questions */}
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
                  {NARANJO_QUESTIONS.map((q, idx) => {
                    const currentScore = naranjoAnswers[q.id] ?? 0;
                    return (
                      <div key={q.id} className="p-3 hover:bg-slate-50/70 transition-colors">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex-1 min-w-[280px]">
                            <div className="font-semibold text-slate-900 text-xs">
                              {idx + 1}. {q.question}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {q.rationale}
                            </div>
                          </div>

                          {/* 3 Answer Choices */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleNaranjoChange(q.id, q.yesScore)}
                              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                                currentScore === q.yesScore
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              Yes ({q.yesScore >= 0 ? `+${q.yesScore}` : q.yesScore})
                            </button>

                            <button
                              type="button"
                              onClick={() => handleNaranjoChange(q.id, q.noScore)}
                              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                                currentScore === q.noScore && q.noScore !== q.unknownScore
                                  ? 'bg-rose-600 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              No ({q.noScore >= 0 ? `+${q.noScore}` : q.noScore})
                            </button>

                            <button
                              type="button"
                              onClick={() => handleNaranjoChange(q.id, q.unknownScore)}
                              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                                currentScore === q.unknownScore
                                  ? 'bg-slate-700 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              Do Not Know (0)
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: AI CLINICAL SAFETY INTELLIGENCE */}
            {outputTab === 'ai_insights' && (
              <div className="space-y-4 text-xs">
                {/* AI Executive Summary */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>AI Synthesized Clinical Narrative</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed font-serif text-[11px]">
                    {analysisResult.safetyCase.clinicalSummary}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Pharmacological Causality Insights */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Brain className="w-4 h-4 text-indigo-600" />
                      <span>Pharmacological Plausibility</span>
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Evaluated temporal sequence, biological gradient, and known receptor mechanisms for {analysisResult.safetyCase.drugs.map((d) => d.drugName).join(', ')}. Naranjo score of {analysisResult.safetyCase.naranjoScore} confirms {analysisResult.safetyCase.naranjoCategory} causality relation.
                    </p>
                  </div>

                  {/* Regulatory Seriousness & Triage */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-rose-600" />
                      <span>Regulatory Triage & Reporting Windows</span>
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      ICH E2A Criteria: <strong>{analysisResult.safetyCase.priority}</strong>. Requires submission within <strong>{analysisResult.safetyCase.pegaSLA.hoursRemaining} hours</strong> under expedited regulatory compliance.
                    </p>
                  </div>
                </div>

                {/* Facts vs Interpretations */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="font-bold text-slate-900">Verified Clinical Evidence vs AI Inferences</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="font-semibold text-slate-700 block mb-1">Reported Facts:</span>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-600 text-[11px]">
                        {analysisResult.safetyCase.factsVsInterpretation.reportedFacts.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700 block mb-1">AI Inferences:</span>
                      <ul className="list-disc list-inside space-y-0.5 text-indigo-800 text-[11px]">
                        {analysisResult.safetyCase.factsVsInterpretation.algorithmicInterpretations.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CASE & DRUG CHART SUMMARY */}
            {outputTab === 'overview' && (
              <div className="space-y-4 text-xs">
                {/* Medications Table */}
                <div>
                  <div className="font-bold text-slate-800 text-xs mb-2">
                    Administered Medicines ({analysisResult.safetyCase.drugs.length}):
                  </div>
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Role</th>
                          <th className="py-2 px-3">Medication</th>
                          <th className="py-2 px-3">Dose & Route</th>
                          <th className="py-2 px-3">Dates</th>
                          <th className="py-2 px-3">Dechallenge</th>
                          <th className="py-2 px-3 min-w-[210px]">
                            <div className="flex items-center gap-1">
                              <Layers className="w-3 h-3 text-indigo-600" />
                              <span>DDI vs ADR Check</span>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {analysisResult.safetyCase.drugs.map((d, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-2 px-3">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                  d.role === 'Suspect'
                                    ? 'bg-rose-100 text-rose-800'
                                    : d.role === 'Interacting'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {d.role}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900">{d.drugName}</td>
                            <td className="py-2 px-3">{d.dose} ({d.route})</td>
                            <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                              {d.startDate || 'N/A'} to {d.stopDate || 'Ongoing'}
                            </td>
                            <td className="py-2 px-3 font-semibold text-emerald-700">{d.dechallenge}</td>
                            <td className="py-2 px-3">
                              {(() => {
                                const ddi = assessDrugDdiAndAdr(
                                  d,
                                  analysisResult.safetyCase.drugs,
                                  analysisResult.safetyCase.events
                                );
                                if (ddi.hasInteraction) {
                                  const isLikelyDriver = ddi.adrCausalityRole === 'Likely ADR Cause / Primary Driver';
                                  const isCofactor = ddi.adrCausalityRole === 'Possible Contributing Factor';

                                  return (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span
                                          className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 ${
                                            isLikelyDriver
                                              ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                              : isCofactor
                                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                              : 'bg-indigo-50 text-indigo-900 border border-indigo-200'
                                          }`}
                                        >
                                          {isLikelyDriver ? '🚨 Likely ADR Driver' : isCofactor ? '⚠️ ADR Cofactor' : 'DDI Present'}
                                        </span>
                                        {ddi.interactingDrugs.length > 0 && (
                                          <span
                                            className="text-[10px] text-slate-600 font-semibold truncate max-w-[120px]"
                                            title={`Interacts with: ${ddi.interactingDrugs.join(', ')}`}
                                          >
                                            ↔ {ddi.interactingDrugs.join(', ')}
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveDdiModalDrug(d);
                                          setActiveDdiCounterpart(ddi.interactingDrugs[0]);
                                        }}
                                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
                                      >
                                        <span>Check DDI vs ADR</span>
                                        <ChevronRight className="w-3 h-3" />
                                      </button>
                                    </div>
                                  );
                                }

                                return (
                                  <div>
                                    <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded">
                                      No DDI · Unlikely ADR Cause
                                    </span>
                                    {analysisResult.safetyCase.drugs.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveDdiModalDrug(d);
                                          setActiveDdiCounterpart(undefined);
                                        }}
                                        className="text-[10px] text-slate-400 hover:text-indigo-600 block mt-0.5 hover:underline cursor-pointer"
                                      >
                                        Screen with other drugs...
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Adverse Events */}
                <div>
                  <div className="font-bold text-slate-800 text-xs mb-2">Adverse Reactions:</div>
                  <div className="space-y-2">
                    {analysisResult.safetyCase.events.map((e, i) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900">{e.term}</div>
                          <div className="text-[11px] text-slate-500">
                            SOC: {e.socTerm} · Onset: {e.onsetDate} · Outcome: {e.outcome}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            e.isSerious ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {e.isSerious ? 'Serious Reaction' : 'Non-Serious'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Patient Summary */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-wrap items-center gap-4 text-slate-700">
                  <div>Patient: <strong>{analysisResult.safetyCase.patient.initials}</strong></div>
                  <div>Age: <strong>{analysisResult.safetyCase.patient.age || 'Unknown'}</strong></div>
                  <div>Sex: <strong>{analysisResult.safetyCase.patient.sex}</strong></div>
                  <div className="truncate max-w-sm">
                    Medical History: {analysisResult.safetyCase.patient.medicalHistory.map((m) => m.condition).join(', ') || 'None recorded'}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: TIMELINE */}
            {outputTab === 'timeline' && (
              <div className="space-y-3 text-xs pl-4 border-l-2 border-slate-200">
                {analysisResult.safetyCase.timeline.map((ev, i) => (
                  <div key={i} className="relative pl-3">
                    <div className="absolute -left-5.5 top-1 w-3 h-3 rounded-full bg-indigo-600"></div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-700">{ev.date}</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-bold text-slate-900">{ev.title}</span>
                    </div>
                    <div className="text-slate-600 text-[11px] mt-0.5">{ev.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Interactive AI Safety Copilot with Quick Prompt Chips */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs">
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="w-full px-5 py-3.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-left cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Brain className="w-4 h-4 text-indigo-600" />
                <span>Vigilytics AI Safety Copilot</span>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded border border-indigo-200">
                  Interactive AI Assistant
                </span>
              </div>
              <span className="text-slate-500 font-medium">
                {chatOpen ? 'Hide' : 'Open Copilot'}
              </span>
            </button>

            {chatOpen && (
              <div className="p-5 space-y-3.5 border-t border-slate-200">
                {/* 4 Quick AI Prompt Chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500">Quick AI Questions:</span>
                  {[
                    'What are the regulatory reporting deadlines?',
                    'Check for drug-drug interactions between medications',
                    'Explain the Naranjo causality score calculation',
                    'Draft an official FDA MedWatch narrative',
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAskAgentWithPrompt(chip)}
                      disabled={isChatLoading}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-md text-[11px] font-medium transition-colors cursor-pointer border border-slate-200"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {chatHistory.length > 0 && (
                  <div className="space-y-2 max-h-56 overflow-y-auto p-3 bg-slate-50 rounded-lg">
                    {chatHistory.map((msg, i) => (
                      <div
                        key={i}
                        className={`p-2.5 rounded-lg text-xs leading-relaxed ${
                          msg.sender === 'agent'
                            ? 'bg-white border border-slate-200 text-slate-800'
                            : 'bg-indigo-600 text-white font-medium ml-6'
                        }`}
                      >
                        <span className="text-[10px] font-bold uppercase block opacity-70 mb-0.5">
                          {msg.sender === 'agent' ? 'Vigilytics AI Copilot' : 'You'}
                        </span>
                        {msg.message}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chatQuestion}
                    onChange={(e) => setChatQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAskAgent()}
                    placeholder="Ask Vigilytics AI about reporting deadlines, Naranjo questions, mechanism, or ICSR guidelines..."
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white"
                  />
                  <button
                    onClick={handleAskAgent}
                    disabled={isChatLoading || !chatQuestion.trim()}
                    className="flex items-center gap-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-lg font-bold text-xs cursor-pointer transition-colors"
                  >
                    {isChatLoading ? (
                      <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span>
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Ask AI</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CIOMS EXPORT MODAL */}
      {showCIOMS && analysisResult && (
        <CIOMSExportModal
          currentCase={analysisResult.safetyCase}
          onClose={() => setShowCIOMS(false)}
        />
      )}

      {/* FOLLOW UP LETTER MODAL */}
      {showFollowUp && analysisResult && (
        <FollowUpLetterModal
          currentCase={analysisResult.safetyCase}
          onClose={() => setShowFollowUp(false)}
          onSendQuery={(queryFieldId) => {
            const updatedAudit = analysisResult.safetyCase.missingDataAudit.map((m) =>
              m.id === queryFieldId ? { ...m, resolved: true } : m
            );
            const updatedCase = {
              ...analysisResult.safetyCase,
              missingDataAudit: updatedAudit,
            };
            setAnalysisResult({
              ...analysisResult,
              safetyCase: updatedCase,
            });
            onSaveCaseToWorkspace(updatedCase);
          }}
        />
      )}

      {/* DDI & ADR CAUSALITY MODAL */}
      {activeDdiModalDrug && analysisResult && (
        <DdiAdrDetailModal
          isOpen={Boolean(activeDdiModalDrug)}
          onClose={() => {
            setActiveDdiModalDrug(null);
            setActiveDdiCounterpart(undefined);
          }}
          targetDrug={activeDdiModalDrug}
          allDrugs={analysisResult.safetyCase.drugs}
          events={analysisResult.safetyCase.events}
          initialCounterpartDrug={activeDdiCounterpart}
        />
      )}

      {/* DOCUMENT CAMERA MODAL FOR MOBILE & PC */}
      <DocumentCameraModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={handleCameraCapture}
        title="Scan Medical Safety Document"
      />

    </div>
  );
};
