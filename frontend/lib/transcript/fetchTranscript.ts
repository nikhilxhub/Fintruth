import { YoutubeTranscript } from 'youtube-transcript';
import prisma from '../db';
import { fetchTranscriptUsingYtApi } from './fetchTranscriptYtApi';

export interface TranscriptEntry {
  text: string;
  startTime: number; // seconds
}

export interface FetchTranscriptResult {
  success: boolean;
  videoId: string;
  chunksStored: number;
  error?: string;
  transcriptEntries?: TranscriptEntry[]; // Optional: used internally for YouTube Data API v3
}

/**
 * Normalize raw transcript entries into clean format
 */
function normalizeTranscript(
  rawTranscript: Array<{ text: string; offset: number; duration: number }>
): TranscriptEntry[] {
  return rawTranscript.map((entry) => ({
    text: entry.text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, ' ')
      .trim(),
    startTime: entry.offset / 1000, // Convert ms to seconds
  }));
}

/**
 * Fetch transcript for a YouTube video and store chunks in database
 */
export async function fetchTranscriptForVideo(videoId: string): Promise<FetchTranscriptResult> {
  const result: FetchTranscriptResult = {
    success: false,
    videoId,
    chunksStored: 0,
  };

  try {
    // Check if video exists
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      result.error = `Video not found: ${videoId}`;
      return result;
    }

    // Check if transcript already fetched
    if (video.transcriptFetched) {
      result.success = true;
      result.error = 'Transcript already fetched';
      return result;
    }

    // Fetch transcript from YouTube
    console.log(`[fetchTranscript] Fetching transcript for video: ${videoId}`);

    try {
      let normalizedTranscript: TranscriptEntry[] | null = null;

      // Try YouTube Data API v3 first (if OAuth2 is configured)
      const ytApiResult = await fetchTranscriptUsingYtApi(videoId);
      if (ytApiResult && ytApiResult.success && ytApiResult.transcriptEntries) {
        console.log(`[fetchTranscript] Successfully fetched transcript using YouTube Data API v3 (${ytApiResult.chunksStored} entries)`);
        normalizedTranscript = ytApiResult.transcriptEntries;
      } else {
        // Fall back to youtube-transcript library
        console.log(`[fetchTranscript] OAuth2 not configured or failed, trying youtube-transcript library...`);
        const rawTranscript = await YoutubeTranscript.fetchTranscript(videoId);

        if (!rawTranscript || rawTranscript.length === 0) {
          result.error = 'No transcript available for this video';
          console.error(`[fetchTranscript] Empty transcript returned for video: ${videoId}`);
          // Don't mark as fetched - allow retry
          return result;
        }

        console.log(`[fetchTranscript] Successfully fetched ${rawTranscript.length} transcript entries using youtube-transcript library`);

        // Normalize transcript entries
        normalizedTranscript = normalizeTranscript(rawTranscript);
      }

      if (!normalizedTranscript || normalizedTranscript.length === 0) {
        result.error = 'Failed to parse transcript entries';
        return result;
      }

      // Store transcript chunks in database
      const chunkData = normalizedTranscript.map((entry) => ({
        videoId,
        text: entry.text,
        startTime: entry.startTime,
      }));

      // Use transaction to ensure atomicity
      await prisma.$transaction(async (tx) => {
        // Delete existing chunks if any (for idempotency)
        await tx.transcriptChunk.deleteMany({
          where: { videoId },
        });

        // Insert new chunks
        await tx.transcriptChunk.createMany({
          data: chunkData,
        });

        // Mark video as transcript fetched
        await tx.video.update({
          where: { id: videoId },
          data: { transcriptFetched: true },
        });
      });

      result.success = true;
      result.chunksStored = chunkData.length;

      console.log(`[fetchTranscript] Stored ${result.chunksStored} chunks for video: ${videoId}`);
      return result;
    } catch (transcriptError) {
      // Re-throw to be caught by outer catch block
      throw transcriptError;
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    result.error = errorMessage;
    console.error(`[fetchTranscript] Error fetching transcript for ${videoId}: ${errorMessage}`);
    console.error(`[fetchTranscript] Full error:`, err);

    // Only mark as fetched if we're certain the transcript is permanently unavailable
    // Otherwise, leave it as false so we can retry
    const permanentErrors = [
      'Transcript is disabled',
      'Transcripts are disabled',
      'video does not have transcripts',
    ];

    if (permanentErrors.some((msg) => errorMessage.toLowerCase().includes(msg.toLowerCase()))) {
      try {
        await prisma.video.update({
          where: { id: videoId },
          data: { transcriptFetched: true },
        });
        console.log(`[fetchTranscript] Marked video ${videoId} as permanently unavailable`);
      } catch {
        // Ignore update error
      }
    } else {
      // For other errors, don't mark as fetched so we can retry
      console.log(`[fetchTranscript] Not marking video ${videoId} as fetched - will retry later`);
    }
  }

  return result;
}

/**
 * Fetch transcripts for multiple videos
 */
export async function fetchTranscriptsForVideos(
  videoIds: string[]
): Promise<FetchTranscriptResult[]> {
  const results: FetchTranscriptResult[] = [];

  for (const videoId of videoIds) {
    const result = await fetchTranscriptForVideo(videoId);
    results.push(result);

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}

/**
 * Get transcript chunks for a video
 */
export async function getTranscriptChunks(videoId: string) {
  return prisma.transcriptChunk.findMany({
    where: { videoId },
    orderBy: { startTime: 'asc' },
  });
}
