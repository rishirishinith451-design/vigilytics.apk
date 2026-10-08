import React, { useState } from 'react';
import { CLINICAL_LAB_PANELS, LabPanelDefinition, LabTemplateItem } from '../data/clinicalLabPanels';
import { FlaskConical, Plus, Trash2, CheckCircle2, AlertTriangle, Sparkles, Info, HelpCircle } from 'lucide-react';

export interface LabEntry {
  id: string;
  testName: string;
  date: string;
  value: string;
  unit: string;
  referenceRange: string;
  isAbnormal: boolean;
  significance: string;
}

interface LabInvestigationsBuilderProps {
  labs: LabEntry[];
  onChange: (labs: LabEntry[]) => void;
}

export const LabInvestigationsBuilder: React.FC<LabInvestigationsBuilderProps> = ({
  labs,
  onChange,
}) => {
  const [activePanelFilter, setActivePanelFilter] = useState<string>('ALL');

  // Quick Add an entire panel
  const handleAddPanel = (panel: LabPanelDefinition) => {
    const existingTestNames = new Set(labs.map((l) => l.testName.toLowerCase().trim()));
    const newItems: LabEntry[] = [];

    panel.tests.forEach((t) => {
      // Avoid duplicate test additions if already present
      if (!existingTestNames.has(t.testName.toLowerCase().trim())) {
        newItems.push({
          id: `lab-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          testName: t.testName,
          date: new Date().toISOString().split('T')[0],
          value: '',
          unit: t.unit,
          referenceRange: t.referenceRange,
          isAbnormal: t.isAbnormal,
          significance: t.significance,
        });
      }
    });

    if (newItems.length > 0) {
      onChange([...labs, ...newItems]);
    }
  };

  // Quick Add individual custom test
  const handleAddCustomLab = () => {
    const newEntry: LabEntry = {
      id: `lab-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      testName: '',
      date: new Date().toISOString().split('T')[0],
      value: '',
      unit: '',
      referenceRange: '',
      isAbnormal: true,
      significance: '',
    };
    onChange([...labs, newEntry]);
  };

  const handleUpdateLab = (index: number, field: keyof LabEntry, val: any) => {
    const updated = labs.map((l, i) => {
      if (i !== index) return l;
      return { ...l, [field]: val };
    });
    onChange(updated);
  };

  const handleRemoveLab = (index: number) => {
    onChange(labs.filter((_, i) => i !== index));
  };

  const handleClearAllLabs = () => {
    if (labs.length > 0) {
      onChange([]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header and Quick Panel Insert Buttons */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
            <FlaskConical className="w-4 h-4 text-emerald-600" />
            <span>Clinical Laboratory Investigations & Biomarkers ({labs.length} tests)</span>
          </div>

          <div className="flex items-center gap-2">
            {labs.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllLabs}
                className="text-[11px] text-slate-400 hover:text-rose-600 font-semibold cursor-pointer"
              >
                Clear Labs
              </button>
            )}
            <button
              type="button"
              onClick={handleAddCustomLab}
              className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md font-semibold text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-600" />
              <span>+ Custom Test</span>
            </button>
          </div>
        </div>

        {/* 1-Click PharmD Panel Buttons (LFT, RFT, URINE PCR, CBC, CPK/Troponin, TDM) */}
        <div className="p-3 bg-slate-100/80 rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>One-Click Clinical Panels (Essential for PharmD ADR Evaluation):</span>
            </span>
            <span className="text-[10px] text-slate-500 italic">Click to populate standard panel tests</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {CLINICAL_LAB_PANELS.map((panel) => {
              const isPanelAdded = panel.tests.every((pt) =>
                labs.some((l) => l.testName.toLowerCase().includes(pt.testName.split(' ')[0].toLowerCase()))
              );

              return (
                <button
                  key={panel.id}
                  type="button"
                  onClick={() => handleAddPanel(panel)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs active:scale-95 ${
                    panel.id === 'lft'
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                      : panel.id === 'rft'
                      ? 'bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-300'
                      : panel.id === 'urine_pcr'
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300 ring-1 ring-emerald-400'
                      : panel.id === 'cbc'
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-300'
                      : panel.id === 'cardiac_muscle'
                      ? 'bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-300'
                      : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border-cyan-300'
                  }`}
                  title={panel.description}
                >
                  <Plus className="w-3 h-3" />
                  <span>{panel.name}</span>
                  <span className="text-[10px] opacity-75 font-normal">({panel.tests.length})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lab Test Items List */}
      {labs.length === 0 ? (
        <div className="p-6 bg-white border border-dashed border-slate-300 rounded-xl text-center space-y-2">
          <FlaskConical className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="text-xs font-bold text-slate-700">No Laboratory Investigations Documented Yet</div>
          <p className="text-[11px] text-slate-500 max-w-md mx-auto">
            Click any of the panels above (<strong>LFT</strong>, <strong>RFT</strong>, <strong>Urine PCR</strong>, <strong>CBC</strong>, <strong>CPK/Troponin</strong>, or <strong>TDM</strong>) to quickly populate the clinical investigations required for ADR causality assessment.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {labs.map((lab, index) => (
            <div
              key={lab.id}
              className={`p-3 bg-white rounded-xl border shadow-2xs space-y-2 transition-all ${
                lab.isAbnormal ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200'
              }`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs">
                {/* Test Name */}
                <div className="sm:col-span-4">
                  <label className="text-[9px] font-semibold text-slate-500 uppercase block sm:hidden">Test Name</label>
                  <input
                    type="text"
                    value={lab.testName}
                    onChange={(e) => handleUpdateLab(index, 'testName', e.target.value)}
                    placeholder="Test Name (e.g. Urine PCR, ALT, Serum Creatinine)"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 text-xs focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Measured Value */}
                <div className="sm:col-span-2">
                  <label className="text-[9px] font-semibold text-slate-500 uppercase block sm:hidden">Measured Value</label>
                  <input
                    type="text"
                    value={lab.value}
                    onChange={(e) => handleUpdateLab(index, 'value', e.target.value)}
                    placeholder="e.g. 1.85 or 710"
                    className={`w-full px-2.5 py-1.5 rounded-lg font-mono font-bold text-xs border ${
                      lab.isAbnormal
                        ? 'bg-rose-50 border-rose-300 text-rose-900'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Unit */}
                <div className="sm:col-span-2">
                  <label className="text-[9px] font-semibold text-slate-500 uppercase block sm:hidden">Unit</label>
                  <input
                    type="text"
                    value={lab.unit}
                    onChange={(e) => handleUpdateLab(index, 'unit', e.target.value)}
                    placeholder="Unit (mg/dL, U/L, mg/mg)"
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-700 text-xs"
                  />
                </div>

                {/* Reference Range */}
                <div className="sm:col-span-2">
                  <label className="text-[9px] font-semibold text-slate-500 uppercase block sm:hidden">Ref Range</label>
                  <input
                    type="text"
                    value={lab.referenceRange}
                    onChange={(e) => handleUpdateLab(index, 'referenceRange', e.target.value)}
                    placeholder="Ref (e.g. < 0.20)"
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-500 text-xs font-mono"
                  />
                </div>

                {/* Abnormal Flag & Delete */}
                <div className="sm:col-span-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateLab(index, 'isAbnormal', !lab.isAbnormal)}
                    className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                      lab.isAbnormal
                        ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    }`}
                    title="Toggle abnormal finding flag"
                  >
                    {lab.isAbnormal ? '⚠️ Abnormal' : '✓ Normal'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemoveLab(index)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                    title="Remove this test"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Clinical Significance / PharmD Notes */}
              <div className="pt-1">
                <input
                  type="text"
                  value={lab.significance}
                  onChange={(e) => handleUpdateLab(index, 'significance', e.target.value)}
                  placeholder="Clinical significance / PharmD note (e.g. Confirms marked hepatocellular necrosis; exceeds Hy's law threshold)"
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 focus:bg-white"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
