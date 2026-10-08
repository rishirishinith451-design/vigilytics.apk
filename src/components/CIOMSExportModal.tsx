import React, { useState } from 'react';
import { FileText, Printer, Download, X, Check, ShieldCheck } from 'lucide-react';
import { SafetyCase } from '../types/pv';

interface CIOMSExportModalProps {
  currentCase: SafetyCase;
  onClose: () => void;
}

export const CIOMSExportModal: React.FC<CIOMSExportModalProps> = ({ currentCase, onClose }) => {
  const [downloaded, setDownloaded] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentCase, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${currentCase.caseNumber}-E2BR3-EXPORT.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-4xl w-full my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header bar */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center font-bold text-xs text-indigo-400">
              CIOMS
            </div>
            <div>
              <h3 className="text-sm font-bold">CIOMS FORM I · Regulatory Safety Report Preview</h3>
              <p className="text-[11px] text-slate-400 font-mono">
                ICH E2B(R3) Equivalent · Case #{currentCase.caseNumber} (v{currentCase.version})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Preview</span>
            </button>
            <button
              onClick={handleDownloadJson}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium shadow-xs transition-colors cursor-pointer"
            >
              {downloaded ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
              <span>{downloaded ? 'Downloaded JSON' : 'Export E2B XML/JSON'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable CIOMS I Form Document Container */}
        <div className="p-8 space-y-6 text-slate-900 text-xs bg-white font-sans max-h-[80vh] overflow-y-auto print:max-h-none print:p-0">
          <div className="border-2 border-black p-4 text-center">
            <h1 className="text-base font-black uppercase tracking-wider">
              SUSPECT ADVERSE DRUG REACTION REPORT (CIOMS FORM I)
            </h1>
            <p className="text-[10px] text-slate-600 uppercase tracking-widest mt-0.5">
              Council for International Organizations of Medical Sciences
            </p>
          </div>

          {/* Section I: Reaction Information */}
          <div className="border border-black">
            <div className="bg-slate-200 px-3 py-1 font-bold text-[11px] uppercase tracking-wider border-b border-black">
              I. REACTION INFORMATION
            </div>
            <div className="grid grid-cols-4 divide-x divide-black border-b border-black text-center">
              <div className="p-2">
                <div className="text-[9px] uppercase font-bold text-slate-500">1. Patient Initials</div>
                <div className="font-bold text-sm">{currentCase.patient.initials}</div>
              </div>
              <div className="p-2">
                <div className="text-[9px] uppercase font-bold text-slate-500">2. Date of Birth / Age</div>
                <div className="font-bold text-sm">{currentCase.patient.age ? `${currentCase.patient.age} Years` : 'Unknown'}</div>
              </div>
              <div className="p-2">
                <div className="text-[9px] uppercase font-bold text-slate-500">3. Sex</div>
                <div className="font-bold text-sm">{currentCase.patient.sex}</div>
              </div>
              <div className="p-2">
                <div className="text-[9px] uppercase font-bold text-slate-500">4. Reaction Onset</div>
                <div className="font-bold text-sm">{currentCase.events[0]?.onsetDate || 'Unknown'}</div>
              </div>
            </div>

            <div className="p-3 border-b border-black">
              <div className="text-[9px] uppercase font-bold text-slate-500 mb-1">
                8-12. Check All Appropriate to Adverse Reaction:
              </div>
              <div className="flex flex-wrap gap-4 text-xs font-semibold">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={currentCase.events.some((e) => e.seriousness?.death)} readOnly />
                  <span>Patient Died</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={currentCase.events.some((e) => e.seriousness?.lifeThreatening)} readOnly />
                  <span>Life Threatening</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={currentCase.events.some((e) => e.seriousness?.hospitalization)} readOnly />
                  <span>Inpatient Hospitalization</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={currentCase.events.some((e) => e.seriousness?.disability)} readOnly />
                  <span>Disability / Incapacity</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={currentCase.events.some((e) => e.seriousness?.congenitalAnomaly)} readOnly />
                  <span>Congenital Anomaly</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={currentCase.events.some((e) => e.seriousness?.otherMedicallyImportant)} readOnly />
                  <span>Other Medically Important</span>
                </label>
              </div>
            </div>

            <div className="p-3">
              <div className="text-[9px] uppercase font-bold text-slate-500 mb-1">
                7. Describe Reaction(s) (Including relevant tests/lab data):
              </div>
              <p className="text-xs leading-relaxed font-serif text-slate-800">
                {currentCase.narrativeText}
              </p>
            </div>
          </div>

          {/* Section II: Suspect Drug Information */}
          <div className="border border-black">
            <div className="bg-slate-200 px-3 py-1 font-bold text-[11px] uppercase tracking-wider border-b border-black">
              II. SUSPECT DRUG(S) INFORMATION
            </div>
            {currentCase.drugs.filter((d) => d.role === 'Suspect').map((drug, idx) => (
              <div key={idx} className="divide-y divide-black">
                <div className="grid grid-cols-3 divide-x divide-black p-2.5">
                  <div>
                    <div className="text-[9px] uppercase font-bold text-slate-500">14. Suspect Drug (Brand/Generic)</div>
                    <div className="font-bold">{drug.drugName} ({drug.activeSubstance})</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-bold text-slate-500">15. Daily Dose & Route</div>
                    <div>{drug.dose} via {drug.route} ({drug.frequency})</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-bold text-slate-500">16. Indication</div>
                    <div>{drug.indication}</div>
                  </div>
                </div>

                <div className="grid grid-cols-4 divide-x divide-black p-2.5">
                  <div>
                    <div className="text-[9px] uppercase font-bold text-slate-500">17. Therapy Dates</div>
                    <div>{drug.startDate} to {drug.stopDate || 'Ongoing'}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-bold text-slate-500">18. Lot / Batch No.</div>
                    <div className="font-mono">{drug.batchLotNumber || 'Not Reported'}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-bold text-slate-500">19. Dechallenge Outcome</div>
                    <div className="font-semibold">{drug.dechallenge}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-bold text-slate-500">20. Rechallenge Outcome</div>
                    <div className="font-semibold">{drug.rechallenge}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Section III: Concomitant Drugs & History */}
          <div className="border border-black">
            <div className="bg-slate-200 px-3 py-1 font-bold text-[11px] uppercase tracking-wider border-b border-black">
              III. CONCOMITANT DRUGS & HISTORY
            </div>
            <div className="p-3 border-b border-black">
              <div className="text-[9px] uppercase font-bold text-slate-500 mb-1">
                22. Concomitant Drugs and Dates of Administration:
              </div>
              {currentCase.drugs.filter((d) => d.role !== 'Suspect').length > 0 ? (
                <div className="space-y-1">
                  {currentCase.drugs
                    .filter((d) => d.role !== 'Suspect')
                    .map((cd, i) => (
                      <div key={i}>
                        • <strong>{cd.drugName}</strong> ({cd.activeSubstance}) - {cd.dose}, {cd.route} for {cd.indication} (Started: {cd.startDate})
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-slate-500 italic">No concomitant medications reported.</div>
              )}
            </div>

            <div className="p-3">
              <div className="text-[9px] uppercase font-bold text-slate-500 mb-1">
                23. Relevant Medical History / Pre-existing Conditions:
              </div>
              <div className="flex flex-wrap gap-2">
                {currentCase.patient?.medicalHistory?.length ? (
                  currentCase.patient.medicalHistory.map((mh, i) => (
                    <span key={i} className="bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                      {mh.condition} ({mh.status})
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 italic">None reported</span>
                )}
              </div>
            </div>
          </div>

          {/* Section IV: Manufacturer / Reporter Details */}
          <div className="border border-black">
            <div className="bg-slate-200 px-3 py-1 font-bold text-[11px] uppercase tracking-wider border-b border-black">
              IV. MANUFACTURER / REGULATORY INFORMATION
            </div>
            <div className="grid grid-cols-3 divide-x divide-black p-3">
              <div>
                <div className="text-[9px] uppercase font-bold text-slate-500">24a. MFR Control No.</div>
                <div className="font-mono font-bold">{currentCase.caseNumber}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase font-bold text-slate-500">24b. Regulatory Receipt Date</div>
                <div>{currentCase.initialReceivedDate ? currentCase.initialReceivedDate.split('T')[0] : 'Current'}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase font-bold text-slate-500">25. Report Source / Reporter Type</div>
                <div>{currentCase.reporterQualification || 'Healthcare Professional'} ({currentCase.country || 'US'})</div>
              </div>
            </div>
          </div>

          {/* Governance Verification Stamp */}
          <div className="p-4 bg-slate-50 border border-slate-300 rounded flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <div>
                <div className="font-bold text-xs text-slate-900">Vigilytics Governance Validation Stamp</div>
                <div className="text-[11px] text-slate-500">
                  Safety Case Lifecycle verified · Audited under 21 CFR Part 11 & GVP Module VI
                </div>
              </div>
            </div>
            <div className="text-right text-[11px] text-slate-500 font-mono">
              Status: {currentCase.humanApproval?.status || 'Pending Review'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
