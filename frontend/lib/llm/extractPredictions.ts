import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../db';
import { SegmentedBlock } from '../transcript/segmentTranscript';

// System prompt as specified
const SYSTEM_PROMPT = `You are a financial analyst.

Extract ONLY explicit or implicit future-oriented financial predictions.

Rules:
- Prediction must refer to the future
- Ignore general advice or explanations
- Ignore past statements

For each prediction return:
- claim
- asset or market
- time horizon in months
- confidence level (low / medium / high)
- prediction type (price, direction, relative performance, macro)

Return JSON array only.`;

export interface ExtractedPrediction {
  claim: string;
  asset: string | null;
  horizonMonths: number | null;
  confidence: 'low' | 'medium' | 'high';
  predictionType: 'price' | 'direction' | 'relative performance' | 'macro';
}

export interface ExtractionResult {
  blockIndex: number;
  startTime: number;
  chunkIds: string[];
  transcriptText: string;
  predictions: ExtractedPrediction[];
  error?: string;
}

// Rate limiting state
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1000; // 1 second between requests

/**
 * Sleep for exponential backoff
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Enforce rate limiting between requests
 */
async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    await sleep(MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest);
  }

  lastRequestTime = Date.now();
}

/**
 * Parse JSON from LLM response with error handling
 */
function parseJsonResponse(text: string): ExtractedPrediction[] {
  // Try to extract JSON array from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);

  if (!jsonMatch) {
    // Check if response indicates no predictions
    if (
      text.toLowerCase().includes('no prediction') ||
      text.toLowerCase().includes('[]') ||
      text.trim() === '[]'
    ) {
      return [];
    }
    throw new Error('No JSON array found in response');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    // Validate and normalize predictions
    return parsed.map((p: Record<string, unknown>) => ({
      claim: String(p.claim || ''),
      asset: p.asset ? String(p.asset) : null,
      horizonMonths: typeof p.horizonMonths === 'number' ? p.horizonMonths : null,
      confidence: validateConfidence(String(p.confidence || 'medium')),
      predictionType: validatePredictionType(String(p.predictionType || 'direction')),
    })).filter((p: ExtractedPrediction) => p.claim.trim().length > 0);
  } catch (err) {
    throw new Error(`Failed to parse JSON: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

function validateConfidence(value: string): 'low' | 'medium' | 'high' {
  const normalized = value.toLowerCase().trim();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized;
  }
  return 'medium';
}

function validatePredictionType(
  value: string
): 'price' | 'direction' | 'relative performance' | 'macro' {
  const normalized = value.toLowerCase().trim();
  if (
    normalized === 'price' ||
    normalized === 'direction' ||
    normalized === 'relative performance' ||
    normalized === 'macro'
  ) {
    return normalized;
  }
  return 'direction';
}

/**
 * Extract predictions from a single transcript block using Gemini
 */
export async function extractPredictionsFromBlock(
  block: SegmentedBlock,
  blockIndex: number,
  retries: number = 3
): Promise<ExtractionResult> {
  const result: ExtractionResult = {
    blockIndex,
    startTime: block.startTime,
    chunkIds: block.chunkIds,
    transcriptText: block.text,
    predictions: [],
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    result.error = 'GEMINI_API_KEY environment variable is not set';
    return result;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await enforceRateLimit();

      const prompt = `${SYSTEM_PROMPT}\n\nTranscript:\n"${block.text}"`;

      const response = await model.generateContent(prompt);
      const responseText = response.response.text();

      result.predictions = parseJsonResponse(responseText);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown error');

      // Exponential backoff
      const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.log(
        `[extractPredictions] Attempt ${attempt + 1}/${retries} failed: ${lastError.message}. Retrying in ${backoffMs}ms...`
      );
      await sleep(backoffMs);
    }
  }

  result.error = lastError?.message || 'Max retries exceeded';
  return result;
}

/**
 * Extract predictions from all blocks for a video
 */
export async function extractPredictionsForVideo(
  videoId: string,
  blocks: SegmentedBlock[]
): Promise<{
  totalBlocks: number;
  blocksWithPredictions: number;
  totalPredictions: number;
  errors: string[];
}> {
  const stats = {
    totalBlocks: blocks.length,
    blocksWithPredictions: 0,
    totalPredictions: 0,
    errors: [] as string[],
  };

  console.log(`[extractPredictions] Processing ${blocks.length} blocks for video: ${videoId}`);

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const result = await extractPredictionsFromBlock(block, i);

    if (result.error) {
      stats.errors.push(`Block ${i}: ${result.error}`);
      continue;
    }

    if (result.predictions.length > 0) {
      stats.blocksWithPredictions++;
      stats.totalPredictions += result.predictions.length;

      // Store predictions in database
      for (const prediction of result.predictions) {
        try {
          await prisma.prediction.create({
            data: {
              videoId,
              transcriptChunkId: result.chunkIds[0], // Link to first chunk
              timestamp: result.startTime,
              transcriptText: result.transcriptText,
              predictedClaim: prediction.claim,
              asset: prediction.asset,
              horizonMonths: prediction.horizonMonths,
              confidence: prediction.confidence,
              predictionType: prediction.predictionType,
            },
          });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          stats.errors.push(`Failed to store prediction: ${errorMessage}`);
        }
      }
    }

    // Progress logging every 10 blocks
    if ((i + 1) % 10 === 0) {
      console.log(`[extractPredictions] Processed ${i + 1}/${blocks.length} blocks`);
    }
  }

  // Mark video as predictions extracted
  await prisma.video.update({
    where: { id: videoId },
    data: { predictionsExtracted: true },
  });

  console.log(
    `[extractPredictions] Completed video ${videoId}: ${stats.totalPredictions} predictions from ${stats.blocksWithPredictions}/${stats.totalBlocks} blocks`
  );

  return stats;
}
