import prisma from '../db';
import { fetchVideosForChannel, getUnfetchedVideos, getVideosWithoutPredictions } from '../youtube/fetchVideos';
import { fetchTranscriptForVideo, getTranscriptChunks } from '../transcript/fetchTranscript';
import { segmentTranscript } from '../transcript/segmentTranscript';
import { extractPredictionsForVideo } from '../llm/extractPredictions';

export interface PipelineResult {
  channelId: string;
  creatorId: string;
  stages: {
    videoFetch: {
      success: boolean;
      videosFound: number;
      videosInserted: number;
      videosSkipped: number;
      errors: string[];
    };
    transcriptFetch: {
      success: boolean;
      videosProcessed: number;
      totalChunks: number;
      errors: string[];
    };
    predictionExtraction: {
      success: boolean;
      videosProcessed: number;
      totalPredictions: number;
      errors: string[];
    };
  };
  totalDurationMs: number;
  completedAt: string;
}

export interface PipelineOptions {
  maxVideos?: number;
  skipVideoFetch?: boolean;
  skipTranscriptFetch?: boolean;
  skipPredictionExtraction?: boolean;
}

/**
 * Run the full ingestion pipeline for a YouTube channel
 *
 * Flow:
 * 1. Fetch videos from YouTube Data API
 * 2. Fetch transcripts for new videos
 * 3. Segment transcripts into blocks
 * 4. Extract predictions using LLM
 */
export async function runIngestionPipeline(
  channelId: string,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const startTime = Date.now();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Pipeline] Starting ingestion for channel: ${channelId}`);
  console.log(`${'='.repeat(60)}\n`);

  const result: PipelineResult = {
    channelId,
    creatorId: '',
    stages: {
      videoFetch: {
        success: false,
        videosFound: 0,
        videosInserted: 0,
        videosSkipped: 0,
        errors: [],
      },
      transcriptFetch: {
        success: false,
        videosProcessed: 0,
        totalChunks: 0,
        errors: [],
      },
      predictionExtraction: {
        success: false,
        videosProcessed: 0,
        totalPredictions: 0,
        errors: [],
      },
    },
    totalDurationMs: 0,
    completedAt: '',
  };

  try {
    // Stage 1: Fetch videos
    if (!options.skipVideoFetch) {
      console.log('\n--- Stage 1: Fetching Videos ---\n');
      try {
        const fetchResult = await fetchVideosForChannel(channelId, options.maxVideos || 50);

        result.stages.videoFetch = {
          success: fetchResult.errors.length === 0,
          ...fetchResult,
        };

        console.log(`[Pipeline] Video fetch complete: ${fetchResult.videosInserted} new videos`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        result.stages.videoFetch.errors.push(errorMessage);
        result.stages.videoFetch.success = false;
        console.error(`[Pipeline] Video fetch failed: ${errorMessage}`);
      }
    } else {
      console.log('\n--- Stage 1: Skipped (video fetch disabled) ---\n');
      result.stages.videoFetch.success = true;
    }

    // Get creator ID
    const creator = await prisma.creator.findUnique({
      where: { channelId },
    });

    if (!creator) {
      throw new Error(`Creator not found for channel: ${channelId}`);
    }

    result.creatorId = creator.id;

    // Stage 2: Fetch transcripts
    if (!options.skipTranscriptFetch) {
      console.log('\n--- Stage 2: Fetching Transcripts ---\n');
      const unfetchedVideos = await getUnfetchedVideos(creator.id);
      console.log(`[Pipeline] Found ${unfetchedVideos.length} videos without transcripts`);

      for (const video of unfetchedVideos) {
        const transcriptResult = await fetchTranscriptForVideo(video.id);

        if (transcriptResult.success) {
          result.stages.transcriptFetch.videosProcessed++;
          result.stages.transcriptFetch.totalChunks += transcriptResult.chunksStored;
        } else if (transcriptResult.error) {
          result.stages.transcriptFetch.errors.push(`${video.id}: ${transcriptResult.error}`);
        }
      }

      result.stages.transcriptFetch.success = true;
      console.log(
        `[Pipeline] Transcript fetch complete: ${result.stages.transcriptFetch.videosProcessed} videos, ${result.stages.transcriptFetch.totalChunks} chunks`
      );
    } else {
      console.log('\n--- Stage 2: Skipped (transcript fetch disabled) ---\n');
      result.stages.transcriptFetch.success = true;
    }

    // Stage 3: Extract predictions
    if (!options.skipPredictionExtraction) {
      console.log('\n--- Stage 3: Extracting Predictions ---\n');
      const videosForPrediction = await getVideosWithoutPredictions(creator.id);
      console.log(`[Pipeline] Found ${videosForPrediction.length} videos for prediction extraction`);

      for (const video of videosForPrediction) {
        // Get transcript chunks
        const chunks = await getTranscriptChunks(video.id);

        if (chunks.length === 0) {
          console.log(`[Pipeline] No transcript chunks for video: ${video.id}, skipping`);
          // Mark as processed anyway
          await prisma.video.update({
            where: { id: video.id },
            data: { predictionsExtracted: true },
          });
          continue;
        }

        // Segment transcript
        const blocks = segmentTranscript(chunks);
        console.log(`[Pipeline] Video ${video.id}: ${chunks.length} chunks -> ${blocks.length} blocks`);

        // Extract predictions
        const extractionResult = await extractPredictionsForVideo(video.id, blocks);

        result.stages.predictionExtraction.videosProcessed++;
        result.stages.predictionExtraction.totalPredictions += extractionResult.totalPredictions;
        result.stages.predictionExtraction.errors.push(...extractionResult.errors);
      }

      result.stages.predictionExtraction.success = true;
      console.log(
        `[Pipeline] Prediction extraction complete: ${result.stages.predictionExtraction.totalPredictions} predictions from ${result.stages.predictionExtraction.videosProcessed} videos`
      );
    } else {
      console.log('\n--- Stage 3: Skipped (prediction extraction disabled) ---\n');
      result.stages.predictionExtraction.success = true;
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Pipeline] Fatal error: ${errorMessage}`);

    // Add error to the appropriate stage
    if (!result.stages.videoFetch.success) {
      result.stages.videoFetch.errors.push(errorMessage);
    } else if (!result.stages.transcriptFetch.success) {
      result.stages.transcriptFetch.errors.push(errorMessage);
    } else {
      result.stages.predictionExtraction.errors.push(errorMessage);
    }
  }

  result.totalDurationMs = Date.now() - startTime;
  result.completedAt = new Date().toISOString();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Pipeline] Completed in ${(result.totalDurationMs / 1000).toFixed(2)}s`);
  console.log(`${'='.repeat(60)}\n`);

  return result;
}

/**
 * Check if a pipeline is currently running for a channel
 * Uses a simple in-memory lock (for single-instance deployment)
 */
const runningPipelines = new Set<string>();

export function isPipelineRunning(channelId: string): boolean {
  return runningPipelines.has(channelId);
}

export function markPipelineRunning(channelId: string): boolean {
  if (runningPipelines.has(channelId)) {
    return false;
  }
  runningPipelines.add(channelId);
  return true;
}

export function markPipelineComplete(channelId: string): void {
  runningPipelines.delete(channelId);
}

/**
 * Run pipeline with lock protection
 */
export async function runIngestionPipelineWithLock(
  channelId: string,
  options: PipelineOptions = {}
): Promise<PipelineResult | null> {
  if (!markPipelineRunning(channelId)) {
    console.log(`[Pipeline] Pipeline already running for channel: ${channelId}`);
    return null;
  }

  try {
    return await runIngestionPipeline(channelId, options);
  } finally {
    markPipelineComplete(channelId);
  }
}
