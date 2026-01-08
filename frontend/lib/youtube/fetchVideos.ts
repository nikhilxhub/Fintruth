import { google, youtube_v3 } from 'googleapis';
import prisma from '../db';

const youtube = google.youtube('v3');

// Keywords to filter finance-related videos
const FINANCE_KEYWORDS = ['market', 'stock', 'invest', 'economy'];

interface VideoMetadata {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  channelId: string;
}

interface FetchVideosResult {
  videosFound: number;
  videosInserted: number;
  videosSkipped: number;
  errors: string[];
}

/**
 * Check if video title or description contains finance-related keywords
 */
function isFinanceRelated(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  return FINANCE_KEYWORDS.some((keyword) => text.includes(keyword));
}

/**
 * Fetch channel info and create/update creator record
 */
export async function ensureCreator(channelId: string): Promise<string> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY environment variable is not set');
  }

  // Check if creator already exists
  const existingCreator = await prisma.creator.findUnique({
    where: { channelId },
  });

  if (existingCreator) {
    return existingCreator.id;
  }

  // Fetch channel info from YouTube API
  const response = await youtube.channels.list({
    key: apiKey,
    id: [channelId],
    part: ['snippet'],
  });

  const channel = response.data.items?.[0];
  if (!channel) {
    throw new Error(`Channel not found: ${channelId}`);
  }

  const creator = await prisma.creator.create({
    data: {
      channelId,
      name: channel.snippet?.title || 'Unknown',
      youtubeHandle: channel.snippet?.customUrl || null,
      avatarUrl: channel.snippet?.thumbnails?.default?.url || null,
    },
  });

  return creator.id;
}

/**
 * Fetch videos from a YouTube channel using the Data API v3
 * Filters by finance-related keywords and stores metadata
 */
export async function fetchVideosForChannel(
  channelId: string,
  maxResults: number = 50
): Promise<FetchVideosResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY environment variable is not set');
  }

  const result: FetchVideosResult = {
    videosFound: 0,
    videosInserted: 0,
    videosSkipped: 0,
    errors: [],
  };

  // Ensure creator exists
  const creatorId = await ensureCreator(channelId);

  let pageToken: string | undefined = undefined;
  let totalFetched = 0;

  try {
    // Paginate through all videos
    do {
      const searchResponse: youtube_v3.Schema$SearchListResponse = (await youtube.search.list({
        key: apiKey,
        channelId,
        part: ['snippet'],
        type: ['video'],
        order: 'date',
        maxResults: Math.min(50, maxResults - totalFetched),
        pageToken,
      })).data;

      const videos = searchResponse.items || [];
      result.videosFound += videos.length;
      totalFetched += videos.length;

      for (const video of videos) {
        const videoId = video.id?.videoId;
        const title = video.snippet?.title || '';
        const description = video.snippet?.description || '';
        const publishedAt = video.snippet?.publishedAt;

        if (!videoId || !publishedAt) {
          result.errors.push(`Missing video ID or publishedAt for video`);
          continue;
        }

        // Filter by finance keywords
        if (!isFinanceRelated(title, description)) {
          result.videosSkipped++;
          continue;
        }

        // Check for duplicate
        const existingVideo = await prisma.video.findUnique({
          where: { id: videoId },
        });

        if (existingVideo) {
          result.videosSkipped++;
          continue;
        }

        // Insert video
        try {
          await prisma.video.create({
            data: {
              id: videoId,
              creatorId,
              title,
              description,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              publishedAt: new Date(publishedAt),
            },
          });
          result.videosInserted++;
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          result.errors.push(`Failed to insert video ${videoId}: ${errorMessage}`);
        }
      }

      pageToken = searchResponse.nextPageToken || undefined;
    } while (pageToken && totalFetched < maxResults);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`API error: ${errorMessage}`);
  }

  console.log(
    `[fetchVideos] Channel ${channelId}: Found ${result.videosFound}, Inserted ${result.videosInserted}, Skipped ${result.videosSkipped}`
  );

  return result;
}

/**
 * Get all unfetched videos for a creator (videos without transcripts)
 */
export async function getUnfetchedVideos(creatorId: string) {
  return prisma.video.findMany({
    where: {
      creatorId,
      transcriptFetched: false,
    },
    orderBy: {
      publishedAt: 'desc',
    },
  });
}

/**
 * Get all videos without extracted predictions
 */
export async function getVideosWithoutPredictions(creatorId: string) {
  return prisma.video.findMany({
    where: {
      creatorId,
      transcriptFetched: true,
      predictionsExtracted: false,
    },
    orderBy: {
      publishedAt: 'desc',
    },
  });
}
