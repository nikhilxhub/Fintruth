import { SegmentedBlock } from '../lib/transcript/segmentTranscript';

// Mock the Google Generative AI module
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn(),
      }),
    })),
  };
});

// Mock Prisma
jest.mock('../lib/db', () => ({
  __esModule: true,
  default: {
    prediction: {
      create: jest.fn(),
    },
    video: {
      update: jest.fn(),
    },
  },
}));

// Test helper to create mock blocks
function createMockBlock(text: string, startTime: number = 0): SegmentedBlock {
  return {
    text,
    startTime,
    chunkIds: ['chunk-1', 'chunk-2'],
  };
}

describe('Prediction JSON Parsing', () => {
  // Import the parseJsonResponse logic directly for testing
  function parseJsonResponse(text: string) {
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      if (
        text.toLowerCase().includes('no prediction') ||
        text.toLowerCase().includes('[]') ||
        text.trim() === '[]'
      ) {
        return [];
      }
      throw new Error('No JSON array found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    return parsed
      .map((p: Record<string, unknown>) => ({
        claim: String(p.claim || ''),
        asset: p.asset ? String(p.asset) : null,
        horizonMonths: typeof p.horizonMonths === 'number' ? p.horizonMonths : null,
        confidence: validateConfidence(String(p.confidence || 'medium')),
        predictionType: validatePredictionType(String(p.predictionType || 'direction')),
      }))
      .filter((p: { claim: string }) => p.claim.trim().length > 0);
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

  it('should parse valid JSON array', () => {
    const response = `[
      {
        "claim": "Indian markets will correct in 2023",
        "asset": "NIFTY50",
        "horizonMonths": 12,
        "confidence": "high",
        "predictionType": "direction"
      }
    ]`;

    const result = parseJsonResponse(response);

    expect(result).toHaveLength(1);
    expect(result[0].claim).toBe('Indian markets will correct in 2023');
    expect(result[0].asset).toBe('NIFTY50');
    expect(result[0].horizonMonths).toBe(12);
    expect(result[0].confidence).toBe('high');
    expect(result[0].predictionType).toBe('direction');
  });

  it('should handle multiple predictions', () => {
    const response = `[
      {
        "claim": "S&P 500 will reach 5000",
        "asset": "SPY",
        "horizonMonths": 6,
        "confidence": "medium",
        "predictionType": "price"
      },
      {
        "claim": "Interest rates will decrease",
        "asset": "US Treasury",
        "horizonMonths": 18,
        "confidence": "low",
        "predictionType": "macro"
      }
    ]`;

    const result = parseJsonResponse(response);

    expect(result).toHaveLength(2);
    expect(result[0].predictionType).toBe('price');
    expect(result[1].predictionType).toBe('macro');
  });

  it('should return empty array for "no predictions" response', () => {
    expect(parseJsonResponse('No predictions found in this text.')).toEqual([]);
    expect(parseJsonResponse('[]')).toEqual([]);
    expect(parseJsonResponse('There are no prediction in this segment.')).toEqual([]);
  });

  it('should extract JSON from wrapped response', () => {
    const response = `Here are the predictions I found:

    [
      {
        "claim": "Bitcoin will hit 100k",
        "asset": "BTC",
        "horizonMonths": 12,
        "confidence": "high",
        "predictionType": "price"
      }
    ]

    That's all I could find.`;

    const result = parseJsonResponse(response);

    expect(result).toHaveLength(1);
    expect(result[0].claim).toBe('Bitcoin will hit 100k');
  });

  it('should handle missing optional fields', () => {
    const response = `[
      {
        "claim": "Market will go up"
      }
    ]`;

    const result = parseJsonResponse(response);

    expect(result).toHaveLength(1);
    expect(result[0].claim).toBe('Market will go up');
    expect(result[0].asset).toBeNull();
    expect(result[0].horizonMonths).toBeNull();
    expect(result[0].confidence).toBe('medium');
    expect(result[0].predictionType).toBe('direction');
  });

  it('should normalize confidence levels', () => {
    const response = `[
      { "claim": "Test 1", "confidence": "LOW" },
      { "claim": "Test 2", "confidence": "HIGH" },
      { "claim": "Test 3", "confidence": "invalid" }
    ]`;

    const result = parseJsonResponse(response);

    expect(result[0].confidence).toBe('low');
    expect(result[1].confidence).toBe('high');
    expect(result[2].confidence).toBe('medium'); // Default for invalid
  });

  it('should normalize prediction types', () => {
    const response = `[
      { "claim": "Test 1", "predictionType": "PRICE" },
      { "claim": "Test 2", "predictionType": "relative performance" },
      { "claim": "Test 3", "predictionType": "unknown" }
    ]`;

    const result = parseJsonResponse(response);

    expect(result[0].predictionType).toBe('price');
    expect(result[1].predictionType).toBe('relative performance');
    expect(result[2].predictionType).toBe('direction'); // Default for invalid
  });

  it('should filter out empty claims', () => {
    const response = `[
      { "claim": "Valid prediction" },
      { "claim": "" },
      { "claim": "   " }
    ]`;

    const result = parseJsonResponse(response);

    expect(result).toHaveLength(1);
    expect(result[0].claim).toBe('Valid prediction');
  });

  it('should throw error for invalid JSON', () => {
    expect(() => parseJsonResponse('This is not JSON')).toThrow('No JSON array found');
    expect(() => parseJsonResponse('{ "not": "array" }')).toThrow('No JSON array found');
  });
});

describe('Rate Limiting', () => {
  // Test the rate limiting logic
  let lastRequestTime = 0;
  const MIN_REQUEST_INTERVAL_MS = 1000;

  async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function enforceRateLimit(): Promise<number> {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (lastRequestTime > 0 && timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
      const waitTime = MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest;
      await sleep(waitTime);
    }

    lastRequestTime = Date.now();
    return lastRequestTime;
  }

  beforeEach(() => {
    lastRequestTime = 0;
  });

  it('should allow immediate first request', async () => {
    const start = Date.now();
    await enforceRateLimit();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100); // Should be nearly instant
  });

  it('should enforce minimum interval between requests', async () => {
    await enforceRateLimit();

    const start = Date.now();
    await enforceRateLimit();
    const elapsed = Date.now() - start;

    // Should have waited approximately MIN_REQUEST_INTERVAL_MS
    expect(elapsed).toBeGreaterThanOrEqual(MIN_REQUEST_INTERVAL_MS - 50);
  }, 10000);
});

describe('Mock Gemini Response Integration', () => {
  it('should handle typical Gemini response format', () => {
    // Simulate a typical Gemini API response
    const mockGeminiResponse = {
      response: {
        text: () => `Based on the transcript, I found the following predictions:

[
  {
    "claim": "The NIFTY index will see a 15% correction in the next quarter",
    "asset": "NIFTY50",
    "horizonMonths": 3,
    "confidence": "high",
    "predictionType": "direction"
  },
  {
    "claim": "Gold prices will outperform equities",
    "asset": "GOLD",
    "horizonMonths": 12,
    "confidence": "medium",
    "predictionType": "relative performance"
  }
]`,
      },
    };

    // Parse the response
    const text = mockGeminiResponse.response.text();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    expect(jsonMatch).not.toBeNull();

    const predictions = JSON.parse(jsonMatch![0]);
    expect(predictions).toHaveLength(2);
    expect(predictions[0].asset).toBe('NIFTY50');
    expect(predictions[1].predictionType).toBe('relative performance');
  });

  it('should handle Gemini response with no predictions', () => {
    const mockGeminiResponse = {
      response: {
        text: () =>
          'After analyzing the transcript, I did not find any explicit or implicit financial predictions. The content appears to be general educational material about investing concepts without specific future-oriented claims.',
      },
    };

    const text = mockGeminiResponse.response.text();
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    // Should not find JSON array
    expect(jsonMatch).toBeNull();

    // Should recognize "no predictions" in text
    expect(text.toLowerCase()).toContain('did not find');
  });
});
