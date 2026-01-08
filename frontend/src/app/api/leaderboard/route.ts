import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * GET /api/leaderboard
 * 
 * Returns leaderboard data with creators ranked by total predictions
 */
export async function GET() {
  try {
    // Get all creators with their videos
    const creators = await prisma.creator.findMany({
      include: {
        videos: {
          select: {
            id: true,
            transcriptFetched: true,
            predictionsExtracted: true,
          },
        },
      },
    });

    // Calculate stats for each creator
    const leaderboardDataPromises = creators.map(async (creator) => {
      const totalVideos = creator.videos.length;
      const videosWithTranscripts = creator.videos.filter(
        (v) => v.transcriptFetched
      ).length;
      const videosWithPredictions = creator.videos.filter(
        (v) => v.predictionsExtracted
      ).length;

      // Count total predictions for this creator
      const totalPredictions = await prisma.prediction.count({
        where: {
          video: {
            creatorId: creator.id,
          },
        },
      });

      return {
        creatorId: creator.id,
        channelId: creator.channelId,
        name: creator.name,
        youtubeHandle: creator.youtubeHandle,
        avatarUrl: creator.avatarUrl,
        totalVideos,
        videosWithTranscripts,
        videosWithPredictions,
        totalPredictions,
        createdAt: creator.createdAt.toISOString(),
      };
    });

    const leaderboardData = await Promise.all(leaderboardDataPromises);

    // Filter, sort, and rank
    const rankedData = leaderboardData
      .filter((creator) => creator.totalPredictions > 0) // Only show creators with predictions
      .sort((a, b) => b.totalPredictions - a.totalPredictions) // Sort by predictions count
      .map((creator, index) => ({
        ...creator,
        rank: index + 1,
      }));

    return NextResponse.json({
      success: true,
      data: rankedData,
      totalCreators: rankedData.length,
    });
  } catch (err) {
    console.error('[Leaderboard API] Error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch leaderboard data',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

