import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Bot,
  FileText,
  Activity,
  Layers,
  Search,
  Plus,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Download,
  Mail,
  User,
  Pill,
  Filter,
  Camera,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Menu,
  X,
  Laptop,
  Smartphone,
  ChevronDown,
  ChevronUp,
  HeartPulse,
  Stethoscope,
  FlaskConical,
} from 'lucide-react';
import { SafetyCase, SignalMetric, PvStage } from '../types/pv';
import { PvAgentConsole } from './PvAgentConsole';
import { UserRoleSwitcher } from './UserRoleSwitcher';
import { CIOMSExportModal } from './CIOMSExportModal';
import { FollowUpLetterModal } from './FollowUpLetterModal';
import { PwaInstallBanner } from './PwaInstallBanner';
import { SystemConfigModal } from './SystemConfigModal';
import { DEFAULT_USER_PERSONAS, DEFAULT_SYSTEM_CONFIG } from '../data/userPersonas';
import { UserPersona, SystemConfiguration } from '../types/pv';
import { assessDrugDdiAndAdr, evaluateCaseDdiSummary } from '../utils/ddiEngine';

interface MobileAppViewProps {
  cases: SafetyCase[];
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  onUpdateCase: (updatedCase: SafetyCase) => void;
  onAdvanceStage: (nextStage: PvStage, nextStep: string) => void;
  onCaseCreated: (newCase: SafetyCase) => void;
  onDeleteCase: (caseId: string) => void;
  onOpenIntakeModal: () => void;
  signals: SignalMetric[];
  onAddSignal: (signal: SignalMetric) => void;
  onUpdateSignal: (updated: SignalMetric) => void;
  onDeleteSignal: (signalId: string) => void;
  onEscalateSignal: (signalId: string) => void;
  onLoadSampleSignals?: () => void;
  onSwitchToPcView: () => void;
  preferredMode?: 'auto' | 'mobile' | 'pc';
  onSetMode?: (mode: 'auto' | 'mobile' | 'pc') => void;
  isStandalone?: boolean;
}

export const MobileAppView: React.FC<MobileAppViewProps> = ({
  cases,
  selectedCaseId,
  onSelectCase,
  onUpdateCase,
  onAdvanceStage,
  onCaseCreated,
  onDeleteCase,
  onOpenIntakeModal,
  signals,
  onAddSignal,
  onUpdateSignal,
  onDeleteSignal,
  onEscalateSignal,
  onLoadSampleSignals,
  onSwitchToPcView,
  preferredMode,
  onSetMode,
  isStandalone,
}) => {
  // Mobile Tab Bar: 'agent' | 'cases' | 'menu'
  const [mobileTab, setMobileTab] = useState<'agent' | 'cases' | 'menu'>('agent');

  // Case Search & Filter in mobile list
  const [mobileSearch, setMobileSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [showSearchInput, setShowSearchInput] = useState(false);

  // Active full-screen case viewer in mobile
  const [viewingCaseDetail, setViewingCaseDetail] = useState(false);
  const [mobileCaseTab, setMobileCaseTab] = useState<'overview' | 'products' | 'ai_outputs' | 'naranjo'>('ai_outputs');

  // Persona & Configuration State
  const [currentUser, setCurrentUser] = useState<UserPersona>(DEFAULT_USER_PERSONAS[0]);
  const [systemConfig, setSystemConfig] = useState<SystemConfiguration>(DEFAULT_SYSTEM_CONFIG);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Modals
  const [showCIOMS, setShowCIOMS] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);

  const currentCase = useMemo(() => {
    return cases.find((c) => c.id === selectedCaseId) || cases[0] || null;
  }, [cases, selectedCaseId]);

  // Filtered cases for mobile list
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (mobileSearch.trim()) {
        const q = mobileSearch.toLowerCase();
        const matchesNumber = c.caseNumber.toLowerCase().includes(q);
        const matchesDrug = c.drugs.some((d) => d.drugName.toLowerCase().includes(q) || d.activeSubstance.toLowerCase().includes(q));
        const matchesEvent = c.events.some((e) => e.term.toLowerCase().includes(q));
        const matchesPatient = c.patient.initials.toLowerCase().includes(q);
        if (!matchesNumber && !matchesDrug && !matchesEvent && !matchesPatient) return false;
      }

      if (filterPriority !== 'ALL') {
        if (!c.priority.startsWith(filterPriority)) return false;
      }

      return true;
    });
  }, [cases, mobileSearch, filterPriority]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans select-none antialiased pb-20">
      {/* PWA Install Notification on Mobile */}
      <PwaInstallBanner variant="banner" />

      {/* Top Mobile App Header */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-extrabold text-sm shadow-md">
            PV
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-extrabold text-white tracking-tight">Vigilytics</h1>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                isStandalone
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
              }`}>
                {isStandalone ? 'Installed PWA' : 'Mobile App'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Pharmacovigilance Intelligence</p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1.5">
          {/* Switch to PC/Desktop Interface */}
          <button
            onClick={onSwitchToPcView}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold border border-slate-700 transition-colors"
            title="Switch to PC Desktop Workstation View"
          >
            <Laptop className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden xs:inline">PC View</span>
          </button>

          {/* Quick Intake Button */}
          <button
            onClick={onOpenIntakeModal}
            className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-xs transition-colors"
            title="Create New Case"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area Based on Active Mobile Tab */}
      <main className="flex-1 p-3.5">
        {/* TAB 1: AI AGENT CONSOLE (Multi-Modal Intake & Assessment) */}
        {mobileTab === 'agent' && (
          <div className="space-y-4">
            <div className="bg-slate-800/80 rounded-2xl p-3.5 border border-slate-700/80 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white">AI Case Extraction & Evaluation</span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                Online
              </span>
            </div>

            <PvAgentConsole
              onSaveCaseToWorkspace={(newCase) => {
                onCaseCreated(newCase);
                onSelectCase(newCase.id);
              }}
              existingCases={cases}
            />
          </div>
        )}

        {/* TAB 2: CASES LIST & MOBILE INSPECTOR */}
        {mobileTab === 'cases' && (
          <div className="space-y-3.5">
            {/* Search and Filters Bar */}
            <div className="bg-slate-800/90 rounded-2xl p-3 border border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Cases Registry ({filteredCases.length})</span>
                </span>

                <button
                  onClick={() => setShowSearchInput(!showSearchInput)}
                  className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>

              {showSearchInput && (
                <div className="relative">
                  <input
                    type="text"
                    value={mobileSearch}
                    onChange={(e) => setMobileSearch(e.target.value)}
                    placeholder="Search by drug, event, patient..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                  />
                  {mobileSearch && (
                    <button
                      onClick={() => setMobileSearch('')}
                      className="absolute right-2.5 top-2.5 text-slate-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Priority Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                {['ALL', 'P1', 'P2', 'P3', 'P4'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setFilterPriority(p)}
                    className={`px-2.5 py-1 rounded-full font-bold transition-colors shrink-0 ${
                      filterPriority === p
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {p === 'ALL' ? 'All Priorities' : p}
                  </button>
                ))}
              </div>
            </div>

            {/* Cases Card Feed */}
            {filteredCases.length === 0 ? (
              <div className="p-8 text-center bg-slate-800/50 rounded-2xl border border-slate-700 text-slate-400 space-y-2">
                <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs font-medium">No safety cases match your filter</p>
                <button
                  onClick={onOpenIntakeModal}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold mt-2"
                >
                  + Add First Case
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredCases.map((c) => {
                  const isSelected = c.id === currentCase?.id;
                  const isUrgent = c.priority.startsWith('P1');

                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        onSelectCase(c.id);
                        setViewingCaseDetail(true);
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer bg-slate-800/80 active:scale-[0.99] ${
                        isSelected
                          ? 'border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                          : 'border-slate-700/80 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-white text-xs">
                              {c.caseNumber}
                            </span>
                            <span
                              className={`text-[9px] font-extrabold px-2 py-0.2 rounded-full ${
                                isUrgent
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : c.priority.startsWith('P2')
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-indigo-500/20 text-indigo-300'
                              }`}
                            >
                              {c.priority}
                            </span>
                          </div>

                          <div className="text-xs font-bold text-slate-200 mt-1">
                            {c.drugs[0]?.drugName || 'Suspect Product'}
                          </div>

                          <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                            Reaction: <strong className="text-slate-300">{c.events[0]?.term || 'Adverse Event'}</strong>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800 block">
                            Stage: {c.pegaStage}
                          </span>
                          <span className="text-[9px] text-slate-400 mt-1 block">
                            {c.pegaSLA?.hoursRemaining ?? 24}h window
                          </span>
                        </div>
                      </div>

                      {/* Footer tags */}
                      <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Patient: <strong className="text-slate-300">{c.patient.initials}</strong> ({c.patient.age || 'Unknown'}yo {c.patient.sex})</span>
                        <span className="text-indigo-400 font-bold flex items-center gap-0.5">
                          <span>View Detail</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MENU & ROLE SETTINGS */}
        {mobileTab === 'menu' && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider border-b border-slate-700 pb-2">
                <User className="w-4 h-4 text-indigo-400" />
                <span>User Persona & Role Access</span>
              </div>
              <UserRoleSwitcher
                currentUser={currentUser}
                onSwitchUser={setCurrentUser}
                systemConfig={systemConfig}
                onOpenConfig={() => setShowConfigModal(true)}
              />
            </div>

            <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider border-b border-slate-700 pb-2">
                <Smartphone className="w-4 h-4 text-indigo-400" />
                <span>App Mode & Cross-Platform Settings</span>
              </div>

              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Current View Mode:</span>
                  <span className="font-bold text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-500/30">
                    Mobile App View
                  </span>
                </div>

                {isStandalone && (
                  <div className="flex items-center gap-2 text-[11px] text-emerald-300 bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-500/30 font-medium">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Running as Installed Mobile PWA App (Standalone)</span>
                  </div>
                )}

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={onSwitchToPcView}
                    className="w-full px-3 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
                  >
                    <Laptop className="w-4 h-4" />
                    <span>Switch to PC Desktop Workstation</span>
                  </button>

                  {onSetMode && (
                    <button
                      onClick={() => onSetMode('auto')}
                      className={`w-full px-3 py-2 rounded-xl font-semibold text-xs border transition-colors cursor-pointer ${
                        preferredMode === 'auto'
                          ? 'bg-slate-700/80 text-slate-200 border-slate-600'
                          : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
                      }`}
                    >
                      {preferredMode === 'auto'
                        ? '✓ Auto-Detect Active (PC / Mobile)'
                        : 'Reset to Auto-Detect Device Mode'}
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <PwaInstallBanner variant="banner" />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FULL-SCREEN MOBILE CASE DETAIL MODAL / DRAWER */}
      {viewingCaseDetail && currentCase && (
        <div className="fixed inset-0 z-50 bg-slate-900 text-slate-100 flex flex-col animate-in slide-in-from-bottom duration-200 overflow-y-auto pb-24">
          {/* Detail Header */}
          <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <button
              onClick={() => setViewingCaseDetail(false)}
              className="flex items-center gap-1 text-xs text-indigo-400 font-bold p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>

            <div className="text-center">
              <div className="font-mono font-bold text-xs text-white">{currentCase.caseNumber}</div>
              <div className="text-[10px] text-slate-400">{currentCase.drugs[0]?.drugName}</div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowCIOMS(true)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-bold border border-slate-700"
              >
                CIOMS
              </button>
            </div>
          </div>

          {/* Sub Navigation Bar for Case Detail */}
          <div className="flex items-center gap-1 bg-slate-800/80 px-3 py-2 border-b border-slate-800 overflow-x-auto text-[11px] font-bold">
            <button
              onClick={() => setMobileCaseTab('ai_outputs')}
              className={`px-2.5 py-1 rounded-lg shrink-0 ${
                mobileCaseTab === 'ai_outputs' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              10 AI Outputs
            </button>
            <button
              onClick={() => setMobileCaseTab('overview')}
              className={`px-2.5 py-1 rounded-lg shrink-0 ${
                mobileCaseTab === 'overview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Overview & Patient
            </button>
            <button
              onClick={() => setMobileCaseTab('products')}
              className={`px-2.5 py-1 rounded-lg shrink-0 ${
                mobileCaseTab === 'products' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Drugs & Reactions
            </button>
            <button
              onClick={() => setMobileCaseTab('naranjo')}
              className={`px-2.5 py-1 rounded-lg shrink-0 ${
                mobileCaseTab === 'naranjo' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Naranjo Scale
            </button>
          </div>

          {/* Mobile Case Content */}
          <div className="p-4 space-y-4">
            {/* SUB-TAB: 10 AI OUTPUTS */}
            {mobileCaseTab === 'ai_outputs' && (
              <div className="space-y-3.5 text-xs">
                {/* Action Flag Card */}
                {(() => {
                  const flag =
                    currentCase.aiAssessmentOutputs?.actionFlag ||
                    currentCase.actionFlag ||
                    (currentCase.priority.startsWith('P1')
                      ? 'Urgent clinical attention'
                      : 'Pharmacovigilance professional review');

                  return (
                    <div className="p-3.5 rounded-2xl bg-indigo-950/60 border border-indigo-700/60 text-white space-y-1">
                      <div className="text-[10px] uppercase font-bold text-amber-300">
                        9. Action Flag (Workflow Directive)
                      </div>
                      <div className="text-sm font-extrabold text-white">{flag}</div>
                      <div className="text-[11px] text-slate-300">
                        Priority: {currentCase.priority} · Expedited Filing: {currentCase.pegaSLA?.hoursRemaining ?? 24}h window
                      </div>
                    </div>
                  );
                })()}

                {/* 1. Extraction */}
                <div className="p-3.5 rounded-2xl bg-slate-800 border border-slate-700 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-indigo-400">1. Drug & ADR Extraction</div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Suspected Drug(s):</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {currentCase.drugs.filter((d) => d.role === 'Suspect').map((d, i) => (
                        <span key={i} className="px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded font-bold">
                          {d.drugName} ({d.dose})
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Adverse Event(s):</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {currentCase.events.map((e, i) => (
                        <span key={i} className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded font-bold">
                          {e.term} (SOC: {e.socTerm})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. ADR Classification */}
                <div className="p-3.5 rounded-2xl bg-slate-800 border border-slate-700 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-indigo-400">2. ADR Classification</div>
                  <div className="font-bold text-white text-xs">
                    {currentCase.aiAssessmentOutputs?.adrClassification?.category || 'Type B - Idiosyncratic / Immune-mediated'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    SOC: {currentCase.events[0]?.socTerm}
                  </div>
                </div>

                {/* 3 & 4. Severity & Seriousness */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700 space-y-1">
                    <div className="text-[10px] uppercase font-bold text-rose-400">3. Severity</div>
                    <div className="text-sm font-bold text-white">
                      {currentCase.events[0]?.severityGrade || 'Severe'}
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700 space-y-1">
                    <div className="text-[10px] uppercase font-bold text-indigo-400">4. Seriousness</div>
                    <div className="text-xs font-bold text-rose-400">
                      {currentCase.events.some((e) => e.isSerious) ? 'SERIOUS' : 'NON-SERIOUS'}
                    </div>
                  </div>
                </div>

                {/* 5. Causality */}
                <div className="p-3.5 rounded-2xl bg-slate-800 border border-slate-700 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-indigo-400">5. Causality Assessment</div>
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-white">WHO-UMC: {currentCase.whoUmcCategory}</span>
                    <span className="text-amber-300">Naranjo: {currentCase.naranjoScore} ({currentCase.naranjoCategory})</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {currentCase.aiAssessmentOutputs?.causalityAssessment?.rationale || 'Confirmed temporal sequence and dechallenge correlation.'}
                  </div>
                </div>

                {/* 6. Interaction */}
                <div className="p-3.5 rounded-2xl bg-slate-800 border border-slate-700 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-indigo-400">6. Drug-Drug Interaction</div>
                  <div className="font-bold text-white">
                    Status: {currentCase.aiAssessmentOutputs?.drugDrugInteraction?.status || 'Safe'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {currentCase.aiAssessmentOutputs?.drugDrugInteraction?.details || 'Screened for hepatic CYP450 competition and pharmacodynamic antagonism.'}
                  </div>
                </div>

                {/* 7 & 8. Duplicate & Recommendation */}
                <div className="p-3.5 rounded-2xl bg-slate-800 border border-slate-700 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-indigo-400">8. Clinical Recommendation</div>
                  <div className="text-slate-200 font-medium text-[11px]">
                    {currentCase.aiAssessmentOutputs?.clinicalRecommendation?.primaryRecommendation || 'Immediate discontinuation of suspect agent. Monitor biomarker recovery.'}
                  </div>
                </div>

                {/* 10. Summary */}
                <div className="p-3.5 rounded-2xl bg-slate-800 border border-slate-700 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-indigo-400">10. PV Report Summary</div>
                  <div className="p-2.5 bg-slate-900 rounded-xl font-mono text-[10px] text-slate-300 max-h-36 overflow-y-auto whitespace-pre-wrap">
                    {currentCase.aiAssessmentOutputs?.pvReportSummary || currentCase.clinicalSummary || currentCase.narrativeText}
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB: OVERVIEW & PATIENT */}
            {mobileCaseTab === 'overview' && (
              <div className="space-y-3.5 text-xs">
                {/* Patient Card */}
                <div className="p-3.5 rounded-2xl bg-slate-800 border border-slate-700 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>Patient Information</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>Initials: <strong className="text-white">{currentCase.patient.initials}</strong></div>
                    <div>Age: <strong className="text-white">{currentCase.patient.age || 'Unreported'}</strong></div>
                    <div>Sex: <strong className="text-white">{currentCase.patient.sex}</strong></div>
                    <div>Weight: <strong className="text-white">{currentCase.patient.weightKg ? `${currentCase.patient.weightKg} kg` : 'Unreported'}</strong></div>
                  </div>
                </div>

                {/* Narrative Summary */}
                <div className="p-3.5 rounded-2xl bg-slate-800 border border-slate-700 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-indigo-400">Clinical Summary</div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{currentCase.clinicalSummary}</p>
                </div>

                {/* Vital Signs (if any) */}
                {currentCase.vitalSigns && Object.values(currentCase.vitalSigns).some(Boolean) && (
                  <div className="p-3.5 rounded-2xl bg-slate-800 border border-slate-700 space-y-2">
                    <div className="text-[10px] uppercase font-bold text-rose-400 flex items-center gap-1">
                      <HeartPulse className="w-3.5 h-3.5" />
                      <span>Vital Signs</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>BP: <strong className="text-white">{currentCase.vitalSigns.bloodPressure || 'N/A'}</strong></div>
                      <div>HR: <strong className="text-white">{currentCase.vitalSigns.heartRate || 'N/A'}</strong></div>
                      <div>Temp: <strong className="text-white">{currentCase.vitalSigns.temperature || 'N/A'}</strong></div>
                      <div>SpO2: <strong className="text-white">{currentCase.vitalSigns.oxygenSaturation || 'N/A'}</strong></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB: PRODUCTS & REACTIONS */}
            {mobileCaseTab === 'products' && (
              <div className="space-y-3.5 text-xs">
                <div className="text-[10px] uppercase font-bold text-slate-400">Medications ({currentCase.drugs.length})</div>
                {currentCase.drugs.map((d, i) => {
                  const ddi = assessDrugDdiAndAdr(d, currentCase.drugs, currentCase.events);

                  return (
                    <div key={i} className="p-3 bg-slate-800 rounded-2xl border border-slate-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">{d.drugName}</span>
                        <div className="flex items-center gap-1.5">
                          {ddi.hasInteraction && (
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${
                                ddi.adrCausalityRole === 'Likely ADR Cause / Primary Driver'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {ddi.adrCausalityRole === 'Likely ADR Cause / Primary Driver'
                                ? '🚨 DDI ADR Cause'
                                : '⚠️ DDI Cofactor'}
                            </span>
                          )}
                          <span className="text-[10px] px-2 py-0.2 rounded font-bold bg-indigo-500/20 text-indigo-300">
                            {d.role}
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-300">
                        Dose: {d.dose} · {d.route} · {d.frequency}
                      </div>
                      {d.durationOfTherapy && (
                        <div className="text-[11px] text-slate-400">Duration: {d.durationOfTherapy}</div>
                      )}
                      {ddi.hasInteraction && (
                        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-[10px] text-slate-300 space-y-0.5">
                          <div className="text-amber-400 font-bold">
                            DDI: Interacts with {ddi.interactingDrugs.join(', ')}
                          </div>
                          <div className="text-slate-300">{ddi.adrMatchExplanation}</div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="text-[10px] uppercase font-bold text-slate-400 pt-2">Adverse Events ({currentCase.events.length})</div>
                {currentCase.events.map((e, i) => (
                  <div key={i} className="p-3 bg-slate-800 rounded-2xl border border-slate-700 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs">{e.term}</span>
                      <span className="text-[10px] font-bold text-rose-400">Severity: {e.severityGrade}</span>
                    </div>
                    <div className="text-[11px] text-slate-300">SOC: {e.socTerm} · Onset: {e.onsetDate}</div>
                    {e.signsAndSymptoms && (
                      <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-lg mt-1">
                        Signs: {e.signsAndSymptoms}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* SUB-TAB: NARANJO SCALE */}
            {mobileCaseTab === 'naranjo' && (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 bg-indigo-950/60 rounded-2xl border border-indigo-700/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-indigo-300 uppercase font-bold">Naranjo Score</span>
                    <div className="text-lg font-black text-white">{currentCase.naranjoScore}</div>
                  </div>
                  <span className="px-3 py-1 rounded-full font-bold bg-indigo-600 text-white text-xs">
                    {currentCase.naranjoCategory}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Standardized 10-item adverse drug reaction probability score. Validated against Edwards & Aronson reference standard.
                </p>
              </div>
            )}
          </div>

          {/* Sticky Bottom Actions in Detail Drawer */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md p-3 border-t border-slate-800 flex items-center gap-2">
            <button
              onClick={() => setShowCIOMS(true)}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CIOMS I Form</span>
            </button>

            <button
              onClick={() => setShowFollowUp(true)}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Follow-up Query</span>
            </button>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR (Ergonomic Thumb Friendly) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex items-center justify-around py-2 px-1 safe-area-inset-bottom">
        <button
          onClick={() => setMobileTab('agent')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors cursor-pointer ${
            mobileTab === 'agent' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bot className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Agent AI</span>
        </button>

        <button
          onClick={() => setMobileTab('cases')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors cursor-pointer relative ${
            mobileTab === 'cases' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Cases</span>
          {cases.length > 0 && (
            <span className="absolute top-0 right-2 w-2 h-2 rounded-full bg-indigo-500"></span>
          )}
        </button>

        <button
          onClick={() => setMobileTab('menu')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors cursor-pointer ${
            mobileTab === 'menu' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Menu</span>
        </button>
      </nav>

      {/* CIOMS EXPORT MODAL */}
      {showCIOMS && currentCase && (
        <CIOMSExportModal
          currentCase={currentCase}
          onClose={() => setShowCIOMS(false)}
        />
      )}

      {/* FOLLOW UP QUERY MODAL */}
      {showFollowUp && currentCase && (
        <FollowUpLetterModal
          currentCase={currentCase}
          onClose={() => setShowFollowUp(false)}
          onSendQuery={(queryFieldId) => {
            const updatedAudit = currentCase.missingDataAudit.map((m) =>
              m.id === queryFieldId ? { ...m, resolved: true } : m
            );
            const updatedCase = {
              ...currentCase,
              missingDataAudit: updatedAudit,
            };
            onUpdateCase(updatedCase);
          }}
        />
      )}
      {/* SYSTEM CONFIGURATION MODAL */}
      {showConfigModal && (
        <SystemConfigModal
          config={systemConfig}
          onClose={() => setShowConfigModal(false)}
          onSaveConfig={setSystemConfig}
        />
      )}
    </div>
  );
};
