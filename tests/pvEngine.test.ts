/**
 * Vigilytics Automated Verification & Requirements Test Suite
 * Tests clinical algorithms, disproportionality calculations, deduplication,
 * seriousness classification, and benchmark concordance.
 */

import {
  calculateNaranjoScore,
  determineWhoUmcCategory,
  determinePriority,
  calculateDisproportionality,
  checkDuplicateMatch,
  NARANJO_QUESTIONS,
} from '../src/utils/pvCalculators';
import { INITIAL_SAFETY_CASES, SAMPLE_SAFETY_CASES, ACTIVE_SIGNALS } from '../src/data/mockPvData';
import {
  BENCHMARK_PERFORMANCE_METRICS,
  BENCHMARK_TEST_CASES,
} from '../src/data/referenceBenchmark';
import { AdverseEvent, DrugAdministration } from '../src/types/pv';
import {
  assessDrugDdiAndAdr,
  assessPairwiseDdi,
  evaluateCaseDdiSummary,
} from '../src/utils/ddiEngine';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('  VIGILYTICS REQUIREMENTS & CLINICAL ALGORITHM TESTS  ');
  console.log('====================================================\n');

  // TEST SUITE 1: Naranjo Algorithm Scoring & Classification
  console.log('TEST SUITE 1: Naranjo Causality Algorithm');
  {
    // Case A: Definite causality (score >= 9)
    const definiteAnswers: Record<string, number> = {
      q1: 1, // Yes (+1)
      q2: 2, // Yes (+2)
      q3: 1, // Yes (+1)
      q4: 2, // Yes (+2)
      q5: 2, // No alternative cause (+2)
      q6: 0, // Unknown
      q7: 0, // Unknown
      q8: 0, // Unknown
      q9: 0, // Unknown
      q10: 1, // Yes (+1)
    };
    const resultDefinite = calculateNaranjoScore(definiteAnswers);
    assert(resultDefinite.totalScore === 9, 'Definite answers sum to 9', `got ${resultDefinite.totalScore}`);
    assert(resultDefinite.category === 'Definite', 'Score 9 classifies as Definite', `got ${resultDefinite.category}`);

    // Case B: Probable causality (score 5-8)
    const probableAnswers: Record<string, number> = {
      q1: 1, // Yes (+1)
      q2: 2, // Yes (+2)
      q3: 1, // Yes (+1)
      q4: 0, // Not rechallenged (0)
      q5: 2, // No (+2)
      q6: 0,
      q7: 0,
      q8: 0,
      q9: 0,
      q10: 1, // Yes (+1)
    };
    const resultProbable = calculateNaranjoScore(probableAnswers);
    assert(resultProbable.totalScore === 7, 'Probable answers sum to 7');
    assert(resultProbable.category === 'Probable', 'Score 7 classifies as Probable');

    // Case C: Possible causality (score 1-4)
    const possibleAnswers: Record<string, number> = {
      q1: 1,
      q2: 2,
      q3: 0,
      q4: 0,
      q5: 0,
      q6: 0,
      q7: 0,
      q8: 0,
      q9: 0,
      q10: 0,
    };
    const resultPossible = calculateNaranjoScore(possibleAnswers);
    assert(resultPossible.totalScore === 3, 'Possible answers sum to 3');
    assert(resultPossible.category === 'Possible', 'Score 3 classifies as Possible');

    // Case D: Doubtful causality (score <= 0)
    const doubtfulAnswers: Record<string, number> = {
      q1: 0,
      q2: -1, // Reaction occurred before drug
      q3: 0,
      q4: -1,
      q5: -1, // Clear alternative cause
      q6: -1,
      q7: 0,
      q8: 0,
      q9: 0,
      q10: 0,
    };
    const resultDoubtful = calculateNaranjoScore(doubtfulAnswers);
    assert(resultDoubtful.totalScore <= 0, 'Doubtful answers score <= 0');
    assert(resultDoubtful.category === 'Doubtful', 'Score <= 0 classifies as Doubtful');

    // WHO-UMC Categorization
    const whoCertain = determineWhoUmcCategory(9, 'Positive', 'Positive', false, true);
    assert(whoCertain === 'Certain', 'Positive rechallenge & dechallenge without alternative cause classifies as Certain');

    const whoProbable = determineWhoUmcCategory(6, 'Positive', 'Not Performed', false, true);
    assert(whoProbable === 'Probable / Likely', 'Positive dechallenge and score 6 classifies as Probable/Likely');
  }

  // TEST SUITE 2: ICH E2A Seriousness & Priority Routing
  console.log('\nTEST SUITE 2: ICH E2A Seriousness & Priority Routing');
  {
    // Case A: Life-threatening event -> P1 24h Expedited
    const lifeThreateningEvent: AdverseEvent[] = [
      {
        id: 'test-ev-1',
        term: 'Autoimmune myocarditis',
        lltTerm: 'Immune myocarditis',
        socTerm: 'Cardiac disorders',
        onsetDate: '2026-09-20',
        resolutionDate: null,
        outcome: 'Recovering / Resolving',
        seriousness: {
          death: false,
          lifeThreatening: true,
          hospitalization: true,
          disability: false,
          congenitalAnomaly: false,
          otherMedicallyImportant: true,
        },
        isSerious: true,
        isListedInSmPC: false,
        smPCDetails: 'Unlisted',
        severityGrade: 'Life-Threatening',
      },
    ];
    const priority1 = determinePriority(lifeThreateningEvent);
    assert(priority1.priority.startsWith('P1'), 'Life-threatening triggers P1 priority');
    assert(priority1.expeditedHours === 24, 'P1 priority sets 24h expedited window');
    assert(priority1.isSerious === true, 'Flagged as Serious');

    // Case B: Inpatient Hospitalization with unlisted serious -> P2 72h Expedited
    const hospitalizedUnlistedEvent: AdverseEvent[] = [
      {
        id: 'test-ev-2',
        term: 'Severe gastroparesis',
        lltTerm: 'Gastric stasis',
        socTerm: 'Gastrointestinal disorders',
        onsetDate: '2026-09-12',
        resolutionDate: null,
        outcome: 'Recovering / Resolving',
        seriousness: {
          death: false,
          lifeThreatening: false,
          hospitalization: true,
          disability: false,
          congenitalAnomaly: false,
          otherMedicallyImportant: true,
        },
        isSerious: true,
        isListedInSmPC: false, // Unlisted
        smPCDetails: 'Unlisted emerging signal',
        severityGrade: 'Severe',
      },
    ];
    const priority2 = determinePriority(hospitalizedUnlistedEvent);
    assert(priority2.priority.startsWith('P2'), 'Serious unlisted triggers P2 priority');
    assert(priority2.expeditedHours === 72, 'P2 priority sets 72h expedited window');

    // Case C: Serious labeled event -> P3 7d Standard
    const seriousLabeledEvent: AdverseEvent[] = [
      {
        id: 'test-ev-3',
        term: 'Gastrointestinal hemorrhage',
        lltTerm: 'GI bleed',
        socTerm: 'Gastrointestinal disorders',
        onsetDate: '2026-09-15',
        resolutionDate: null,
        outcome: 'Recovered / Resolved',
        seriousness: {
          death: false,
          lifeThreatening: false,
          hospitalization: true,
          disability: false,
          congenitalAnomaly: false,
          otherMedicallyImportant: true,
        },
        isSerious: true,
        isListedInSmPC: true, // Labeled
        smPCDetails: 'Listed labeled risk',
        severityGrade: 'Severe',
      },
    ];
    const priority3 = determinePriority(seriousLabeledEvent);
    assert(priority3.priority.startsWith('P3'), 'Serious labeled event triggers P3 priority');

    // Case D: Non-serious event -> P4 15d Routine
    const nonSeriousEvent: AdverseEvent[] = [
      {
        id: 'test-ev-4',
        term: 'Myalgia',
        lltTerm: 'Muscle soreness',
        socTerm: 'Musculoskeletal',
        onsetDate: '2026-09-01',
        resolutionDate: null,
        outcome: 'Recovered / Resolved',
        seriousness: {
          death: false,
          lifeThreatening: false,
          hospitalization: false,
          disability: false,
          congenitalAnomaly: false,
          otherMedicallyImportant: false,
        },
        isSerious: false,
        isListedInSmPC: true,
        smPCDetails: 'Very common labeled effect',
        severityGrade: 'Mild',
      },
    ];
    const priority4 = determinePriority(nonSeriousEvent);
    assert(priority4.priority.startsWith('P4'), 'Non-serious labeled triggers P4 routine priority');
    assert(priority4.isSerious === false, 'Flagged as non-serious');
  }

  // TEST SUITE 3: Disproportionality Statistics (PRR, ROR, IC, Evans Criteria)
  console.log('\nTEST SUITE 3: Disproportionality Statistics & Evans Criteria');
  {
    // Semaglutide + Gastroparesis 2x2 test matrix
    const table = {
      a: 142,
      b: 8420,
      c: 120,
      d: 34100,
    };
    const stats = calculateDisproportionality(table);

    assert(stats.prr > 1.0, `PRR is elevated (> 1.0): ${stats.prr}`);
    assert(stats.prrCiLower > 1.0, `PRR lower 95% CI is strictly > 1.0: ${stats.prrCiLower}`);
    assert(stats.chiSquare >= 4.0, `Chi-Square exceeds 4.0 threshold: ${stats.chiSquare}`);
    assert(stats.ror > 1.0, `Reporting Odds Ratio > 1.0: ${stats.ror}`);
    assert(stats.evansCriteriaMet === true, 'Evans criteria flagged as TRUE (PRR >= 2, Chi2 >= 4, N >= 3)');

    // Test non-signal background noise
    const noiseTable = {
      a: 2,
      b: 5000,
      c: 100,
      d: 30000,
    };
    const noiseStats = calculateDisproportionality(noiseTable);
    assert(noiseStats.evansCriteriaMet === false, 'Small count noise does not meet Evans criteria');
  }

  // TEST SUITE 4: Fuzzy Duplicate Detection Engine
  console.log('\nTEST SUITE 4: Fuzzy Duplicate Matching Engine');
  {
    const caseA = {
      initials: 'H.K.',
      age: 49,
      sex: 'Female',
      drug: 'Semaglutide',
      event: 'Gastroparesis',
      onsetDate: '2026-09-12',
      country: 'Germany',
    };
    const caseB = {
      caseId: 'case-006',
      caseNumber: 'PV-2026-EU-00402',
      initials: 'H.K.',
      age: 49,
      sex: 'Female',
      drug: 'Semaglutide (Ozempic)',
      event: 'Gastroparesis',
      onsetDate: '2026-09-14',
      country: 'Germany',
    };

    const duplicateCheck = checkDuplicateMatch(caseA, caseB);
    assert(duplicateCheck.matchScore >= 70, `Duplicate match score is high (${duplicateCheck.matchScore}%)`);
    assert(duplicateCheck.reasons.length >= 4, `Identified multiple concordant reasons: ${duplicateCheck.reasons.length}`);

    // Test distinct cases (negative control)
    const distinctCase = {
      caseId: 'case-001',
      caseNumber: 'PV-2026-US-00841',
      initials: 'R.M.',
      age: 58,
      sex: 'Male',
      drug: 'Pembrolizumab',
      event: 'Myocarditis',
      onsetDate: '2026-09-21',
      country: 'United States',
    };
    const negativeCheck = checkDuplicateMatch(caseA, distinctCase);
    assert(negativeCheck.matchScore < 20, `Distinct cases yield low match score (${negativeCheck.matchScore}%)`);
  }

  // TEST SUITE 5: Benchmark Validation Dataset Concordance
  console.log('\nTEST SUITE 5: Benchmark Validation Corpus Concordance');
  {
    assert(BENCHMARK_PERFORMANCE_METRICS.length === 4, 'Reports performance separately across 4 domains');
    for (const metric of BENCHMARK_PERFORMANCE_METRICS) {
      assert(metric.accuracy > 95, `${metric.domain} accuracy > 95% (${metric.accuracy}%)`);
      assert(metric.concordantCases + metric.discordantCases === metric.totalEvaluatedCases, `${metric.domain} case totals reconcile`);
    }

    assert(BENCHMARK_TEST_CASES.length >= 6, 'Contains audited benchmark test cases');
    const seriousnessRecall = BENCHMARK_TEST_CASES.filter((tc) => tc.goldStandardSeriousness && tc.predictedSeriousness).length;
    const totalSerious = BENCHMARK_TEST_CASES.filter((tc) => tc.goldStandardSeriousness).length;
    assert(seriousnessRecall === totalSerious, '100% recall on benchmark serious events (zero false negatives)');
  }

  // TEST SUITE 6: Safety Case Data Integrity & Epistemic Boundaries
  console.log('\nTEST SUITE 6: Case Registry Data Integrity & Fact-vs-Interpretation Split');
  {
    assert(INITIAL_SAFETY_CASES.length === 0, 'INITIAL_SAFETY_CASES is clean empty by default for user data entry');
    assert(SAMPLE_SAFETY_CASES.length >= 1, `Sample cases available for demo load: ${SAMPLE_SAFETY_CASES.length}`);
    for (const c of SAMPLE_SAFETY_CASES) {
      assert(Boolean(c.caseNumber), `Case has valid case number: ${c.caseNumber}`);
      assert(c.drugs.length > 0, `Case ${c.caseNumber} has at least 1 drug`);
      assert(c.events.length > 0, `Case ${c.caseNumber} has at least 1 adverse event`);
      assert(Boolean(c.patient.initials), `Case ${c.caseNumber} has patient initials`);
      assert(Boolean(c.factsVsInterpretation), `Case ${c.caseNumber} separates facts vs interpretations`);
      assert(c.factsVsInterpretation.reportedFacts.length > 0, `Case ${c.caseNumber} contains reported facts`);
      assert(c.factsVsInterpretation.algorithmicInterpretations.length > 0, `Case ${c.caseNumber} contains algorithmic interpretations`);
    }
  }

  // TEST SUITE 7: Drug-Drug Interaction (DDI) & ADR Causality Engine
  console.log('\nTEST SUITE 7: Drug-Drug Interaction (DDI) & ADR Causality Engine');
  {
    // Case 1: Simvastatin + Clarithromycin with Rhabdomyolysis
    const simvastatinDrug: DrugAdministration = {
      id: 'd1',
      drugName: 'Simvastatin',
      activeSubstance: 'Simvastatin',
      brandName: 'Zocor',
      role: 'Suspect',
      dose: '40 mg',
      route: 'Oral',
      frequency: 'Once daily',
      indication: 'Hyperlipidemia',
      startDate: '2025-01-01',
      stopDate: null,
      ongoing: true,
      batchLotNumber: '1',
      marketingAuthHolder: 'MAH',
      dechallenge: 'Positive',
      rechallenge: 'Not Performed',
      actionTaken: 'Drug Withdrawn',
      knownSmPCAdverseReactions: [],
    };

    const clarithromycinDrug: DrugAdministration = {
      id: 'd2',
      drugName: 'Clarithromycin',
      activeSubstance: 'Clarithromycin',
      brandName: 'Biaxin',
      role: 'Interacting',
      dose: '500 mg',
      route: 'Oral',
      frequency: 'Twice daily',
      indication: 'Pneumonia',
      startDate: '2026-09-20',
      stopDate: '2026-09-25',
      ongoing: false,
      batchLotNumber: '2',
      marketingAuthHolder: 'MAH',
      dechallenge: 'Positive',
      rechallenge: 'Not Performed',
      actionTaken: 'Drug Withdrawn',
      knownSmPCAdverseReactions: [],
    };

    const rhabdoEvent: AdverseEvent = {
      id: 'e1',
      term: 'Rhabdomyolysis',
      lltTerm: 'Acute rhabdomyolysis',
      socTerm: 'Musculoskeletal and connective tissue disorders',
      onsetDate: '2026-09-25',
      resolutionDate: null,
      outcome: 'Recovering / Resolving',
      seriousness: { death: false, lifeThreatening: true, hospitalization: true, disability: false, congenitalAnomaly: false, otherMedicallyImportant: true },
      isSerious: true,
      isListedInSmPC: true,
      smPCDetails: 'Contraindicated interaction',
      severityGrade: 'Life-Threatening',
    };

    const ddiResult = assessDrugDdiAndAdr(simvastatinDrug, [simvastatinDrug, clarithromycinDrug], [rhabdoEvent]);
    assert(ddiResult.hasInteraction === true, 'Simvastatin + Clarithromycin interaction detected');
    assert(ddiResult.severity === 'Contraindicated / Severe', 'Severity is Contraindicated / Severe');
    assert(ddiResult.mayCauseAdr === true, 'Interaction identified as cause of Rhabdomyolysis');
    assert(ddiResult.adrCausalityRole === 'Likely ADR Cause / Primary Driver', 'Classified as Likely ADR Cause / Primary Driver');

    // Case 2: Pairwise test Warfarin + Fluconazole with Gastrointestinal Bleed
    const bleedingEvent: AdverseEvent = {
      id: 'e2',
      term: 'Gastrointestinal hemorrhage',
      lltTerm: 'Upper GI bleeding',
      socTerm: 'Gastrointestinal disorders',
      onsetDate: '2026-09-20',
      resolutionDate: null,
      outcome: 'Recovering / Resolving',
      seriousness: { death: false, lifeThreatening: false, hospitalization: true, disability: false, congenitalAnomaly: false, otherMedicallyImportant: true },
      isSerious: true,
      isListedInSmPC: true,
      smPCDetails: '',
      severityGrade: 'Severe',
    };

    const warfarinDdi = assessPairwiseDdi('Warfarin', 'Fluconazole', [bleedingEvent]);
    assert(warfarinDdi.hasInteraction === true, 'Warfarin + Fluconazole interaction detected');
    assert(warfarinDdi.mayCauseAdr === true, 'Warfarin + Fluconazole causes bleeding ADR');
    assert(Boolean(warfarinDdi.cypOrTarget && warfarinDdi.cypOrTarget.includes('CYP2C9')), 'Mechanism targets CYP2C9 inhibition');

    // Case 3: Case-level DDI evaluation
    const caseSummary = evaluateCaseDdiSummary([simvastatinDrug, clarithromycinDrug], [rhabdoEvent]);
    assert(caseSummary.totalInteractions >= 1, 'Case summary counts total interactions');
    assert(caseSummary.adrMayBeCausedByDdi === true, 'Case summary flags that ADR may be caused by DDI');
  }

  // TEST SUITE 8: PharmD Formulary Drug Autocomplete & Clinical Lab Panels
  console.log('\nTEST SUITE 8: PharmD Formulary Drug Autocomplete & Lab Panels (LFT, RFT, Urine PCR)');
  {
    const { CLINICAL_DRUG_DATABASE } = await import('../src/data/clinicalDrugDb');
    const { CLINICAL_LAB_PANELS } = await import('../src/data/clinicalLabPanels');

    // Drug database validation
    assert(CLINICAL_DRUG_DATABASE.length >= 20, `Drug database contains comprehensive formulary: ${CLINICAL_DRUG_DATABASE.length}`);
    const simva = CLINICAL_DRUG_DATABASE.find((d) => d.drugName === 'Simvastatin');
    assert(Boolean(simva), 'Simvastatin present in clinical drug database');
    assert(Boolean(simva?.cypInvolvement?.includes('CYP3A4')), 'Simvastatin has CYP3A4 substrate documentation');

    const vanco = CLINICAL_DRUG_DATABASE.find((d) => d.drugName === 'Vancomycin');
    assert(Boolean(vanco), 'Vancomycin present in clinical drug database');
    assert(Boolean(vanco?.monitoringLabs.includes('Urine PCR')), 'Vancomycin monitoring includes Urine PCR');

    // Lab panels validation
    assert(CLINICAL_LAB_PANELS.length >= 6, `Comprehensive lab panels available: ${CLINICAL_LAB_PANELS.length}`);
    const lft = CLINICAL_LAB_PANELS.find((p) => p.id === 'lft');
    assert(Boolean(lft), 'Liver Function Tests (LFT) panel configured');
    assert(lft?.tests.some((t) => t.testName.includes('ALT')) === true, 'LFT panel includes ALT / SGPT');
    assert(lft?.tests.some((t) => t.testName.includes('Bilirubin')) === true, 'LFT panel includes Bilirubin');

    const rft = CLINICAL_LAB_PANELS.find((p) => p.id === 'rft');
    assert(Boolean(rft), 'Renal Function Tests (RFT) panel configured');
    assert(rft?.tests.some((t) => t.testName.includes('Creatinine')) === true, 'RFT panel includes Serum Creatinine');
    assert(rft?.tests.some((t) => t.testName.includes('eGFR')) === true, 'RFT panel includes eGFR');

    const urinePcr = CLINICAL_LAB_PANELS.find((p) => p.id === 'urine_pcr');
    assert(Boolean(urinePcr), 'Urine PCR & Urinalysis panel configured');
    assert(urinePcr?.tests.some((t) => t.testName.includes('Urine Protein-to-Creatinine Ratio')) === true, 'Urine PCR includes quantitative UPCR');

    const cpkPanel = CLINICAL_LAB_PANELS.find((p) => p.id === 'cardiac_muscle');
    assert(Boolean(cpkPanel), 'Cardiac & Muscle Biomarkers panel configured');
    assert(cpkPanel?.tests.some((t) => t.testName.includes('Creatine Kinase / CPK')) === true, 'Includes CPK for statin rhabdomyolysis');
    assert(cpkPanel?.tests.some((t) => t.testName.includes('Troponin')) === true, 'Includes Troponin for immune myocarditis');

    // Global drug search & typo tolerance validation
    const { searchGlobalDrugs, calculateLevenshtein } = await import('../src/utils/drugSearchEngine');
    assert(calculateLevenshtein('simvastin', 'simvastatin') === 2, 'Levenshtein typo distance calculated accurately');
    const typoResults = await searchGlobalDrugs('simvastin');
    assert(typoResults.length > 0, 'Misspelled search "simvastin" returns autocomplete results');
    assert(typoResults.some((r) => r.drugName.toLowerCase().includes('simvastatin')), 'Fuzzy search accurately matched Simvastatin for typo "simvastin"');

    const worldResults = await searchGlobalDrugs('paracetamol');
    assert(worldResults.some((r) => r.drugName.toLowerCase().includes('paracetamol') || r.genericName.toLowerCase().includes('paracetamol')), 'World drug search finds Paracetamol');
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();
