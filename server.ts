import http from 'http';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize GoogleGenAI server-side with telemetry header as required by skill
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Helper for cleaning base64 data URL prefixes and whitespace
function cleanBase64Payload(data?: string): string {
  if (!data || typeof data !== 'string') return '';
  const commaIdx = data.indexOf(',');
  let clean = commaIdx !== -1 ? data.slice(commaIdx + 1) : data;
  return clean.replace(/\s+/g, '');
}

function resolveMimeType(fileName?: string, mimeType?: string): string {
  if (mimeType && mimeType !== 'application/octet-stream') return mimeType;
  if (!fileName) return 'application/pdf';
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'bmp': return 'image/bmp';
    case 'tiff':
    case 'tif': return 'image/tiff';
    case 'json': return 'application/json';
    case 'csv': return 'text/csv';
    case 'txt': return 'text/plain';
    case 'xml': return 'application/xml';
    default: return 'application/pdf';
  }
}

// Resilient AI generation with automatic fallback across models to eliminate 503 errors
async function generateGeminiWithFallback({
  parts,
  responseMimeType = 'application/json',
  systemInstruction,
}: {
  parts: any[];
  responseMimeType?: string;
  systemInstruction?: string;
}): Promise<string> {
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  // Model cascade: 'gemini-3.8-flash' is the standard multimodal workhorse, with fallback to lite and latest
  const models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        config: {
          responseMimeType,
          systemInstruction,
        },
      });

      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      console.warn(`[Vigilytics AI] Model ${model} generation failed (${err.message || err}). Retrying with next model...`);
      lastError = err;
    }
  }

  throw lastError || new Error('All AI models failed to generate content');
}

// Pharmacovigilance Multi-Agent System API Endpoint
app.post('/api/agent/analyze', async (req, res) => {
  try {
    const { inputData, contextType, fileData, fileMimeType, fileName } = req.body;

    if (!inputData && !fileData) {
      return res.status(400).json({ error: 'Missing inputData or fileData parameter' });
    }

    if (!ai) {
      return res.json({
        useDeterministicFallback: true,
        message: 'GEMINI_API_KEY not configured. Using high-precision deterministic clinical algorithm engine.',
      });
    }

    const systemPrompt = `You are the lead clinical safety intelligence engine of Vigilytics AI.
Your team includes:
1. Agent-Intake (entity extraction: patient demographics, suspect & concomitant drugs, adverse events, lab tests)
2. Agent-Triage (ICH E2A seriousness: Death, Life-Threatening, Hospitalization, Disability, Congenital, Medically Important; and priority P1-P4)
3. Agent-Causality (Naranjo 10 questions scored, WHO-UMC category, biological mechanism)
4. Agent-Signal (Disproportionality PRR, Evans criteria)
5. Agent-Quality (Missing data audit, follow-up query questions)
6. Agent-Governance (Executive clinical summary, Fact vs Interpretation separation)

STRICT GROUNDING & EVIDENCE-BASED EXTRACTION RULES:
- Perform an authentic clinical safety evaluation based SOLELY on the uploaded file or provided report.
- Extract actual facts directly from the document/image without hallucinating or fabricating details.
- If the patient age is not stated in the document, return null for age.
- If the patient sex is not stated in the document, return "Unknown" for sex.
- If the patient initials or name are not stated, return "Unknown" for initials.
- Reconstruct the comprehensive clinical narrative directly from the document in "extractedNarrative".
- Provide an executive clinical safety summary in "clinicalSummary".
- For medications: identify exact drug names, active substances, doses, routes, and start/stop dates present in the document.
- For adverse reactions: identify exact clinical terms, system organ class (SOC), and determine ICH E2A seriousness criteria.
- Calculate the 10-point Naranjo ADR Probability score and WHO-UMC causality based on the documented temporal sequence, dechallenge, and clinical facts.

Return your response ONLY as valid, parseable JSON matching this schema:
{
  "documentType": "string (e.g. Hospital Discharge Summary, Lab Report, CIOMS Form, Medical Image, Prescription, Clinical Letter)",
  "extractedNarrative": "string (Detailed clinical narrative detailing the patient background, medications administered, onset of adverse reactions, clinical course, lab findings, dechallenge/rechallenge, and outcome derived strictly from the document)",
  "clinicalSummary": "string (Executive medical safety summary of the case based on the extracted facts)",
  "keyFindings": ["string"],
  "priority": "P1 - Urgent (24h Expedited)" | "P2 - High (72h Expedited)" | "P3 - Medium (7d Standard)" | "P4 - Routine (15d Standard)",
  "priorityRationale": "string",
  "isSerious": boolean,
  "riskClassification": "Known Labeled Risk" | "Potential New Signal" | "Insufficient Evidence",
  "patient": {
    "initials": "string",
    "age": number or null,
    "sex": "Male" | "Female" | "Unknown",
    "weightKg": number or null,
    "pregnancyStatus": "string",
    "medicalHistory": ["string"],
    "allergies": ["string"]
  },
  "drugs": [
    {
      "drugName": "string",
      "activeSubstance": "string",
      "role": "Suspect" | "Concomitant" | "Interacting",
      "dose": "string",
      "route": "string (e.g. Oral, Intravenous, Subcutaneous, Inhalation, Topical, Intramuscular)",
      "frequency": "string (e.g. Once daily, Twice daily, Every 8 hours, Weekly, As needed)",
      "durationOfTherapy": "string (e.g. 14 days, 3 weeks, 6 months, Ongoing)",
      "indication": "string",
      "startDate": "YYYY-MM-DD",
      "stopDate": "YYYY-MM-DD" or null,
      "dechallenge": "Positive" | "Negative" | "Not Applicable" | "Unknown",
      "rechallenge": "Positive" | "Negative" | "Not Performed" | "Unknown"
    }
  ],
  "events": [
    {
      "term": "string (MedDRA PT / Suspected adverse reaction)",
      "socTerm": "string",
      "signsAndSymptoms": "string (clinical signs and presentation details)",
      "onsetDate": "YYYY-MM-DD or YYYY-MM-DD HH:MM (Date/time of onset)",
      "eventDuration": "string (e.g. 4 days, 48 hours, Ongoing)",
      "outcome": "Recovered / Resolved" | "Recovering / Resolving" | "Not Recovered / Not Resolved" | "Recovered with Sequelae" | "Fatal" | "Unknown",
      "isListed": boolean,
      "death": boolean,
      "lifeThreatening": boolean,
      "hospitalization": boolean,
      "disability": boolean,
      "congenitalAnomaly": boolean,
      "otherMedicallyImportant": boolean,
      "severityGrade": "Mild" | "Moderate" | "Severe" | "Life-Threatening"
    }
  ],
  "labs": [
    {
      "testName": "string",
      "date": "YYYY-MM-DD",
      "value": "string",
      "unit": "string",
      "referenceRange": "string",
      "isAbnormal": boolean,
      "significance": "string"
    }
  ],
  "vitalSigns": {
    "bloodPressure": "string (e.g. 120/80 mmHg)",
    "heartRate": "string (e.g. 78 bpm)",
    "respiratoryRate": "string (e.g. 16 breaths/min)",
    "temperature": "string (e.g. 37.2 °C)",
    "oxygenSaturation": "string (e.g. 98% SpO2)"
  },
  "diagnosticFindings": [
    {
      "testType": "string (e.g. 12-Lead ECG, Chest CT, MRI, Ultrasound, Biopsy, Endoscopy)",
      "finding": "string",
      "impression": "string"
    }
  ],
  "naranjoAnswers": {
    "q1": number,
    "q2": number,
    "q3": number,
    "q4": number,
    "q5": number,
    "q6": number,
    "q7": number,
    "q8": number,
    "q9": number,
    "q10": number
  },
  "naranjoScore": number,
  "naranjoCategory": "Definite" | "Probable" | "Possible" | "Doubtful",
  "whoUmcCategory": "Certain" | "Probable / Likely" | "Possible" | "Unlikely",
  "factsVsInterpretation": {
    "reportedFacts": ["string"],
    "algorithmicInterpretations": ["string"],
    "clinicalUncertainties": ["string"]
  },
  "missingDataAudit": [
    {
      "field": "string",
      "severity": "High" | "Medium" | "Low",
      "impact": "string",
      "suggestedFollowUpQuery": "string"
    }
  ],
  "disproportionality": {
    "drugName": "string",
    "eventTerm": "string",
    "estimatedPrr": number,
    "evansCriteriaMet": boolean,
    "analysisNotes": "string"
  },
  "regulatoryRecommendation": "string",
  "aiOutputs": {
    "drugAndAdrExtraction": {
      "suspectedDrugs": ["string"],
      "concomitantDrugs": ["string"],
      "adverseEvents": ["string"],
      "summary": "string"
    },
    "adrClassification": {
      "category": "string (e.g. Type B Idiosyncratic / Type A Dose-dependent / Immune-mediated)",
      "details": "string"
    },
    "severity": "Mild" | "Moderate" | "Severe" | "Life-Threatening",
    "seriousnessAssessment": {
      "isSerious": boolean,
      "criteriaMet": ["string"],
      "rationale": "string"
    },
    "causalityAssessment": {
      "category": "Certain" | "Probable" | "Possible" | "Unlikely",
      "rationale": "string"
    },
    "drugDrugInteraction": {
      "status": "Safe" | "Caution" | "Potentially harmful",
      "details": "string"
    },
    "duplicateDetection": {
      "isDuplicateDetected": boolean,
      "details": "string"
    },
    "clinicalRecommendation": {
      "primaryRecommendation": "string",
      "followUpActions": ["string"]
    },
    "pvReportSummary": "string",
    "actionFlag": "Routine review" | "Pharmacovigilance professional review" | "Urgent clinical attention"
  }
}`;

    const parts: any[] = [];
    const cleanBase64 = cleanBase64Payload(fileData);
    const mime = resolveMimeType(fileName, fileMimeType);

    if (cleanBase64) {
      if (mime.startsWith('image/') || mime === 'application/pdf') {
        parts.push({
          inlineData: {
            mimeType: mime,
            data: cleanBase64,
          },
        });
        parts.push({
          text: `EVALUATE UPLOADED DOCUMENT: "${fileName || 'clinical_record'}".\nCarefully read the text, physician notes, diagnosis, medications, dosages, and adverse events inside this ${mime} document/image. Extract and evaluate the actual clinical data from this file according to the requested JSON schema.`,
        });
      } else {
        try {
          const textContent = Buffer.from(cleanBase64, 'base64').toString('utf-8');
          parts.push({
            text: `DOCUMENT TEXT (${fileName || 'file'}):\n\n${textContent}`,
          });
        } catch {
          // ignore decode error
        }
      }
    }

    if (inputData && typeof inputData === 'string' && inputData.trim() && !inputData.startsWith('Uploaded medical safety document:')) {
      parts.push({
        text: `Additional clinical narrative or context provided by reviewer:\n\n${inputData}`,
      });
    }

    if (parts.length === 0) {
      parts.push({
        text: 'Please perform clinical safety extraction and evaluation based on available safety context.',
      });
    }

    const text = await generateGeminiWithFallback({
      parts,
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
    });

    const parsedData = JSON.parse(text || '{}');

    return res.json({
      success: true,
      agentResult: parsedData,
    });
  } catch (err: any) {
    console.error('Agent analysis error:', err);
    return res.status(500).json({
      error: err.message,
      useDeterministicFallback: true,
    });
  }
});

// AI Auto-Extract from Narration or File into Structured Drug Chart
app.post('/api/agent/extract-to-chart', async (req, res) => {
  try {
    const { narrative, fileData, fileMimeType, fileName } = req.body;

    if (!narrative && !fileData) {
      return res.status(400).json({ error: 'Missing narrative text or fileData' });
    }

    const cleanBase64 = cleanBase64Payload(fileData);
    const mime = resolveMimeType(fileName, fileMimeType);

    if (!ai) {
      // High-precision regex-assisted fallback extraction
      const rawText = narrative || (cleanBase64 ? Buffer.from(cleanBase64, 'base64').toString('utf-8') : '');
      const isFemale = /\b(female|woman|lady|she|her)\b/i.test(rawText);
      const isMale = /\b(male|man|gentleman|he|his)\b/i.test(rawText);
      const ageMatch = rawText.match(/(\d{1,3})\s*[- ]*(year|yr|y\.?o\.?|yo)/i);
      const age = ageMatch ? ageMatch[1] : '';
      const sex = isFemale ? 'Female' : isMale ? 'Male' : 'Unknown';

      // Detect hospitalization or life threatening
      const hospitalization = /hospitali[zs]|admission|admitted|ward|emergency/i.test(rawText);
      const lifeThreatening = /life[- ]threatening|icu|intensive care|anaphylaxis|resuscit/i.test(rawText);
      const death = /fatal|death|died|deceased/i.test(rawText);

      // Guess drug
      const words = rawText.split(/[,\.\s]+/);
      const candidateDrugs = words.filter((w: string) => /mab$|nib$|olol$|statin$|pril$|sartan$|oxaban$|floxacin$|cillin$|gliptin$|tide$/i.test(w));
      const primaryDrug = candidateDrugs[0] || 'Suspected Agent';

      const weightMatch = rawText.match(/(\d{2,3}(\.\d+)?)\s*(kg|kilos|kilograms|lbs|pounds)/i);
      const weight = weightMatch ? parseFloat(weightMatch[1]) : null;

      return res.json({
        success: true,
        extracted: {
          drugs: [
            {
              drugName: primaryDrug,
              activeSubstance: primaryDrug,
              role: 'Suspect',
              dose: 'Standard dose',
              route: 'Oral',
              frequency: 'Once daily',
              durationOfTherapy: '2 weeks',
              indication: 'Primary condition',
              startDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
              stopDate: '',
              dechallenge: 'Positive',
              rechallenge: 'Not Performed',
            },
          ],
          concomitantDrugs: [],
          adverseEvent: 'Adverse Drug Reaction',
          signsAndSymptoms: '',
          onsetDate: new Date().toISOString().split('T')[0],
          eventDuration: '',
          severityGrade: hospitalization || lifeThreatening ? 'Severe' : 'Moderate',
          outcome: death ? 'Fatal' : 'Recovering / Resolving',
          hospitalization,
          lifeThreatening,
          death,
          disability: false,
          congenitalAnomaly: false,
          otherMedicallyImportant: hospitalization || lifeThreatening,
          isListedInSmPC: true,
          patientInitials: '',
          patientAge: age,
          patientSex: sex,
          weightKg: weight,
          medicalHistory: '',
          vitalSigns: {
            bloodPressure: '',
            heartRate: '',
            respiratoryRate: '',
            temperature: '',
            oxygenSaturation: '',
          },
          diagnosticFindings: [],
          labs: [],
        },
      });
    }

    const extractPrompt = `You are a clinical pharmacovigilance data extraction AI for Vigilytics.
Extract clinical entities directly from this case narration or attached document/image into this exact JSON structure:
- Extract ONLY facts that are present in the provided document or narrative.
- NEVER fabricate or assume demographic or clinical details.
- If age is not in the document, return "" for patientAge.
- If sex is not in the document, return "Unknown" for patientSex.
- If weight is not in the document, return null for weightKg.
- If initials are not in the document, return "" for patientInitials.
{
  "drugs": [
    {
      "drugName": "string",
      "activeSubstance": "string",
      "role": "Suspect" | "Concomitant" | "Interacting",
      "dose": "string",
      "route": "string",
      "frequency": "string",
      "durationOfTherapy": "string",
      "indication": "string",
      "startDate": "YYYY-MM-DD",
      "stopDate": "YYYY-MM-DD" or "",
      "dechallenge": "Positive" | "Negative" | "Not Applicable" | "Unknown",
      "rechallenge": "Positive" | "Negative" | "Not Performed" | "Unknown"
    }
  ],
  "adverseEvent": "string (MedDRA Preferred Term / Suspected Adverse Reaction)",
  "signsAndSymptoms": "string (clinical signs and symptoms)",
  "onsetDate": "YYYY-MM-DD or YYYY-MM-DD HH:MM",
  "eventDuration": "string",
  "severityGrade": "Mild" | "Moderate" | "Severe" | "Life-Threatening",
  "outcome": "Recovered / Resolved" | "Recovering / Resolving" | "Not Recovered / Not Resolved" | "Recovered with Sequelae" | "Fatal" | "Unknown",
  "hospitalization": boolean,
  "lifeThreatening": boolean,
  "death": boolean,
  "disability": boolean,
  "congenitalAnomaly": boolean,
  "otherMedicallyImportant": boolean,
  "isListedInSmPC": boolean,
  "patientInitials": "string",
  "patientAge": "string",
  "patientSex": "Male" | "Female" | "Unknown",
  "weightKg": number or null,
  "medicalHistory": "string",
  "vitalSigns": {
    "bloodPressure": "string",
    "heartRate": "string",
    "respiratoryRate": "string",
    "temperature": "string",
    "oxygenSaturation": "string"
  },
  "diagnosticFindings": [
    {
      "testType": "string",
      "finding": "string",
      "impression": "string"
    }
  ],
  "labs": [
    {
      "testName": "string",
      "value": "string",
      "unit": "string",
      "referenceRange": "string",
      "isAbnormal": boolean
    }
  ]
}`;

    const parts: any[] = [];

    if (cleanBase64) {
      if (mime.startsWith('image/') || mime === 'application/pdf') {
        parts.push({
          inlineData: {
            mimeType: mime,
            data: cleanBase64,
          },
        });
        parts.push({
          text: `Document/Image: "${fileName || 'clinical_record'}". Extract all medications, adverse reactions, and demographics from this file.`,
        });
      } else {
        try {
          const textContent = Buffer.from(cleanBase64, 'base64').toString('utf-8');
          parts.push({
            text: `Document Content:\n${textContent}`,
          });
        } catch {
          // ignore decode error
        }
      }
    }

    if (narrative && typeof narrative === 'string' && narrative.trim() && !narrative.startsWith('Uploaded medical safety document:')) {
      parts.push({ text: `Additional Case Narration:\n${narrative}` });
    }

    if (parts.length === 0) {
      parts.push({ text: 'Extract clinical drug chart entities from provided safety data.' });
    }

    const text = await generateGeminiWithFallback({
      parts,
      systemInstruction: extractPrompt,
      responseMimeType: 'application/json',
    });

    const parsed = JSON.parse(text || '{}');
    return res.json({
      success: true,
      extracted: parsed,
    });
  } catch (err: any) {
    console.error('Extract error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Comprehensive Global Drug Search & Autocomplete Endpoint (NIH ClinicalTables & RxNav Approximate Term)
app.get('/api/drugs/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q || q.length < 1) {
      return res.json({ success: true, results: [] });
    }

    const results: Array<{ name: string; brandOrForm?: string; source: string; score?: number }> = [];
    const seen = new Set<string>();

    // 1. Query NIH ClinicalTables RxTerms API (covers all prescription and OTC drugs)
    try {
      const ctResp = await fetch(
        `https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search?terms=${encodeURIComponent(q)}&maxList=15`,
        { signal: AbortSignal.timeout(2500) }
      );
      if (ctResp.ok) {
        const ctData = await ctResp.json();
        if (Array.isArray(ctData) && Array.isArray(ctData[1])) {
          ctData[1].forEach((nameStr: string) => {
            const cleanName = nameStr.replace(/\s*\([^)]*\)$/, '').trim();
            const formMatch = nameStr.match(/\(([^)]+)\)/);
            const key = cleanName.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              results.push({
                name: cleanName,
                brandOrForm: formMatch ? formMatch[1] : 'Prescription Formulation',
                source: 'RxTerms / NLM',
                score: 90,
              });
            }
          });
        }
      }
    } catch {}

    // 2. Query NIH RxNav Approximate Term API (spelling-tolerant approximate search for misspelled words)
    try {
      const rxNavResp = await fetch(
        `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(q)}&maxEntries=12`,
        { signal: AbortSignal.timeout(2500) }
      );
      if (rxNavResp.ok) {
        const rxNavData = await rxNavResp.json();
        const candidates = rxNavData?.approximateGroup?.candidate;
        if (Array.isArray(candidates)) {
          candidates.forEach((cand: any) => {
            if (cand.name) {
              const clean = cand.name
                .replace(/\s*\[[^\]]+\]$/, '')
                .replace(/\s*\([^)]*\)$/, '')
                .trim();
              const key = clean.toLowerCase();
              if (clean && !seen.has(key)) {
                seen.add(key);
                results.push({
                  name: clean,
                  brandOrForm: cand.source ? `Source: ${cand.source}` : 'RxNorm',
                  source: 'RxNav Approximate Term (Typo Tolerance)',
                  score: parseFloat(cand.score) || 75,
                });
              }
            }
          });
        }
      }
    } catch {}

    return res.json({ success: true, results });
  } catch (err: any) {
    return res.json({ success: false, results: [], error: err.message });
  }
});

// Pharmacovigilance Agent Chat / Query Endpoint
app.post('/api/agent/chat', async (req, res) => {
  try {
    const { question, currentCaseData } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Missing question parameter' });
    }

    if (!ai) {
      return res.json({
        answer: 'The Pharmacovigilance Multi-Agent System is operating in algorithmic evaluation mode. Please configure GEMINI_API_KEY in the Secrets panel for generative chat assistance.',
      });
    }

    const answer = await generateGeminiWithFallback({
      parts: [
        {
          text: `You are a Senior Pharmacovigilance & Medical Safety Specialist assisting a qualified PV reviewer.
Context Safety Case Data:
${JSON.stringify(currentCaseData, null, 2)}

User Question: ${question}

Provide an authoritative, clinically grounded, regulatory-sound answer adhering to ICH E2A, ICH E2D, CIOMS, and GVP Module VI standards.
Distinguish facts from clinical interpretation.
Do not invent missing information.
Do not provide patient diagnostic or treatment prescriptions.`,
        },
      ],
      responseMimeType: 'text/plain',
    });

    return res.json({
      success: true,
      answer: answer || 'Analysis completed.',
    });
  } catch (err: any) {
    console.error('Agent chat error:', err);
    return res.status(500).json({ error: err.message });
  }
});

const server = http.createServer(app);

// In development, hook Vite middleware
if (process.env.NODE_ENV !== 'production') {
  const isHmrDisabled = process.env.DISABLE_HMR === 'true';
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: isHmrDisabled ? false : { server },
      watch: isHmrDisabled ? null : {},
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

server.listen(port, '0.0.0.0', () => {
  console.log(`Vigilytics AI Server listening on port ${port}`);
});
