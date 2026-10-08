import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  Plus,
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  FileCheck,
  ChevronRight,
  Database,
  Pill,
  HeartPulse,
  Upload,
  Download,
  Trash2,
  FileText,
  RotateCcw,
  Bot,
  Smartphone,
  Laptop,
} from 'lucide-react';
import { SafetyCase, PvStage, SignalMetric } from './types/pv';
import {
  INITIAL_SAFETY_CASES,
  INITIAL_SIGNALS,
  SAMPLE_SAFETY_CASES,
  SAMPLE_ACTIVE_SIGNALS,
} from './data/mockPvData';
import { evaluateCaseDdiSummary } from './utils/ddiEngine';
import { showToast } from './utils/toast';
import { ToastContainer } from './components/ToastContainer';
import { SafetyEscalationBanner } from './components/SafetyEscalationBanner';
import { PvWorkflowBar } from './components/PvWorkflowBar';
import { CaseDetailView } from './components/CaseDetailView';
import { CaseIntakeModal } from './components/CaseIntakeModal';
import { PvAgentConsole } from './components/PvAgentConsole';
import { MobileAppView } from './components/MobileAppView';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { useDeviceMode } from './hooks/useDeviceMode';

export default function App() {
  // Load saved cases from localStorage or start with empty list
  const [cases, setCases] = useState<SafetyCase[]>(() => {
    try {
      const saved = localStorage.getItem('vigilytics_user_cases') || localStorage.getItem('aegispv_user_cases');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load saved cases', e);
    }
    return INITIAL_SAFETY_CASES;
  });

  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => {
    return cases[0]?.id || null;
  });

  // Load saved signals from localStorage or start with empty list
  const [signals, setSignals] = useState<SignalMetric[]>(() => {
    try {
      const saved = localStorage.getItem('vigilytics_user_signals') || localStorage.getItem('aegispv_user_signals');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load saved signals', e);
    }
    return INITIAL_SIGNALS;
  });

  // Active Main Navigation View (Vigilytics Workspace is default)
  const [activeView, setActiveView] = useState<'agent' | 'cases'>('agent');

  // Case Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<string>('ALL');

  // Modals
  const [showIntakeModal, setShowIntakeModal] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('vigilytics_user_cases', JSON.stringify(cases));
    } catch (e) {
      console.error('Failed to save cases to localStorage', e);
    }
  }, [cases]);

  useEffect(() => {
    try {
      localStorage.setItem('vigilytics_user_signals', JSON.stringify(signals));
    } catch (e) {
      console.error('Failed to save signals to localStorage', e);
    }
  }, [signals]);

  // Keep selectedCaseId synchronized
  useEffect(() => {
    if (cases.length > 0 && (!selectedCaseId || !cases.some((c) => c.id === selectedCaseId))) {
      setSelectedCaseId(cases[0].id);
    } else if (cases.length === 0) {
      setSelectedCaseId(null);
    }
  }, [cases, selectedCaseId]);

  // Urgent P1 Count for Top Banner
  const urgentCount = useMemo(() => {
    return cases.filter((c) => c.priority.startsWith('P1')).length;
  }, [cases]);

  // Current selected case object
  const currentCase = useMemo(() => {
    return cases.find((c) => c.id === selectedCaseId) || cases[0] || null;
  }, [cases, selectedCaseId]);

  // Filtered cases list for left pane
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNumber = c.caseNumber.toLowerCase().includes(q);
        const matchesDrug = c.drugs.some((d) => d.drugName.toLowerCase().includes(q) || d.activeSubstance.toLowerCase().includes(q));
        const matchesEvent = c.events.some((e) => e.term.toLowerCase().includes(q));
        const matchesPatient = c.patient.initials.toLowerCase().includes(q);
        if (!matchesNumber && !matchesDrug && !matchesEvent && !matchesPatient) return false;
      }

      // Priority Filter
      if (priorityFilter !== 'ALL') {
        if (!c.priority.startsWith(priorityFilter)) return false;
      }

      // Stage Filter
      if (stageFilter !== 'ALL') {
        if (c.pegaStage !== stageFilter) return false;
      }

      return true;
    });
  }, [cases, searchQuery, priorityFilter, stageFilter]);

  // Case Handlers
  const handleUpdateCase = (updated: SafetyCase) => {
    setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleAdvanceStage = (nextStage: PvStage, nextStep: string) => {
    if (!currentCase) return;
    const updated: SafetyCase = {
      ...currentCase,
      pegaStage: nextStage,
      pegaStep: nextStep,
      workflowHistory: [
        ...currentCase.workflowHistory,
        {
          timestamp: new Date().toISOString(),
          fromStage: currentCase.pegaStage,
          toStage: nextStage,
          step: nextStep,
          operator: 'Authorized Reviewer',
          actionTaken: `Advanced to ${nextStage}`,
          rationale: 'Stage completion checklist verified.',
        },
      ],
    };
    handleUpdateCase(updated);
  };

  const handleCaseCreated = (newCase: SafetyCase) => {
    setCases((prev) => [newCase, ...prev]);
    setSelectedCaseId(newCase.id);
    setActiveView('cases');
  };

  const handleDeleteCase = (caseId: string) => {
    setCases((prev) => prev.filter((c) => c.id !== caseId));
    showToast('Safety case removed from workspace.', 'info');
  };

  const handleClearAllCases = () => {
    setCases([]);
    setSelectedCaseId(null);
    localStorage.removeItem('vigilytics_user_cases');
    localStorage.removeItem('aegispv_user_cases');
    showToast('Workspace reset: all safety cases cleared.', 'info');
  };

  const handleLoadSampleCases = () => {
    setCases(SAMPLE_SAFETY_CASES);
    setSelectedCaseId(SAMPLE_SAFETY_CASES[0].id);
    showToast('Sample regulatory cases loaded into workspace.', 'success');
  };

  // Signal Handlers
  const handleAddSignal = (newSignal: SignalMetric) => {
    setSignals((prev) => [newSignal, ...prev]);
    showToast(`Signal for ${newSignal.drugName} registered.`, 'success');
  };

  const handleUpdateSignal = (updated: SignalMetric) => {
    setSignals((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    showToast('Signal updated.', 'info');
  };

  const handleDeleteSignal = (signalId: string) => {
    setSignals((prev) => prev.filter((s) => s.id !== signalId));
    showToast('Signal removed from workspace.', 'info');
  };

  const handleLoadSampleSignals = () => {
    setSignals(SAMPLE_ACTIVE_SIGNALS);
    showToast('Sample signals loaded.', 'success');
  };

  const handleEscalateSignal = (signalId: string) => {
    setSignals((prev) =>
      prev.map((s) =>
        s.id === signalId
          ? {
              ...s,
              status: 'Escalated to SRB' as const,
              regulatoryActionProposed: 'Safety Review Board emergency dossier convened.',
            }
          : s
      )
    );
    showToast('Signal successfully escalated to Executive Safety Review Board.', 'success');
  };

  const handleExportAllJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(cases, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `AegisPV-Cases-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const { currentMode, preferredMode, detectedMode, setMode, isStandalone } = useDeviceMode();

  // If in Mobile Interface Mode, render MobileAppView
  if (currentMode === 'mobile') {
    return (
      <>
        <MobileAppView
          cases={cases}
          selectedCaseId={selectedCaseId}
          onSelectCase={(id) => setSelectedCaseId(id)}
          onUpdateCase={handleUpdateCase}
          onAdvanceStage={handleAdvanceStage}
          onCaseCreated={handleCaseCreated}
          onDeleteCase={handleDeleteCase}
          onOpenIntakeModal={() => setShowIntakeModal(true)}
          signals={signals}
          onAddSignal={handleAddSignal}
          onUpdateSignal={handleUpdateSignal}
          onDeleteSignal={handleDeleteSignal}
          onEscalateSignal={handleEscalateSignal}
          onLoadSampleSignals={handleLoadSampleSignals}
          onSwitchToPcView={() => setMode('pc')}
          preferredMode={preferredMode}
          onSetMode={setMode}
          isStandalone={isStandalone}
        />
        {showIntakeModal && (
          <CaseIntakeModal
            existingCases={cases}
            onClose={() => setShowIntakeModal(false)}
            onCaseCreated={handleCaseCreated}
          />
        )}
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased selection:bg-indigo-500 selection:text-white">
      {/* PWA Install Notification Bar */}
      <PwaInstallBanner variant="banner" />

      {/* Show urgent escalation banner only when urgent cases exist */}
      {urgentCount > 0 && (
        <SafetyEscalationBanner
          urgentCount={urgentCount}
          onFilterUrgent={() => {
            setActiveView('cases');
            setPriorityFilter('P1');
          }}
        />
      )}

      {/* Main Enterprise Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-15 gap-4">
            {/* Brand Logo & Title */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                <HeartPulse className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-bold text-slate-900 tracking-tight text-sm">Vigilytics</span>
                <span className="text-slate-400 mx-1.5 font-light">·</span>
                <span className="text-xs text-slate-500 font-normal">
                  Pharmacovigilance Intelligence & ADR Analysis
                </span>
              </div>
            </div>

            {/* Navigation Segments */}
            <nav className="hidden md:flex items-center p-1 bg-slate-100 rounded-lg text-xs font-medium text-slate-600">
              <button
                onClick={() => setActiveView('agent')}
                className={`px-3.5 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeView === 'agent'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Vigilytics Workspace</span>
              </button>

              <button
                onClick={() => setActiveView('cases')}
                className={`px-3.5 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeView === 'cases'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Safety Cases ({cases.length})</span>
              </button>
            </nav>

            {/* Header Right Actions */}
            <div className="flex items-center gap-2">
              {/* Interface Mode Segmented Switcher */}
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                <button
                  onClick={() => setMode('pc')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer bg-white text-indigo-700 shadow-2xs"
                  title="Currently active in PC Desktop Workstation View"
                >
                  <Laptop className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">PC View</span>
                </button>
                <button
                  onClick={() => setMode('mobile')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer text-slate-500 hover:text-slate-900 hover:bg-slate-200/60"
                  title="Switch to Native Mobile App View"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mobile App</span>
                </button>
              </div>

              {/* Install PWA Pill */}
              <PwaInstallBanner variant="pill" />

              <button
                onClick={() => {
                  setActiveView('agent');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Case Analysis</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* VIEW 0: PV MULTI-AGENT HUB (PRIMARY WORKSPACE FOR USER DATA ANALYSIS) */}
        {activeView === 'agent' && (
          <PvAgentConsole
            existingCases={cases}
            onSaveCaseToWorkspace={(newCase) => {
              handleCaseCreated(newCase);
            }}
          />
        )}

        {/* VIEW 1: CASES & CLINICAL TRIAGE */}
        {activeView === 'cases' && (
          <div>
            {cases.length > 0 && currentCase ? (
              <div className="space-y-6">
                {/* Top Stage Tracker for Current Active Case */}
                <PvWorkflowBar
                  currentCase={currentCase}
                  onAdvanceStage={handleAdvanceStage}
                />

                {/* Main Console Split Layout */}
                <div className="grid grid-cols-12 gap-6">
                  {/* Left Column: Filterable Case Queue */}
                  <div className="col-span-12 lg:col-span-4 space-y-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search your cases..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      {/* Priority Filter Buttons */}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-500 uppercase">Priority:</span>
                        <div className="flex items-center gap-1">
                          {['ALL', 'P1', 'P2', 'P3', 'P4'].map((p) => (
                            <button
                              key={p}
                              onClick={() => setPriorityFilter(p)}
                              className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                                priorityFilter === p
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Stage Filter */}
                      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
                        <span className="font-bold text-slate-500 uppercase">Stage:</span>
                        <select
                          value={stageFilter}
                          onChange={(e) => setStageFilter(e.target.value)}
                          className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-700 text-xs"
                        >
                          <option value="ALL">All Stages</option>
                          <option value="Intake">Stage 1: Intake</option>
                          <option value="Triage">Stage 2: Triage</option>
                          <option value="ClinicalAssessment">Stage 3: Clinical</option>
                          <option value="SignalReview">Stage 4: Signal</option>
                          <option value="GovernanceEscalation">Stage 5: Governance</option>
                        </select>
                      </div>

                      {/* Export / Clear buttons */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                        <button
                          onClick={handleExportAllJson}
                          className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Export JSON</span>
                        </button>
                        <button
                          onClick={handleClearAllCases}
                          className="text-slate-400 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Clear Cases</span>
                        </button>
                      </div>
                    </div>

                    {/* Cases List */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-semibold">
                        <span>Your Cases ({filteredCases.length})</span>
                        <button
                          onClick={() => setShowIntakeModal(true)}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold"
                        >
                          + Add Case
                        </button>
                      </div>

                      {filteredCases.map((c) => {
                        const isSelected = c.id === currentCase?.id;
                        const isUrgent = c.priority.startsWith('P1');

                        return (
                          <div
                            key={c.id}
                            onClick={() => setSelectedCaseId(c.id)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-white border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-xs text-slate-900">{c.caseNumber}</span>
                                  <span
                                    className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                      isUrgent
                                        ? 'bg-rose-100 text-rose-800'
                                        : c.priority.startsWith('P2')
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-blue-100 text-blue-800'
                                    }`}
                                  >
                                    {c.priority.split(' ')[0]}
                                  </span>
                                  {c.isDuplicateFlagged && (
                                    <span className="text-[9px] font-bold bg-amber-100 text-amber-900 px-1 py-0.2 rounded">
                                      DUP MATCH
                                    </span>
                                  )}
                                  {(() => {
                                    const ddiSum = evaluateCaseDdiSummary(c.drugs, c.events);
                                    if (ddiSum.adrMayBeCausedByDdi) {
                                      return (
                                        <span
                                          className="text-[9px] font-black bg-rose-100 text-rose-900 border border-rose-300 px-1.5 py-0.2 rounded flex items-center gap-0.5"
                                          title="DDI identified as likely reason for the adverse reaction"
                                        >
                                          DDI ADR CAUSE
                                        </span>
                                      );
                                    }
                                    if (ddiSum.totalInteractions > 0) {
                                      return (
                                        <span
                                          className="text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.2 rounded"
                                          title="DDI identified in patient regimen"
                                        >
                                          DDI CAUTION
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>

                                <div className="text-xs font-bold text-slate-800 mt-1 line-clamp-1">
                                  {c.drugs[0]?.drugName || 'Suspect Product'} · {c.events[0]?.term || 'Adverse Event'}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Patient: {c.patient?.initials || 'PT'} ({c.patient?.age || 'Unknown'}yo {c.patient?.sex || 'Unknown'}) · {c.country}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCase(c.id);
                                  }}
                                  className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                                  title="Delete Case"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                                <div className="text-xs font-bold text-indigo-700 font-mono mt-0.5">
                                  {c.pegaSLA?.hoursRemaining ?? 24}h
                                </div>
                              </div>
                            </div>

                            {/* Stage progress ticker */}
                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                              <span className="font-medium text-indigo-900 bg-indigo-50 px-1.5 py-0.2 rounded">
                                {c.pegaStage}
                              </span>
                              <span className="text-slate-400 truncate max-w-[140px]">{c.assignedOperator}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Deep Clinical Review Console */}
                  <div className="col-span-12 lg:col-span-8">
                    <CaseDetailView
                      safetyCase={currentCase}
                      allCases={cases}
                      onUpdateCase={handleUpdateCase}
                      onAdvancePegaStage={handleAdvanceStage}
                      onSelectCaseById={(id) => setSelectedCaseId(id)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Clean Empty State: Guides User to Input Their Own Data */
              <div className="max-w-3xl mx-auto my-12 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
                  <HeartPulse className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    Pharmacovigilance Workspace Ready
                  </h2>
                  <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                    No pre-loaded data is active. Input your own individual case safety reports (ICSR), clinical narratives, or JSON files to run automated causality assessments, seriousness classifications, and duplicate detection.
                  </p>
                </div>

                {/* Primary Action CTAs */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setActiveView('agent')}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-white" />
                    <span>Start New Case Analysis</span>
                  </button>

                  <button
                    onClick={handleLoadSampleCases}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Load Demo Sample Case</span>
                  </button>
                </div>

                {/* What AegisPV Will Analyze for You */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left pt-6 border-t border-slate-100">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>Causality Scoring</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      Automated & interactive 10-question Naranjo Algorithm and WHO-UMC causality category evaluation.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>ICH E2A Seriousness</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      Immediate prioritization of life-threatening (P1), serious unlisted (P2), and labeled (P3/P4) outcomes.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      <span>Deduplication & Quality</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      Fuzzy demographic and drug-event matching across cases, plus targeted follow-up query letter drafting.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Case Intake Modal */}
      {showIntakeModal && (
        <CaseIntakeModal
          existingCases={cases}
          onClose={() => setShowIntakeModal(false)}
          onCaseCreated={handleCaseCreated}
        />
      )}

      {/* Minimal Enterprise Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            AegisPV Pharmacovigilance Decision-Support Suite · User Data Mode
          </div>
          <div className="text-[11px] text-slate-400">
            Compliant with ICH E2A, ICH E2B(R3), CIOMS I, and 21 CFR Part 11 Audit Integrity
          </div>
        </div>
      </footer>
      <ToastContainer />
    </div>
  );
}
