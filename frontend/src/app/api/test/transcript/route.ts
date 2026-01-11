import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

/**
 * GET /api/test/transcript?videoId=XXXXX
 * 
 * Test endpoint to debug transcript fetching for a single video
 */
export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json(
      {
        success: false,
        error: 'videoId query parameter is required',
      },
      { status: 400 }
    );
  }

  try {
    console.log(`[test-transcript] Testing transcript fetch for video: ${videoId}`);
    
    const rawTranscript = await YoutubeTranscript.fetchTranscript(videoId);

    if (!rawTranscript || rawTranscript.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empty transcript returned',
        videoId,
        transcriptLength: 0,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Transcript fetched successfully!',
      videoId,
      transcriptLength: rawTranscript.length,
      firstEntry: rawTranscript[0],
      sampleText: rawTranscript.slice(0, 3).map((entry) => entry.text).join(' '),
    });
  } catch (err: any) {
    const errorMessage = err.message || 'Unknown error';
    const errorStack = err.stack || 'No stack trace';

    console.error(`[test-transcript] Error:`, err);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch transcript',
        videoId,
        errorMessage,
        errorType: err.constructor?.name || 'Error',
        errorDetails: {
          message: errorMessage,
          stack: errorStack.split('\n').slice(0, 5), // First 5 lines of stack
        },
      },
      { status: 400 }
    );
  }
}

