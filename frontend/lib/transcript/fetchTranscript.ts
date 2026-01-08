import { YoutubeTranscript } from 'youtube-transcript';
import prisma from '../db';

export interface TranscriptEntry {
  text: string;
  startTime: number; // seconds
}

export interface FetchTranscriptResult {
  success: boolean;
  videoId: string;
  chunksStored: number;
  error?: string;
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

    const rawTranscript = await YoutubeTranscript.fetchTranscript(videoId);

    if (!rawTranscript || rawTranscript.length === 0) {
      result.error = 'No transcript available for this video';
      // Mark as fetched but with no transcript
      await prisma.video.update({
        where: { id: videoId },
        data: { transcriptFetched: true },
      });
      return result;
    }

    // Normalize transcript entries
    const normalizedTranscript = normalizeTranscript(rawTranscript);

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
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    result.error = errorMessage;
    console.error(`[fetchTranscript] Error fetching transcript for ${videoId}: ${errorMessage}`);

    // If transcript is disabled or unavailable, mark as fetched to avoid retrying
    if (
      errorMessage.includes('disabled') ||
      errorMessage.includes('unavailable') ||
      errorMessage.includes('Could not get')
    ) {
      try {
        await prisma.video.update({
          where: { id: videoId },
          data: { transcriptFetched: true },
        });
      } catch {
        // Ignore update error
      }
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
