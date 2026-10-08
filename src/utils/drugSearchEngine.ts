import { ClinicalDrugInfo, CLINICAL_DRUG_DATABASE } from '../data/clinicalDrugDb';
import { EXTENDED_WORLD_DRUGS } from '../data/worldDrugsList';
import GLOBAL_DRUGS_DICT from '../data/globalDrugsDictionary.json';

export interface DrugSearchResult {
  drugName: string;
  genericName: string;
  brandExamples: string;
  activeSubstance: string;
  drugClass: string;
  defaultDose: string;
  defaultRoute: string;
  defaultFrequency: string;
  typicalIndication: string;
  commonAdrs: string[];
  source: 'Local Formulary' | 'Global Drug Registry' | 'RxNorm / NLM' | 'Spelling Suggestion';
  matchScore: number;
}

// Levenshtein distance for fuzzy matching
export function calculateLevenshtein(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];
  for (let i = 0; i <= bn; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[bn][an];
}

// In-memory lookup maps for instant 0ms responses
const clinicalMap = new Map<string, ClinicalDrugInfo>();
for (const item of [...CLINICAL_DRUG_DATABASE, ...EXTENDED_WORLD_DRUGS]) {
  clinicalMap.set(item.drugName.toLowerCase(), item);
  clinicalMap.set(item.genericName.toLowerCase(), item);
  clinicalMap.set(item.activeSubstance.toLowerCase(), item);
}

// Cache for online queries to prevent redundant fetches
const searchCache = new Map<string, DrugSearchResult[]>();

export async function searchGlobalDrugs(query: string): Promise<DrugSearchResult[]> {
  const cleanQ = query.trim();
  if (!cleanQ || cleanQ.length < 1) {
    // Return high-frequency adverse reaction drugs when empty
    return CLINICAL_DRUG_DATABASE.slice(0, 10).map((d) => ({
      ...d,
      source: 'Local Formulary',
      matchScore: 100,
    }));
  }

  const lowerQ = cleanQ.toLowerCase();
  const results: DrugSearchResult[] = [];
  const seenNames = new Set<string>();

  // 1. Search clinical database first for rich clinical metadata (dosing, ADRs, labs)
  const allClinical = [...CLINICAL_DRUG_DATABASE, ...EXTENDED_WORLD_DRUGS];
  for (const item of allClinical) {
    const dName = item.drugName.toLowerCase();
    const gName = item.genericName.toLowerCase();
    const bName = item.brandExamples.toLowerCase();
    const aName = item.activeSubstance.toLowerCase();

    let score = 0;

    // Exact match
    if (dName === lowerQ || gName === lowerQ || aName === lowerQ) {
      score = 100;
    }
    // Prefix match
    else if (dName.startsWith(lowerQ) || gName.startsWith(lowerQ) || aName.startsWith(lowerQ)) {
      score = 92 - (dName.length - lowerQ.length) * 0.2;
    }
    // Brand match
    else if (bName.split(',').some((b) => b.trim().startsWith(lowerQ))) {
      score = 88;
    }
    // Substring match
    else if (dName.includes(lowerQ) || gName.includes(lowerQ) || aName.includes(lowerQ) || bName.includes(lowerQ)) {
      score = 78;
    }
    // Typo/fuzzy matching
    else if (lowerQ.length >= 3) {
      const distName = calculateLevenshtein(lowerQ, dName.slice(0, Math.min(dName.length, lowerQ.length + 2)));
      const distGen = calculateLevenshtein(lowerQ, gName.slice(0, Math.min(gName.length, lowerQ.length + 2)));
      const minDist = Math.min(distName, distGen);

      if (minDist <= 1) {
        score = 68;
      } else if (minDist <= 2 && lowerQ.length >= 5) {
        score = 58;
      }
    }

    if (score > 50) {
      const key = item.drugName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!seenNames.has(key)) {
        seenNames.add(key);
        results.push({
          drugName: item.drugName,
          genericName: item.genericName,
          brandExamples: item.brandExamples,
          activeSubstance: item.activeSubstance,
          drugClass: item.drugClass,
          defaultDose: item.defaultDose,
          defaultRoute: item.defaultRoute,
          defaultFrequency: item.defaultFrequency,
          typicalIndication: item.typicalIndication,
          commonAdrs: item.commonAdrs || [],
          source: 'Local Formulary',
          matchScore: score,
        });
      }
    }
  }

  // 2. Search 27,000+ Comprehensive Global Drugs Dictionary (every drug in the world)
  for (let i = 0; i < GLOBAL_DRUGS_DICT.length; i++) {
    const rawName = GLOBAL_DRUGS_DICT[i] as string;
    const lowerName = rawName.toLowerCase();
    const key = lowerName.replace(/[^a-z0-9]/g, '');
    if (seenNames.has(key)) continue;

    let score = 0;

    if (lowerName === lowerQ) {
      score = 99;
    } else if (lowerName.startsWith(lowerQ)) {
      score = 89 - Math.min(15, (lowerName.length - lowerQ.length) * 0.1);
    } else if (lowerName.includes(lowerQ)) {
      score = 74;
    } else if (lowerQ.length >= 3) {
      const sliceLen = Math.min(lowerName.length, lowerQ.length + 2);
      const dist = calculateLevenshtein(lowerQ, lowerName.slice(0, sliceLen));
      if (dist <= 1) {
        score = 65;
      } else if (dist <= 2 && lowerQ.length >= 5) {
        score = 55;
      }
    }

    if (score > 50) {
      seenNames.add(key);
      const matchedClinical = clinicalMap.get(lowerName);
      results.push({
        drugName: rawName,
        genericName: matchedClinical?.genericName || rawName,
        brandExamples: matchedClinical?.brandExamples || '',
        activeSubstance: matchedClinical?.activeSubstance || rawName,
        drugClass: matchedClinical?.drugClass || 'World Formulary Medication',
        defaultDose: matchedClinical?.defaultDose || 'Per patient clinical prescription',
        defaultRoute: matchedClinical?.defaultRoute || 'Oral / Systemic',
        defaultFrequency: matchedClinical?.defaultFrequency || 'As indicated',
        typicalIndication: matchedClinical?.typicalIndication || '',
        commonAdrs: matchedClinical?.commonAdrs || [],
        source: 'Global Drug Registry',
        matchScore: score,
      });

      if (results.length >= 40) break;
    }
  }

  // Sort by match score descending
  results.sort((a, b) => b.matchScore - a.matchScore);
  const topResults = results.slice(0, 20);

  // Check cache for online NLM additions
  if (searchCache.has(lowerQ)) {
    return mergeAndDeduplicate(topResults, searchCache.get(lowerQ) || []);
  }

  // 3. Online NIH ClinicalTables Query for latest additions or unique combinations
  try {
    const apiPromise = fetch(
      `https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search?terms=${encodeURIComponent(cleanQ)}&maxList=15`,
      { signal: AbortSignal.timeout(1500) }
    )
      .then(async (res) => {
        if (!res.ok) return [];
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[1])) {
          return data[1].map((raw: string) => {
            const cleanName = raw.replace(/\s*\([^)]*\)$/, '').trim();
            const formMatch = raw.match(/\(([^)]+)\)/);
            return {
              drugName: cleanName,
              genericName: cleanName,
              brandExamples: formMatch ? formMatch[1] : '',
              activeSubstance: cleanName,
              drugClass: 'RxNorm Verified Formulation',
              defaultDose: 'Per clinical protocol',
              defaultRoute: formMatch ? formMatch[1] : 'Oral / Systemic',
              defaultFrequency: 'Per clinical protocol',
              typicalIndication: 'Clinical indication',
              commonAdrs: [],
              source: 'RxNorm / NLM' as const,
              matchScore: 80,
            };
          });
        }
        return [];
      })
      .catch(() => []);

    const onlineResults = await apiPromise;
    searchCache.set(lowerQ, onlineResults);
    return mergeAndDeduplicate(topResults, onlineResults);
  } catch {
    return topResults;
  }
}

function mergeAndDeduplicate(
  local: DrugSearchResult[],
  online: DrugSearchResult[]
): DrugSearchResult[] {
  const seen = new Set<string>();
  const combined: DrugSearchResult[] = [];

  for (const item of local) {
    const key = item.drugName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(item);
    }
  }

  for (const item of online) {
    const key = item.drugName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(item);
    }
  }

  combined.sort((a, b) => b.matchScore - a.matchScore);
  return combined.slice(0, 25);
}
