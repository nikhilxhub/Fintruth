import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * POST /api/admin/reset-transcripts
 * 
 * Reset videos that were marked as transcriptFetched but have no chunks
 * This allows retrying transcript fetching for videos that failed
 */
export async function POST(request: NextRequest) {
  try {
    // Find videos marked as fetched but with no transcript chunks
    const videos = await prisma.video.findMany({
      where: {
        transcriptFetched: true,
      },
      include: {
        _count: {
          select: {
            transcriptChunks: true,
          },
        },
      },
    });

    const videosToReset = videos.filter((video) => video._count.transcriptChunks === 0);

    console.log(`[reset-transcripts] Found ${videosToReset.length} videos to reset`);

    // Reset transcriptFetched flag for videos with no chunks
    const result = await prisma.video.updateMany({
      where: {
        id: {
          in: videosToReset.map((v) => v.id),
        },
        transcriptFetched: true,
      },
      data: {
        transcriptFetched: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Reset ${result.count} videos for transcript retry`,
      videosReset: result.count,
      totalVideosChecked: videos.length,
    });
  } catch (err) {
    console.error('[reset-transcripts] Error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reset transcripts',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

