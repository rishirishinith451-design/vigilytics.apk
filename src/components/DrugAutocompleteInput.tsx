import React, { useState, useRef, useEffect } from 'react';
import { ClinicalDrugInfo } from '../data/clinicalDrugDb';
import { searchGlobalDrugs, DrugSearchResult } from '../utils/drugSearchEngine';
import { Pill, Search, Globe, AlertCircle, Loader2 } from 'lucide-react';

interface DrugAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectDrug?: (drug: ClinicalDrugInfo) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export const DrugAutocompleteInput: React.FC<DrugAutocompleteInputProps> = ({
  value,
  onChange,
  onSelectDrug,
  placeholder = 'Type any drug in the world (e.g. Paracetamol, Simvastatin, Paxlovid, Ozempic)...',
  className = '',
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<DrugSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<any>(null);

  // Perform search whenever value changes or dropdown opens
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!isOpen) return;

    // Immediate instant results for fast UI feedback
    searchGlobalDrugs(value).then((instantResults) => {
      setSuggestions(instantResults);
    });

    // Also trigger debounce for any online enrichment
    setIsLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchGlobalDrugs(value);
        setSuggestions(results);
      } catch (err) {
        console.error('Drug search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 120);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [value, isOpen]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (drug: DrugSearchResult) => {
    onChange(drug.drugName);
    if (onSelectDrug) {
      onSelectDrug({
        drugName: drug.drugName,
        genericName: drug.genericName || drug.drugName,
        brandExamples: drug.brandExamples || '',
        activeSubstance: drug.activeSubstance || drug.drugName,
        drugClass: drug.drugClass || 'Prescription Drug',
        defaultDose: drug.defaultDose || 'Standard therapeutic dose',
        defaultRoute: drug.defaultRoute || 'Oral',
        defaultFrequency: drug.defaultFrequency || 'Once daily',
        typicalIndication: drug.typicalIndication || '',
        commonAdrs: drug.commonAdrs || [],
        monitoringLabs: [],
      });
    }
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightIndex(-1);
          }}
          onFocus={() => {
            setIsOpen(true);
            searchGlobalDrugs(value).then(setSuggestions);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full pr-8 ${className}`}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
          ) : (
            <Search className="w-3.5 h-3.5" />
          )}
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-80 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2.5 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
            <span className="flex items-center gap-1.5 text-indigo-700">
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span>Global Drug Formulary & RxNorm Autocomplete</span>
            </span>
            <span className="text-[9px] text-slate-400 font-normal">
              {suggestions.length} match(es) · Any spelling or typo
            </span>
          </div>

          {suggestions.length === 0 && !isLoading && (
            <div className="p-4 text-center text-xs text-slate-500">
              <span>No match found for "{value}". You can continue typing to save as custom investigational substance.</span>
            </div>
          )}

          {suggestions.map((drug, idx) => {
            const isHighlighted = idx === highlightIndex;
            const isRxNorm = drug.source.includes('RxNorm') || drug.source.includes('RxNav');

            return (
              <button
                key={`${drug.drugName}-${idx}`}
                type="button"
                onClick={() => handleSelect(drug)}
                onMouseEnter={() => setHighlightIndex(idx)}
                className={`w-full text-left p-3 transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                  isHighlighted ? 'bg-indigo-50/90 text-indigo-950' : 'hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-xs text-slate-900">{drug.drugName}</span>
                    {drug.brandExamples && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        {drug.brandExamples}
                      </span>
                    )}
                    <span
                      className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border ${
                        isRxNorm
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {drug.source}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 truncate">
                    Class: <span className="font-medium text-slate-700">{drug.drugClass}</span>
                  </div>

                  {drug.commonAdrs && drug.commonAdrs.length > 0 && (
                    <div className="text-[10px] text-rose-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span className="truncate">Reported ADRs: {drug.commonAdrs.slice(0, 3).join(', ')}</span>
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {drug.defaultDose || 'Auto-Dose'}
                  </span>
                  <div className="text-[9px] text-slate-400 mt-1">{drug.defaultRoute || 'Oral'}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
