import { NextRequest, NextResponse } from 'next/server';
import { runIngestionPipelineWithLock, isPipelineRunning } from '@/lib/pipeline/runIngestion';
import { checkRateLimit, validateApiKey, INGEST_RATE_LIMIT } from '@/lib/rateLimit';

interface IngestRequest {
  channelId: string;
  options?: {
    maxVideos?: number;
    skipVideoFetch?: boolean;
    skipTranscriptFetch?: boolean;
    skipPredictionExtraction?: boolean;
  };
}

/**
 * POST /api/ingest/channel
 *
 * Triggers full ingestion pipeline for a YouTube channel
 *
 * Body:
 * {
 *   "channelId": "UCXXXX"
 * }
 *
 * Headers:
 *   x-api-key: <your-api-key>
 */
export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const apiKey = request.headers.get('x-api-key');
    if (!validateApiKey(apiKey)) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    // Rate limiting based on IP
    const clientIp = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    const rateLimitKey = `ingest:${clientIp}`;
    const rateLimitResult = checkRateLimit(rateLimitKey, INGEST_RATE_LIMIT);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          },
        }
      );
    }

    // Parse request body
    const body: IngestRequest = await request.json();

    if (!body.channelId) {
      return NextResponse.json(
        { error: 'Bad request', message: 'channelId is required' },
        { status: 400 }
      );
    }

    // Validate channelId format (should start with UC)
    if (!body.channelId.startsWith('UC') || body.channelId.length !== 24) {
      return NextResponse.json(
        {
          error: 'Bad request',
          message: 'Invalid channelId format. YouTube channel IDs start with "UC" and are 24 characters long.',
        },
        { status: 400 }
      );
    }

    // Check if pipeline is already running
    if (isPipelineRunning(body.channelId)) {
      return NextResponse.json(
        {
          error: 'Conflict',
          message: 'Pipeline is already running for this channel',
          channelId: body.channelId,
        },
        { status: 409 }
      );
    }

    // Run pipeline
    console.log(`[API] Starting ingestion for channel: ${body.channelId}`);

    const result = await runIngestionPipelineWithLock(body.channelId, body.options || {});

    if (!result) {
      return NextResponse.json(
        {
          error: 'Conflict',
          message: 'Pipeline could not be started - another instance may be running',
        },
        { status: 409 }
      );
    }

    // Return result
    return NextResponse.json(
      {
        success: true,
        message: 'Ingestion pipeline completed',
        result,
      },
      {
        status: 200,
        headers: {
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.resetAt),
        },
      }
    );
  } catch (err) {
    console.error('[API] Ingestion error:', err);

    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ingest/channel?channelId=UCXXXX
 *
 * Check pipeline status for a channel
 */
export async function GET(request: NextRequest) {
  const channelId = request.nextUrl.searchParams.get('channelId');

  if (!channelId) {
    return NextResponse.json(
      { error: 'Bad request', message: 'channelId query parameter is required' },
      { status: 400 }
    );
  }

  const isRunning = isPipelineRunning(channelId);

  return NextResponse.json({
    channelId,
    isRunning,
    message: isRunning
      ? 'Pipeline is currently running'
      : 'No pipeline running for this channel',
  });
}

