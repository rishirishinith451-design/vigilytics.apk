import React, { useState } from 'react';
import {
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  User,
  ShieldAlert,
  ArrowRight,
  GitMerge,
  HelpCircle,
  Copy,
  Download,
  Mail,
  Send,
  Pill,
  Activity,
  Award,
  Layers,
  CheckSquare,
  AlertOctagon,
  ExternalLink,
  Info,
  ChevronRight,
  Sparkles,
  FlaskConical,
  HeartPulse,
  Stethoscope,
  Check,
  Bot,
  ShieldCheck,
  Scale,
} from 'lucide-react';
import {
  SafetyCase,
  PegaStage,
  NaranjoCategory,
  MissingDataAudit,
  DuplicateMatch,
  DrugAdministration,
} from '../types/pv';
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
import { FollowUpLetterModal } from './FollowUpLetterModal';
import { CIOMSExportModal } from './CIOMSExportModal';
import { DdiAdrDetailModal } from './DdiAdrDetailModal';
import { showToast } from '../utils/toast';

interface CaseDetailViewProps {
  safetyCase: SafetyCase;
  allCases: SafetyCase[];
  onUpdateCase: (updatedCase: SafetyCase) => void;
  onAdvancePegaStage: (nextStage: PegaStage, nextStep: string) => void;
  onSelectCaseById: (caseId: string) => void;
}

export const CaseDetailView: React.FC<CaseDetailViewProps> = ({
  safetyCase,
  allCases,
  onUpdateCase,
  onAdvancePegaStage,
  onSelectCaseById,
}) => {
  if (!safetyCase) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
        <FileText className="w-10 h-10 mx-auto text-slate-400 mb-2" />
        <p className="font-semibold text-sm">No safety case selected</p>
        <p className="text-xs text-slate-400 mt-1">Select a case from the queue or start a new case analysis.</p>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<
    'overview' | 'products_events' | 'ai_assessment' | 'causality' | 'quality_duplicates' | 'governance' | 'audit_trail'
  >('overview');

  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showCIOMSModal, setShowCIOMSModal] = useState(false);

  // Drug-Drug Interaction Modal State
  const [activeDdiModalDrug, setActiveDdiModalDrug] = useState<DrugAdministration | null>(null);
  const [activeDdiCounterpart, setActiveDdiCounterpart] = useState<string | undefined>(undefined);
  const [pairwiseTestDrugA, setPairwiseTestDrugA] = useState<string>('');
  const [pairwiseTestDrugB, setPairwiseTestDrugB] = useState<string>('');

  // Human Sign-off Form state
  const [approverName, setApproverName] = useState('Dr. Marcus Vance, MD');
  const [approverRole, setApproverRole] = useState('Senior Qualified PV Medical Reviewer');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [signoffSuccess, setSignoffSuccess] = useState(false);

  // Handle Naranjo answer change
  const handleNaranjoChange = (questionId: string, score: number) => {
    const updatedAnswers = {
      ...(safetyCase.naranjoAnswers || {}),
      [questionId]: score,
    };
    const { totalScore, category } = calculateNaranjoScore(updatedAnswers);
    const updatedCase: SafetyCase = {
      ...safetyCase,
      naranjoScore: totalScore,
      naranjoCategory: category,
      naranjoAnswers: updatedAnswers,
      workflowHistory: [
        ...(safetyCase.workflowHistory || []),
        {
          timestamp: new Date().toISOString(),
          fromStage: safetyCase.pegaStage,
          toStage: safetyCase.pegaStage,
          step: 'Naranjo Score Recalculation',
          operator: 'Human Medical Officer',
          actionTaken: `Updated ${questionId} answer. Score recalculated to ${totalScore} (${category}).`,
          rationale: 'Clinical reviewer adjusted standardized causality algorithm question.',
        },
      ],
    };
    onUpdateCase(updatedCase);
  };

  // Handle Missing item query sent
  const handleResolveMissingItem = (itemId: string) => {
    const updatedAudit = (safetyCase.missingDataAudit || []).map((item) =>
      item.id === itemId ? { ...item, resolved: true } : item
    );
    const updatedCase: SafetyCase = {
      ...safetyCase,
      missingDataAudit: updatedAudit,
      workflowHistory: [
        ...(safetyCase.workflowHistory || []),
        {
          timestamp: new Date().toISOString(),
          fromStage: safetyCase.pegaStage,
          toStage: safetyCase.pegaStage,
          step: 'Targeted Query Transmitted',
          operator: 'PV Specialist',
          actionTaken: `Follow-up query sent for item ${itemId}.`,
          rationale: 'Regulatory query issued to primary reporter.',
        },
      ],
    };
    onUpdateCase(updatedCase);
  };

  // Handle Human Signoff Approval
  const handleAuthorizeSignoff = () => {
    const updatedCase: SafetyCase = {
      ...safetyCase,
      humanApproval: {
        status: 'Approved',
        reviewerName: approverName,
        reviewerRole: approverRole,
        decisionTimestamp: new Date().toISOString(),
        decisionNotes: approvalNotes || 'Case causality and seriousness certified. Approved for regulatory submission.',
        requiresSecondSignoff: safetyCase.humanApproval?.requiresSecondSignoff ?? false,
      },
      workflowHistory: [
        ...safetyCase.workflowHistory,
        {
          timestamp: new Date().toISOString(),
          fromStage: safetyCase.pegaStage,
          toStage: safetyCase.pegaStage,
          step: 'Authorized Human Sign-off Certified',
          operator: approverName,
          actionTaken: 'Human medical approval granted.',
          rationale: approvalNotes || 'ICH E2A / 21 CFR compliance review completed.',
          humanSignature: `${approverName} [DIGITAL STAMP: 21CFR11-${Date.now().toString(16)}]`,
        },
      ],
    };
    onUpdateCase(updatedCase);
    setSignoffSuccess(true);
    setTimeout(() => setSignoffSuccess(false), 3000);
  };

  // Find matching duplicate record if any
  const duplicateMatchRecord = safetyCase.potentialDuplicates[0]
    ? allCases.find((c) => c.caseNumber === safetyCase.potentialDuplicates[0].caseNumber)
    : null;

  return (
    <div className="space-y-6">
      {/* Top Clinical Case Action Ribbon */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-lg text-slate-900">{safetyCase.caseNumber}</span>
              <span className="text-xs text-slate-500">v{safetyCase.version}</span>
              <span className="text-slate-300">·</span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                  safetyCase.priority.startsWith('P1')
                    ? 'bg-rose-100 text-rose-800'
                    : safetyCase.priority.startsWith('P2')
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {safetyCase.priority}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-xs font-medium text-slate-600">
                {safetyCase.riskClassification}
              </span>
            </div>

            <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
              <span>Patient: <strong className="text-slate-800">{safetyCase.patient.initials}</strong> ({safetyCase.patient.age || 'Unknown'}yo {safetyCase.patient.sex})</span>
              <span>·</span>
              <span>Country: <strong className="text-slate-800">{safetyCase.country}</strong></span>
              <span>·</span>
              <span>Reporter: <strong className="text-slate-800">{safetyCase.reporterQualification}</strong> ({safetyCase.reportType})</span>
              <span>·</span>
              <span>Received: <strong className="text-slate-800">{safetyCase.initialReceivedDate.split('T')[0]}</strong></span>
            </div>
          </div>

          {/* Quick Action Ribbon Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCIOMSModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>CIOMS I Form</span>
            </button>

            <button
              onClick={() => setShowFollowUpModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Targeted Query Letter</span>
            </button>

            <button
              onClick={() => setActiveTab('governance')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-black rounded-md shadow-xs transition-colors cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Action Tray</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-t border-slate-100 mt-4 pt-3 overflow-x-auto text-xs font-medium">
          {[
            { id: 'overview', label: '1. Summary & Timeline', badge: null },
            { id: 'products_events', label: '2. Patient, Products & AEs', badge: `${safetyCase.drugs.length} Drugs / ${safetyCase.events.length} AEs` },
            { id: 'ai_assessment', label: '3. AI Agent Outputs (10 Dimensions)', badge: '10 Outputs' },
            { id: 'causality', label: '4. Causality & Evidence (Naranjo)', badge: `Score: ${safetyCase.naranjoScore}` },
            { id: 'quality_duplicates', label: '5. Quality & Duplicates', badge: safetyCase.potentialDuplicates.length > 0 ? 'Match Found' : null },
            { id: 'governance', label: '6. Actions & Governance', badge: safetyCase.humanApproval.status },
            { id: 'audit_trail', label: '7. Provenance & Audit Trail', badge: `${safetyCase.workflowHistory.length}` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === tab.id
                  ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-200 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-normal ${
                    activeTab === tab.id
                      ? 'bg-indigo-200/60 text-indigo-950 font-semibold'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Overview & Interactive Timeline */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Clinical Narrative & Summary Grid */}
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Concise Clinical Summary
                </h3>
                <p className="text-sm font-medium text-slate-900 mt-1 leading-relaxed">
                  {safetyCase.clinicalSummary}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Full ICSR Narrative Description
                </h3>
                <div className="mt-1 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-serif text-slate-800 leading-relaxed max-h-48 overflow-y-auto">
                  {safetyCase.narrativeText}
                </div>
              </div>

              {/* Source Provenance */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  Primary Source: <strong className="text-slate-700">{safetyCase.primarySource}</strong>
                </span>
                <span>
                  Reporter Qualification: <strong className="text-slate-700">{safetyCase.reporterQualification}</strong>
                </span>
              </div>
            </div>

            {/* Facts vs Interpretations vs Uncertainties (Mandatory brief requirement) */}
            <div className="col-span-12 lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                <Info className="w-4 h-4 text-indigo-600" />
                <span>Epistemic Distinction: Facts vs. AI Interpretation</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10px] font-bold uppercase text-slate-500">
                    Reported Factual Observations
                  </div>
                  <ul className="list-disc list-inside mt-1 text-[11px] text-slate-700 space-y-0.5">
                    {safetyCase.factsVsInterpretation.reportedFacts.map((fact, idx) => (
                      <li key={idx}>{fact}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-lg">
                  <div className="text-[10px] font-bold uppercase text-indigo-700">
                    Algorithmic & Statistical Inferences
                  </div>
                  <ul className="list-disc list-inside mt-1 text-[11px] text-indigo-900 space-y-0.5">
                    {safetyCase.factsVsInterpretation.algorithmicInterpretations.map((inf, idx) => (
                      <li key={idx}>{inf}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-lg">
                  <div className="text-[10px] font-bold uppercase text-amber-700">
                    Documented Clinical Uncertainties
                  </div>
                  <ul className="list-disc list-inside mt-1 text-[11px] text-amber-950 space-y-0.5">
                    {safetyCase.factsVsInterpretation.clinicalUncertainties.map((unc, idx) => (
                      <li key={idx}>{unc}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Clinical Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  Chronological Adverse Event Timeline
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sequential mapping of drug exposure, onset, intervention, and clinical outcomes.
                </p>
              </div>
              <span className="text-xs text-slate-500 font-mono">{safetyCase.timeline.length} Key Events</span>
            </div>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {safetyCase.timeline.map((event, idx) => (
                <div key={idx} className="relative group">
                  <div
                    className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center bg-white ${
                      event.alert
                        ? 'border-rose-500 ring-2 ring-rose-200'
                        : 'border-indigo-600'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        event.alert ? 'bg-rose-500' : 'bg-indigo-600'
                      }`}
                    ></span>
                  </div>

                  <div className="bg-slate-50 hover:bg-slate-100/80 transition-colors p-3.5 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-700">{event.date}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs font-bold text-slate-900">{event.title}</span>
                      </div>
                      {event.badgeText && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            event.alert
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {event.badgeText}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {event.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Products & Adverse Events */}
      {activeTab === 'products_events' && (
        <div className="space-y-6">
          {/* Patient Information Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-xs uppercase tracking-wider">
                <User className="w-4 h-4 text-indigo-600" />
                <span>Patient Information & Clinical Baseline</span>
              </div>
              <span className="text-[11px] text-slate-500">
                Initials: <strong className="text-slate-800">{safetyCase.patient.initials}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500">Age</span>
                <div className="font-bold text-slate-800 mt-0.5">{safetyCase.patient.age ? `${safetyCase.patient.age} Years` : 'Not Reported'}</div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500">Sex</span>
                <div className="font-bold text-slate-800 mt-0.5">{safetyCase.patient.sex}</div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500">Weight (kg)</span>
                <div className="font-bold text-slate-800 mt-0.5">
                  {safetyCase.patient.weightKg ? `${safetyCase.patient.weightKg} kg` : 'Optional / Not Reported'}
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500">Pregnancy Status</span>
                <div className="font-medium text-slate-800 mt-0.5">{safetyCase.patient.pregnancyStatus || 'Not Applicable'}</div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500">Renal Function</span>
                <div className="font-medium text-slate-800 mt-0.5">{safetyCase.patient.baselineOrganFunction?.renal || 'Normal'}</div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500">Hepatic Function</span>
                <div className="font-medium text-slate-800 mt-0.5">{safetyCase.patient.baselineOrganFunction?.hepatic || 'Normal'}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500">Relevant Medical History & Comorbidities</span>
                <div className="mt-1 text-slate-700">
                  {safetyCase.patient.medicalHistory.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {safetyCase.patient.medicalHistory.map((m, i) => (
                        <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-medium">
                          {m.condition} ({m.status})
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">None recorded</span>
                  )}
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500">Known Drug Allergies</span>
                <div className="mt-1 text-slate-700">
                  {safetyCase.patient.allergies && safetyCase.patient.allergies.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {safetyCase.patient.allergies.map((al, i) => (
                        <span key={i} className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded text-[11px] font-medium">
                          {al}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">No known drug allergies reported</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Suspect & Concomitant Drugs Table */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Pill className="w-4 h-4 text-indigo-600" />
              Suspected & Concomitant Medicinal Products ({safetyCase.drugs.length})
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Product Name & Substance</th>
                    <th className="py-2.5 px-3">Dose & Route</th>
                    <th className="py-2.5 px-3">Frequency & Duration</th>
                    <th className="py-2.5 px-3">Indication</th>
                    <th className="py-2.5 px-3">Therapy Dates</th>
                    <th className="py-2.5 px-3">Lot Number</th>
                    <th className="py-2.5 px-3">Dechallenge</th>
                    <th className="py-2.5 px-3">Rechallenge</th>
                    <th className="py-2.5 px-3 min-w-[210px]">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        <span>DDI vs ADR Check</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {safetyCase.drugs.map((drug) => (
                    <tr key={drug.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            drug.role === 'Suspect'
                              ? 'bg-rose-100 text-rose-800'
                              : drug.role === 'Interacting'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {drug.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{drug.drugName}</div>
                        <div className="text-[11px] text-slate-500">{drug.activeSubstance} ({drug.brandName})</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{drug.dose}</div>
                        <div className="text-slate-500 text-[11px]">{drug.route}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{drug.frequency || 'Unspecified'}</div>
                        <div className="text-slate-500 text-[11px]">{drug.durationOfTherapy || 'Duration: N/A'}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{drug.indication}</td>
                      <td className="py-2.5 px-3 text-slate-700 font-mono">
                        {drug.startDate} to {drug.stopDate || 'Ongoing'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{drug.batchLotNumber || 'Unknown'}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-semibold ${
                            drug.dechallenge === 'Positive'
                              ? 'text-emerald-700'
                              : drug.dechallenge === 'Negative'
                              ? 'text-rose-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {drug.dechallenge}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-semibold ${
                            drug.rechallenge === 'Positive'
                              ? 'text-rose-700 font-bold'
                              : 'text-slate-500'
                          }`}
                        >
                          {drug.rechallenge}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {(() => {
                          const ddi = assessDrugDdiAndAdr(drug, safetyCase.drugs, safetyCase.events);
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
                                    setActiveDdiModalDrug(drug);
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
                              {safetyCase.drugs.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveDdiModalDrug(drug);
                                    setActiveDdiCounterpart(undefined);
                                  }}
                                  className="text-[10px] text-slate-400 hover:text-indigo-600 block mt-0.5 hover:underline cursor-pointer"
                                >
                                  Screen other drugs...
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

          {/* Drug-Drug Interaction (DDI) & ADR Causality Intelligence Matrix */}
          {(() => {
            const caseDdiSummary = evaluateCaseDdiSummary(safetyCase.drugs, safetyCase.events);
            const counterpartOptions = safetyCase.drugs.map((d) => d.drugName);
            const activeDrugA = pairwiseTestDrugA || counterpartOptions[0] || '';
            const activeDrugB = pairwiseTestDrugB || (counterpartOptions[1] || counterpartOptions[0] || '');
            const livePairwise = activeDrugA && activeDrugB && activeDrugA !== activeDrugB
              ? assessPairwiseDdi(activeDrugA, activeDrugB, safetyCase.events)
              : null;

            return (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Drug-Drug Interaction (DDI) & ADR Causality Intelligence
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Automated pharmacovigilance screening: Can co-administered interactions explain or trigger the patient’s ADRs?
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
                        caseDdiSummary.adrMayBeCausedByDdi
                          ? 'bg-rose-100 text-rose-900 border-rose-300'
                          : caseDdiSummary.totalInteractions > 0
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      {caseDdiSummary.adrMayBeCausedByDdi
                        ? '🚨 DDI Likely Caused / Exacerbated ADR'
                        : caseDdiSummary.totalInteractions > 0
                        ? '⚠️ DDI Detected (Monitor Cofactors)'
                        : '✓ No High-Risk DDI Detected'}
                    </span>
                  </div>
                </div>

                {/* Case-Level Clinical Verdict */}
                <div
                  className={`p-3.5 rounded-lg border text-xs leading-relaxed ${
                    caseDdiSummary.adrMayBeCausedByDdi
                      ? 'bg-rose-50/70 border-rose-200 text-rose-950 font-medium'
                      : caseDdiSummary.totalInteractions > 0
                      ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <strong className="block mb-0.5 uppercase text-[10px] tracking-wider text-slate-500">
                    ADR Causality Assessment by DDI Engine:
                  </strong>
                  {caseDdiSummary.primaryDdiExplanation}
                </div>

                {/* Pairwise Interaction Testing Sandbox */}
                {counterpartOptions.length > 1 && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Interactive Pairwise DDI vs ADR Checker</span>
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Select two medications to test whether their interaction explains the ADRs
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                          First Medication (Drug A)
                        </label>
                        <select
                          value={activeDrugA}
                          onChange={(e) => setPairwiseTestDrugA(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                        >
                          {counterpartOptions.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                          Second Medication (Drug B)
                        </label>
                        <select
                          value={activeDrugB}
                          onChange={(e) => setPairwiseTestDrugB(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                        >
                          {counterpartOptions.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {livePairwise && (
                      <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2 text-xs">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{activeDrugA}</span>
                            <span className="text-slate-400">↔</span>
                            <span>{activeDrugB}</span>
                          </div>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                              livePairwise.hasInteraction
                                ? livePairwise.mayCauseAdr
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                          >
                            {livePairwise.hasInteraction
                              ? `${livePairwise.severity} (${livePairwise.adrCausalityRole})`
                              : 'No Established Interaction'}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {livePairwise.adrMatchExplanation}
                        </p>

                        {livePairwise.hasInteraction && (
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-mono text-[10px]">
                              Pathway: {livePairwise.cypOrTarget || livePairwise.mechanismType}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const found = safetyCase.drugs.find((d) => d.drugName === activeDrugA) || safetyCase.drugs[0];
                                setActiveDdiModalDrug(found);
                                setActiveDdiCounterpart(activeDrugB);
                              }}
                              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <span>Open Full Clinical DDI Dossier</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Adverse Events & Seriousness Table */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-rose-600" />
              Reported Adverse Reactions & Seriousness Criteria (ICH E2A)
            </h3>

            <div className="space-y-4">
              {safetyCase.events.map((event) => (
                <div key={event.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{event.term}</span>
                        <span className="text-xs text-slate-500 font-mono">(PT: {event.lltTerm})</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            event.isListedInSmPC
                              ? 'bg-slate-200 text-slate-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {event.isListedInSmPC ? 'Listed in SmPC' : 'UNLISTED / NEW RISK'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        System Organ Class (SOC): <strong className="text-slate-700">{event.socTerm}</strong> · Onset: <strong className="text-slate-700">{event.onsetDate}</strong> {event.eventDuration ? `· Duration: ${event.eventDuration}` : ''} · Outcome: <strong className="text-slate-700">{event.outcome}</strong>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded border border-rose-200">
                        Severity: {event.severityGrade}
                      </span>
                    </div>
                  </div>

                  {event.signsAndSymptoms && (
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-700">
                      <strong className="text-slate-900 text-[11px] uppercase tracking-wider block mb-0.5">Signs & Symptoms:</strong>
                      {event.signsAndSymptoms}
                    </div>
                  )}

                  {/* ICH E2A Seriousness checklist */}
                  <div className="pt-2 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                    <div className={`p-2 rounded border text-center ${event.seriousness.death ? 'bg-rose-100 text-rose-900 font-bold border-rose-300' : 'bg-white text-slate-400 border-slate-200'}`}>
                      Death
                    </div>
                    <div className={`p-2 rounded border text-center ${event.seriousness.lifeThreatening ? 'bg-rose-100 text-rose-900 font-bold border-rose-300' : 'bg-white text-slate-400 border-slate-200'}`}>
                      Life-Threatening
                    </div>
                    <div className={`p-2 rounded border text-center ${event.seriousness.hospitalization ? 'bg-amber-100 text-amber-900 font-bold border-amber-300' : 'bg-white text-slate-400 border-slate-200'}`}>
                      Hospitalization
                    </div>
                    <div className={`p-2 rounded border text-center ${event.seriousness.disability ? 'bg-amber-100 text-amber-900 font-bold border-amber-300' : 'bg-white text-slate-400 border-slate-200'}`}>
                      Disability
                    </div>
                    <div className={`p-2 rounded border text-center ${event.seriousness.congenitalAnomaly ? 'bg-rose-100 text-rose-900 font-bold border-rose-300' : 'bg-white text-slate-400 border-slate-200'}`}>
                      Congenital Anomaly
                    </div>
                    <div className={`p-2 rounded border text-center ${event.seriousness.otherMedicallyImportant ? 'bg-indigo-100 text-indigo-900 font-bold border-indigo-300' : 'bg-white text-slate-400 border-slate-200'}`}>
                      Medically Important
                    </div>
                  </div>

                  <div className="mt-2 text-[11px] text-slate-600 bg-white p-2.5 rounded border border-slate-200">
                    <strong className="text-slate-800">SmPC Labeledness Details:</strong> {event.smPCDetails}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Laboratory & Objective Diagnostic Tests */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-emerald-600" />
              Laboratory Values & Objective Clinical Data
            </h3>

            {/* Vital Signs (if present) */}
            {safetyCase.vitalSigns && Object.values(safetyCase.vitalSigns).some((v) => Boolean(v)) && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                  <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                  <span>Recorded Vital Signs</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Blood Pressure</span>
                    <strong className="text-slate-800">{safetyCase.vitalSigns.bloodPressure || 'N/A'}</strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Heart Rate</span>
                    <strong className="text-slate-800">{safetyCase.vitalSigns.heartRate || 'N/A'}</strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Respiratory Rate</span>
                    <strong className="text-slate-800">{safetyCase.vitalSigns.respiratoryRate || 'N/A'}</strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Temperature</span>
                    <strong className="text-slate-800">{safetyCase.vitalSigns.temperature || 'N/A'}</strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Oxygen Saturation</span>
                    <strong className="text-slate-800">{safetyCase.vitalSigns.oxygenSaturation || 'N/A'}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Diagnostic Findings */}
            {safetyCase.diagnosticFindings && safetyCase.diagnosticFindings.length > 0 && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                  <Stethoscope className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Diagnostic Findings & Procedures ({safetyCase.diagnosticFindings.length})</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  {safetyCase.diagnosticFindings.map((dg, idx) => (
                    <div key={idx} className="p-2.5 bg-white rounded border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <strong className="text-slate-900">{dg.testType}:</strong> <span className="text-slate-700">{dg.finding}</span>
                      </div>
                      {dg.impression && (
                        <span className="text-[11px] font-semibold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {dg.impression}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Laboratory Biomarkers */}
            {safetyCase.labResults.length > 0 ? (
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold uppercase text-slate-500">
                  Laboratory Biomarkers ({safetyCase.labResults.length})
                </div>
                {safetyCase.labResults.map((lab) => (
                  <div key={lab.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{lab.testName}</span>
                        <span className="text-[11px] text-slate-500 font-mono">({lab.date})</span>
                        {lab.isAbnormal && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                            ABNORMAL
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">{lab.clinicalSignificance}</div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold text-sm text-slate-900">
                        {lab.value} <span className="text-xs font-normal text-slate-500">{lab.unit}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">Ref: {lab.referenceRange}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic">No laboratory biomarker values reported for this case.</div>
            )}
          </div>
        </div>
      )}

      {/* Tab: AI Agent Outputs (10 Dimensions) */}
      {activeTab === 'ai_assessment' && (
        <div className="space-y-6">
          {/* End-to-End Workflow Diagram */}
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
                Workflow Pipeline Verified
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-white/10 border border-white/15 flex flex-col items-center justify-between min-h-[92px]">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs mb-1">
                  ✓
                </div>
                <div className="text-[11px] font-bold text-white leading-tight">Patient / ADR Data</div>
                <div className="text-[9px] text-slate-300 mt-1">Structured Ingestion</div>
              </div>

              <div className="p-2.5 rounded-lg bg-white/10 border border-white/15 flex flex-col items-center justify-between min-h-[92px]">
                <div className="w-6 h-6 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-xs mb-1">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-bold text-white leading-tight">AI PV Agent</div>
                <div className="text-[9px] text-slate-300 mt-1">Multi-modal AI</div>
              </div>

              <div className="p-2.5 rounded-lg bg-white/10 border border-white/15 flex flex-col items-center justify-between min-h-[92px]">
                <div className="w-6 h-6 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-xs mb-1">
                  <Pill className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-bold text-white leading-tight">Drug & ADR Extraction</div>
                <div className="text-[9px] text-slate-300 mt-1">{safetyCase.drugs.length} Drugs · {safetyCase.events.length} Events</div>
              </div>

              <div className="p-2.5 rounded-lg bg-white/10 border border-white/15 flex flex-col items-center justify-between min-h-[92px]">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs mb-1">
                  <Scale className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-bold text-white leading-tight">Causality & Severity</div>
                <div className="text-[9px] text-slate-300 mt-1">Naranjo: {safetyCase.naranjoScore} · {safetyCase.naranjoCategory}</div>
              </div>

              <div className="p-2.5 rounded-lg bg-white/10 border border-white/15 flex flex-col items-center justify-between min-h-[92px]">
                <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center font-bold text-xs mb-1">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-bold text-white leading-tight">Interaction Check</div>
                <div className="text-[9px] text-sky-200 mt-1">{safetyCase.aiAssessmentOutputs?.drugDrugInteraction?.status || 'Assessed'}</div>
              </div>

              <div className="p-2.5 rounded-lg bg-white/10 border border-white/15 flex flex-col items-center justify-between min-h-[92px]">
                <div className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center font-bold text-xs mb-1">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-bold text-white leading-tight">Structured PV Report</div>
                <div className="text-[9px] text-slate-300 mt-1">CIOMS I Ready</div>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 flex flex-col items-center justify-between min-h-[92px]">
                <div className="w-6 h-6 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-xs mb-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-bold text-emerald-200 leading-tight">PV Professional</div>
                <div className="text-[9px] text-emerald-300/80 mt-1">{safetyCase.humanApproval.status}</div>
              </div>
            </div>
          </div>

          {/* Action Flag Banner */}
          {(() => {
            const flag =
              safetyCase.aiAssessmentOutputs?.actionFlag ||
              safetyCase.actionFlag ||
              (safetyCase.priority.startsWith('P1')
                ? 'Urgent clinical attention'
                : safetyCase.priority.startsWith('P2')
                ? 'Pharmacovigilance professional review'
                : 'Routine review');

            return (
              <div
                className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                  flag === 'Urgent clinical attention'
                    ? 'bg-rose-50 border-rose-300 text-rose-900'
                    : flag === 'Pharmacovigilance professional review'
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <div>
                    <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                      9. Action Flag (Workflow Directive)
                    </div>
                    <div className="text-base font-extrabold">{flag}</div>
                    <div className="text-xs opacity-90 mt-0.5">
                      Expedited Clock: {safetyCase.pegaSLA.hoursRemaining} Hours · Priority: {safetyCase.priority} · Target Queue: {safetyCase.pegaWorkQueue}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowCIOMSModal(true)}
                  className="px-3 py-1.5 bg-white text-slate-800 font-bold rounded-lg border shadow-2xs hover:bg-slate-50 transition-colors text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Generate CIOMS I</span>
                </button>
              </div>
            );
          })()}

          {/* 10 AI Output Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Drug & ADR Extraction */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
                <Pill className="w-4 h-4 text-indigo-600" />
                <span>1. Drug & ADR Extraction</span>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500">Suspected Drug(s):</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {safetyCase.drugs.filter((d) => d.role === 'Suspect').map((d, i) => (
                      <span key={i} className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold">
                        {d.drugName} {d.dose ? `(${d.dose})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500">Concomitant Drug(s):</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {safetyCase.drugs.filter((d) => d.role !== 'Suspect').length > 0 ? (
                      safetyCase.drugs.filter((d) => d.role !== 'Suspect').map((d, i) => (
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
                  <span className="text-[10px] font-bold uppercase text-slate-500">Adverse Reaction(s):</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {safetyCase.events.map((e, i) => (
                      <span key={i} className="px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded font-bold">
                        {e.term} (SOC: {e.socTerm})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. ADR Classification */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>2. ADR Classification</span>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500">Taxonomic Category:</span>
                  <div className="mt-1 text-sm font-extrabold text-indigo-900 bg-indigo-50/80 px-2.5 py-1.5 rounded-lg border border-indigo-100">
                    {safetyCase.aiAssessmentOutputs?.adrClassification?.category ||
                      (safetyCase.events.some((e) => e.term.toLowerCase().includes('myocarditis') || e.term.toLowerCase().includes('stevens'))
                        ? 'Type B - Idiosyncratic / Immune-mediated'
                        : 'Type A - Dose-dependent / Augmented Pharmacologic')}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500">MedDRA System Organ Class:</span>
                  <div className="mt-0.5 text-slate-800 font-semibold">{safetyCase.events[0]?.socTerm || 'General disorders'}</div>
                </div>
              </div>
            </div>

            {/* 3. Severity */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
                <Activity className="w-4 h-4 text-rose-600" />
                <span>3. Severity Assessment</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-extrabold px-3 py-1 rounded-lg border ${
                      safetyCase.events.some((e) => e.severityGrade === 'Life-Threatening' || e.severityGrade === 'Severe')
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : safetyCase.events.some((e) => e.severityGrade === 'Moderate')
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    Grade: {safetyCase.events[0]?.severityGrade || 'Severe'}
                  </span>
                  <span className="text-slate-500 text-[11px]">CTCAE / Clinical Severity Scale</span>
                </div>
                <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200 leading-relaxed">
                  {safetyCase.events[0]?.severityGrade === 'Severe' || safetyCase.events[0]?.severityGrade === 'Life-Threatening'
                    ? 'Severe functional impairment necessitating urgent clinical intervention and pharmacotherapy withdrawal.'
                    : 'Moderate functional limitation; supportive clinical care required.'}
                </div>
              </div>
            </div>

            {/* 4. Seriousness Assessment */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>4. Seriousness Assessment (ICH E2A)</span>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                      safetyCase.events.some((e) => e.isSerious)
                        ? 'bg-rose-100 text-rose-800 font-extrabold'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {safetyCase.events.some((e) => e.isSerious) ? 'SERIOUS ADVERSE REACTION' : 'NON-SERIOUS'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[10px]">
                  {[
                    { label: 'Death', active: safetyCase.events.some((e) => e.seriousness.death) },
                    { label: 'Life-Threatening', active: safetyCase.events.some((e) => e.seriousness.lifeThreatening) },
                    { label: 'Hospitalization', active: safetyCase.events.some((e) => e.seriousness.hospitalization) },
                    { label: 'Disability', active: safetyCase.events.some((e) => e.seriousness.disability) },
                    { label: 'Congenital Anomaly', active: safetyCase.events.some((e) => e.seriousness.congenitalAnomaly) },
                    { label: 'Medically Important', active: safetyCase.events.some((e) => e.seriousness.otherMedicallyImportant) },
                  ].map((c, i) => (
                    <div
                      key={i}
                      className={`p-1 rounded text-center border font-semibold ${
                        c.active ? 'bg-rose-100 text-rose-900 border-rose-300 font-bold' : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      {c.active ? '✓ ' : ''}{c.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 5. Causality Assessment */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
                <Scale className="w-4 h-4 text-indigo-600" />
                <span>5. Causality Assessment</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500">WHO-UMC:</span>
                    <div className="text-sm font-extrabold text-indigo-950">{safetyCase.whoUmcCategory}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Naranjo Score:</span>
                    <div className="text-sm font-extrabold text-slate-900">{safetyCase.naranjoScore} ({safetyCase.naranjoCategory})</div>
                  </div>
                </div>
                <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200 leading-relaxed">
                  {safetyCase.aiAssessmentOutputs?.causalityAssessment?.rationale ||
                    `Temporal sequence established. Evaluated as ${safetyCase.naranjoCategory} causality per Naranjo algorithm.`}
                </div>
              </div>
            </div>

            {/* 6. Drug-Drug Interaction */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>6. Drug-Drug Interaction Check</span>
              </div>
              <div className="space-y-2 text-xs">
                {(() => {
                  const status =
                    safetyCase.aiAssessmentOutputs?.drugDrugInteraction?.status ||
                    (safetyCase.drugs.length > 1 ? 'Caution' : 'Safe');

                  return (
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
                      <span className="text-slate-500 text-[11px]">{safetyCase.drugs.length} drug(s) screened</span>
                    </div>
                  );
                })()}
                <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200 leading-relaxed">
                  {safetyCase.aiAssessmentOutputs?.drugDrugInteraction?.details ||
                    (safetyCase.drugs.length > 1
                      ? 'Screened for hepatic CYP450 enzyme competition and pharmacodynamic interactions.'
                      : 'Single primary suspect agent administered; no active drug-drug interaction detected.')}
                </div>
              </div>
            </div>

            {/* 7. Duplicate Detection */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                <span>7. Duplicate Detection</span>
              </div>
              <div className="space-y-2 text-xs">
                {safetyCase.potentialDuplicates.length > 0 ? (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                    <div className="font-bold flex items-center justify-between">
                      <span>Potential Duplicate Flagged</span>
                      <span className="text-xs bg-amber-200 px-2 py-0.5 rounded">
                        Match: {safetyCase.potentialDuplicates[0].matchScore}%
                      </span>
                    </div>
                    <div className="text-[11px] mt-1 text-amber-800">
                      Matched case: <strong>{safetyCase.potentialDuplicates[0].caseNumber}</strong>. Reasons: {safetyCase.potentialDuplicates[0].reasons.join(', ')}.
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 font-medium">
                    ✓ Unique New Case (No Duplicate Identified)
                  </div>
                )}
              </div>
            </div>

            {/* 8. Clinical Recommendation */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
                <HeartPulse className="w-4 h-4 text-indigo-600" />
                <span>8. Clinical Recommendation</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-lg text-indigo-950 font-medium">
                  <strong>Primary Recommendation:</strong>{' '}
                  {safetyCase.aiAssessmentOutputs?.clinicalRecommendation?.primaryRecommendation ||
                    'Immediate discontinuation of suspected medicinal product. Monitor biomarkers and vital signs.'}
                </div>
                <div className="text-[11px] text-slate-700">
                  <div className="font-bold text-slate-800 mb-1">Follow-Up Actions:</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {(
                      safetyCase.aiAssessmentOutputs?.clinicalRecommendation?.followUpActions || [
                        'Monitor recovery timeline and vital signs',
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

          {/* 10. PV Report Summary */}
          <div className="p-4 bg-white rounded-xl border border-slate-300 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-xs uppercase tracking-wider">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>10. Structured Pharmacovigilance Report Summary</span>
              </div>
              <button
                onClick={() => {
                  const summaryText =
                    safetyCase.aiAssessmentOutputs?.pvReportSummary ||
                    safetyCase.clinicalSummary ||
                    safetyCase.narrativeText;
                  navigator.clipboard.writeText(summaryText);
                  showToast('Safety Report Summary copied to clipboard!', 'success');
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Summary</span>
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
              {safetyCase.aiAssessmentOutputs?.pvReportSummary ||
                `PHARMACOVIGILANCE SAFETY REPORT SUMMARY
Case ID: ${safetyCase.caseNumber} (v${safetyCase.version})
Patient: ${safetyCase.patient.initials} | Age: ${safetyCase.patient.age || 'Unreported'} | Sex: ${safetyCase.patient.sex} | Weight: ${safetyCase.patient.weightKg ? `${safetyCase.patient.weightKg} kg` : 'Unreported'}
Suspect Drug(s): ${safetyCase.drugs.filter((d) => d.role === 'Suspect').map((d) => `${d.drugName} (${d.dose || 'dose unreported'}, ${d.route || 'route unreported'}, ${d.frequency || 'frequency unreported'})`).join('; ')}
Adverse Reaction(s): ${safetyCase.events.map((e) => `${e.term} [Severity: ${e.severityGrade}, Outcome: ${e.outcome}]`).join('; ')}
Seriousness: ${safetyCase.events.some((e) => e.isSerious) ? 'SERIOUS' : 'NON-SERIOUS'}
Causality: ${safetyCase.naranjoCategory} (Naranjo Score: ${safetyCase.naranjoScore}) | WHO-UMC: ${safetyCase.whoUmcCategory}
Drug Interaction Status: ${safetyCase.aiAssessmentOutputs?.drugDrugInteraction?.status || 'Assessed'}
Action Flag: ${safetyCase.aiAssessmentOutputs?.actionFlag || safetyCase.actionFlag || 'Pharmacovigilance professional review'}
Expedited Clock: ${safetyCase.pegaSLA.hoursRemaining} Hours (${safetyCase.pegaSLA.regulatoryDeadlineType})`}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Causality Assessment & Naranjo Wizard */}
      {activeTab === 'causality' && (
        <div className="space-y-6">
          {/* Causality Summary Header */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-400">
                Standardized Clinical Causality Assessment
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-2xl font-black text-slate-900">
                  Naranjo Score: {safetyCase.naranjoScore}
                </span>
                <span className="text-sm font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200">
                  Category: {safetyCase.naranjoCategory} Causality
                </span>
                <span className="text-sm font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                  WHO-UMC: {safetyCase.whoUmcCategory}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Score ranges: Definite (≥9) · Probable (5-8) · Possible (1-4) · Doubtful (≤0). Interactive questionnaire below.
              </p>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-500">Evaluation Engine</div>
              <div className="text-xs font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>ICH E2A Harmonized Algorithm</span>
              </div>
            </div>
          </div>

          {/* Interactive 10-Question Naranjo Algorithm Wizard */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-4">
              Naranjo Adverse Drug Reaction Probability Scale (Interactive Scoring)
            </h3>

            <div className="space-y-3.5">
              {NARANJO_QUESTIONS.map((q, idx) => {
                const currentVal = safetyCase.naranjoAnswers[q.id];

                return (
                  <div
                    key={q.id}
                    className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-2xl">
                        <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold font-mono">
                            {idx + 1}
                          </span>
                          <span>{q.question}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 pl-5.5">
                          Rationale: {q.rationale}
                        </div>
                      </div>

                      {/* Radio options */}
                      <div className="flex items-center gap-2 text-xs shrink-0">
                        <button
                          onClick={() => handleNaranjoChange(q.id, q.yesScore)}
                          className={`px-3 py-1 rounded border font-medium transition-colors cursor-pointer ${
                            currentVal === q.yesScore
                              ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          Yes ({q.yesScore >= 0 ? `+${q.yesScore}` : q.yesScore})
                        </button>

                        <button
                          onClick={() => handleNaranjoChange(q.id, q.noScore)}
                          className={`px-3 py-1 rounded border font-medium transition-colors cursor-pointer ${
                            currentVal === q.noScore
                              ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          No ({q.noScore >= 0 ? `+${q.noScore}` : q.noScore})
                        </button>

                        <button
                          onClick={() => handleNaranjoChange(q.id, q.unknownScore)}
                          className={`px-3 py-1 rounded border font-medium transition-colors cursor-pointer ${
                            currentVal === q.unknownScore
                              ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          Do Not Know ({q.unknownScore})
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Quality & Deduplication */}
      {activeTab === 'quality_duplicates' && (
        <div className="space-y-6">
          {/* Missing Data Checklist & Follow-up queries */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Missing, Inconsistent, or Unclear Information Audit ({safetyCase.missingDataAudit.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Missing parameters impacting assessment and targeted regulatory follow-up actions.
                </p>
              </div>

              <button
                onClick={() => setShowFollowUpModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Open Follow-Up Query Generator</span>
              </button>
            </div>

            {safetyCase.missingDataAudit.length > 0 ? (
              <div className="space-y-3">
                {safetyCase.missingDataAudit.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-lg border transition-all ${
                      item.resolved
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{item.field}</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                              item.severity === 'High'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {item.severity} Impact
                          </span>
                          {item.resolved && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                              Query Sent
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          <strong>Clinical Impact:</strong> {item.impact}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 bg-slate-50 p-2 rounded border border-slate-200 font-mono">
                          Target Question: "{item.suggestedFollowUpQuery}"
                        </div>
                      </div>

                      {!item.resolved && (
                        <button
                          onClick={() => handleResolveMissingItem(item.id)}
                          className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 transition-colors cursor-pointer shrink-0"
                        >
                          Mark Sent
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>All core regulatory fields present and internally consistent. No open follow-up queries.</span>
              </div>
            )}
          </div>

          {/* Fuzzy Duplicate Match & Side-by-side reconciliation */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2">
              <GitMerge className="w-4 h-4 text-indigo-600" />
              Automated Duplicate Report Detection
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Multi-factor fuzzy matching on patient demographics, suspect drugs, MedDRA PT, and onset timing.
            </p>

            {safetyCase.potentialDuplicates.length > 0 ? (
              <div className="space-y-4">
                {safetyCase.potentialDuplicates.map((dup, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-amber-300 bg-amber-50/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-amber-950">
                          Potential Duplicate Case Identified:
                        </span>
                        <button
                          onClick={() => onSelectCaseById(dup.caseId)}
                          className="font-mono font-bold text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>{dup.caseNumber}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                          {dup.matchScore}% Match Confidence
                        </span>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="text-[11px] font-bold text-amber-900 uppercase">Match Reasons:</div>
                      <ul className="list-disc list-inside text-xs text-amber-950 mt-1 space-y-0.5">
                        {dup.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Side-by-side comparison if duplicate record exists */}
                    {duplicateMatchRecord && (
                      <div className="mt-4 pt-3 border-t border-amber-200 grid grid-cols-2 gap-4 text-xs bg-white p-3 rounded-lg border border-slate-200">
                        <div>
                          <div className="font-bold text-slate-800 border-b border-slate-100 pb-1">
                            Current Case ({safetyCase.caseNumber})
                          </div>
                          <div className="mt-1.5 space-y-1 text-slate-600 text-[11px]">
                            <div>Source: {safetyCase.primarySource}</div>
                            <div>Onset: {safetyCase.events[0]?.onsetDate}</div>
                            <div>Dose: {safetyCase.drugs[0]?.dose}</div>
                            <div>Outcome: {safetyCase.events[0]?.outcome}</div>
                          </div>
                        </div>

                        <div>
                          <div className="font-bold text-slate-800 border-b border-slate-100 pb-1">
                            Duplicate Candidate ({duplicateMatchRecord.caseNumber})
                          </div>
                          <div className="mt-1.5 space-y-1 text-slate-600 text-[11px]">
                            <div>Source: {duplicateMatchRecord.primarySource}</div>
                            <div>Onset: {duplicateMatchRecord.events[0]?.onsetDate}</div>
                            <div>Dose: {duplicateMatchRecord.drugs[0]?.dose}</div>
                            <div>Outcome: {duplicateMatchRecord.events[0]?.outcome}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          onAdvancePegaStage('Triage', 'Duplicate Linked & Reconciled');
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Execute Duplicate Link Action
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>No matching duplicate records found across 42,000 index database cases.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Governance & Authorized Human Sign-Off */}
      {activeTab === 'governance' && (
        <div className="space-y-6">
          {/* Action Tray */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Safety Case Assignment & Action Tray
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Execute configured flow actions, route between work queues, or escalate to executive safety committees.
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200">
                  Current Queue: {safetyCase.pegaWorkQueue}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2">
                <div className="font-bold text-slate-800">Advance Case Stage</div>
                <p className="text-slate-500 text-[11px]">
                  Transition case to next authorized stage in safety lifecycle.
                </p>
                <button
                  onClick={() => onAdvancePegaStage('GovernanceEscalation', 'Safety Review Board')}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium text-xs transition-colors cursor-pointer"
                >
                  Stage 5: Regulatory Governance
                </button>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2">
                <div className="font-bold text-slate-800">Convene Safety Review Board</div>
                <p className="text-slate-500 text-[11px]">
                  Schedule emergency 24-hour review for urgent unlisted signals.
                </p>
                <button
                  onClick={() => {
                    showToast(`Safety Review Board convened for ${safetyCase.caseNumber}. Calendar invite and dossier dispatched to Senior PV Leadership.`, 'info');
                  }}
                  className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium text-xs transition-colors cursor-pointer"
                >
                  Trigger Emergency SRB
                </button>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2">
                <div className="font-bold text-slate-800">Reassign Work Queue</div>
                <p className="text-slate-500 text-[11px]">
                  Transfer case to specialized toxicology or epidemiology desk.
                </p>
                <select
                  value={safetyCase.pegaWorkQueue}
                  onChange={(e) => {
                    onUpdateCase({
                      ...safetyCase,
                      pegaWorkQueue: e.target.value as any,
                    });
                  }}
                  className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded text-slate-800 text-xs"
                >
                  <option value="PV_Medical_Review_Tier2">PV_Medical_Review_Tier2</option>
                  <option value="PV_Epidemiology_Signals">PV_Epidemiology_Signals</option>
                  <option value="PV_Safety_Board_Signoff">PV_Safety_Board_Signoff</option>
                  <option value="PV_Triage_Desk">PV_Triage_Desk</option>
                </select>
              </div>
            </div>
          </div>

          {/* Mandatory Authorized Human Approval Gate (Strict prompt requirement) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <ShieldAlert className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Authorized Human Sign-off & Regulatory Decision Gate
                </h3>
                <p className="text-xs text-slate-500">
                  CRITICAL: Decision support rule requires explicit qualified human approval before case closure, regulatory submission, or status alteration.
                </p>
              </div>
            </div>

            {safetyCase.humanApproval.status === 'Approved' ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Case Approved & Signed by Authorized Human Medical Officer</span>
                </div>
                <div className="text-emerald-800 text-[11px]">
                  Signoff Officer: <strong>{safetyCase.humanApproval.reviewerName}</strong> ({safetyCase.humanApproval.reviewerRole}) · Timestamp: {safetyCase.humanApproval.decisionTimestamp}
                </div>
                <div className="p-2.5 bg-white rounded border border-emerald-200 text-slate-700 italic">
                  "{safetyCase.humanApproval.decisionNotes}"
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Reviewer Full Name & Credential</label>
                    <input
                      type="text"
                      value={approverName}
                      onChange={(e) => setApproverName(e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 border border-slate-300 rounded text-slate-900 font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Authorized Role</label>
                    <input
                      type="text"
                      value={approverRole}
                      onChange={(e) => setApproverRole(e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 border border-slate-300 rounded text-slate-900 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Adjudication Rationale & Regulatory Submission Notes
                  </label>
                  <textarea
                    rows={3}
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="Document clinical justification for causality rating, seriousness classification, and approval for expedited submission to health authorities..."
                    className="mt-1 w-full p-2.5 border border-slate-300 rounded text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {signoffSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Human authorization recorded into immutable audit log. Case approved for regulatory release.</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      showToast('Case returned to Triage work queue for further data collection.', 'info');
                    }}
                    className="px-3.5 py-2 text-xs text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
                  >
                    Reject / Return for Clarification
                  </button>
                  <button
                    onClick={handleAuthorizeSignoff}
                    className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>Authorize & Digitally Sign Case</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Provenance & Immutable Audit Trail */}
      {activeTab === 'audit_trail' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Safety Workflow History & 21 CFR Part 11 Audit Trail
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cryptographically sequenced record of all automated rules, human actions, and stage transitions.
              </p>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {safetyCase.workflowHistory.length} Recorded Entries
            </span>
          </div>

          <div className="space-y-3">
            {safetyCase.workflowHistory.map((item, idx) => (
              <div key={idx} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-500 text-[11px]">{item.timestamp}</span>
                    <span className="text-slate-300">·</span>
                    <span className="font-bold text-slate-900">{item.step}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Operator: <strong className="text-slate-700">{item.operator}</strong>
                  </div>
                </div>

                <div className="text-slate-700 mt-1.5">{item.actionTaken}</div>
                <div className="text-slate-500 text-[11px] mt-0.5">Rationale: {item.rationale}</div>

                {item.ruleExecuted && (
                  <div className="mt-1 text-[10px] text-indigo-700 font-mono">
                    Rule Executed: {item.ruleExecuted}
                  </div>
                )}
                {item.humanSignature && (
                  <div className="mt-1 text-[10px] text-emerald-700 font-mono font-semibold">
                    Digital Signature: {item.humanSignature}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showFollowUpModal && (
        <FollowUpLetterModal
          currentCase={safetyCase}
          onClose={() => setShowFollowUpModal(false)}
          onSendQuery={handleResolveMissingItem}
        />
      )}

      {showCIOMSModal && (
        <CIOMSExportModal
          currentCase={safetyCase}
          onClose={() => setShowCIOMSModal(false)}
        />
      )}

      {/* Drug-Drug Interaction & ADR Causality Dossier Modal */}
      {activeDdiModalDrug && (
        <DdiAdrDetailModal
          isOpen={Boolean(activeDdiModalDrug)}
          onClose={() => {
            setActiveDdiModalDrug(null);
            setActiveDdiCounterpart(undefined);
          }}
          targetDrug={activeDdiModalDrug}
          allDrugs={safetyCase.drugs}
          events={safetyCase.events}
          initialCounterpartDrug={activeDdiCounterpart}
        />
      )}
    </div>
  );
};
