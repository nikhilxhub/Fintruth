import { TranscriptChunk } from '@prisma/client';

export interface SegmentedBlock {
  text: string;
  startTime: number;
  chunkIds: string[]; // IDs of the original chunks that make up this block
}

// Target ~2-3 sentences per block
// Average sentence is ~15-20 words, so target ~50-100 words per block
const MIN_WORDS_PER_BLOCK = 30;
const MAX_WORDS_PER_BLOCK = 120;
const TARGET_CHUNKS_PER_BLOCK = 5; // ~2-3 sentences worth of caption chunks

/**
 * Count words in a text string
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Check if text ends with sentence-ending punctuation
 */
function endsWithSentence(text: string): boolean {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed);
}

/**
 * Segment transcript chunks into semantic blocks of ~2-3 sentences
 *
 * Strategy:
 * 1. Group chunks until we reach MIN_WORDS_PER_BLOCK
 * 2. Continue until we hit a sentence boundary or MAX_WORDS_PER_BLOCK
 * 3. Each block maintains the startTime of its first chunk
 */
export function segmentTranscript(chunks: TranscriptChunk[]): SegmentedBlock[] {
  if (chunks.length === 0) {
    return [];
  }

  const blocks: SegmentedBlock[] = [];
  let currentText = '';
  let currentStartTime = chunks[0].startTime;
  let currentChunkIds: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkText = chunk.text.trim();

    if (!chunkText) continue;

    // Add chunk to current block
    currentText = currentText ? `${currentText} ${chunkText}` : chunkText;
    currentChunkIds.push(chunk.id);

    const wordCount = countWords(currentText);
    const isLastChunk = i === chunks.length - 1;
    const hasEnoughWords = wordCount >= MIN_WORDS_PER_BLOCK;
    const isSentenceEnd = endsWithSentence(currentText);
    const isTooLong = wordCount >= MAX_WORDS_PER_BLOCK;
    const hasEnoughChunks = currentChunkIds.length >= TARGET_CHUNKS_PER_BLOCK;

    // Finalize block if:
    // 1. It's the last chunk
    // 2. We have enough words AND (sentence ends OR too long OR enough chunks)
    const shouldFinalize =
      isLastChunk || (hasEnoughWords && (isSentenceEnd || isTooLong || hasEnoughChunks));

    if (shouldFinalize && currentText.trim()) {
      blocks.push({
        text: currentText.trim(),
        startTime: currentStartTime,
        chunkIds: [...currentChunkIds],
      });

      // Reset for next block
      currentText = '';
      currentChunkIds = [];
      if (i < chunks.length - 1) {
        currentStartTime = chunks[i + 1].startTime;
      }
    }
  }

  // Handle any remaining text
  if (currentText.trim()) {
    blocks.push({
      text: currentText.trim(),
      startTime: currentStartTime,
      chunkIds: currentChunkIds,
    });
  }

  return blocks;
}

/**
 * Alternative segmentation: fixed chunk count per block
 * Simpler approach that groups a fixed number of chunks together
 */
export function segmentByChunkCount(
  chunks: TranscriptChunk[],
  chunksPerBlock: number = 5
): SegmentedBlock[] {
  if (chunks.length === 0) {
    return [];
  }

  const blocks: SegmentedBlock[] = [];

  for (let i = 0; i < chunks.length; i += chunksPerBlock) {
    const blockChunks = chunks.slice(i, i + chunksPerBlock);
    const text = blockChunks.map((c) => c.text.trim()).join(' ');
    const chunkIds = blockChunks.map((c) => c.id);

    if (text.trim()) {
      blocks.push({
        text: text.trim(),
        startTime: blockChunks[0].startTime,
        chunkIds,
      });
    }
  }

  return blocks;
}

/**
 * Segment transcript with overlap for better context
 * Each block overlaps with the previous one by a specified number of chunks
 */
export function segmentWithOverlap(
  chunks: TranscriptChunk[],
  chunksPerBlock: number = 6,
  overlapChunks: number = 2
): SegmentedBlock[] {
  if (chunks.length === 0) {
    return [];
  }

  const blocks: SegmentedBlock[] = [];
  const step = chunksPerBlock - overlapChunks;

  for (let i = 0; i < chunks.length; i += step) {
    const blockChunks = chunks.slice(i, i + chunksPerBlock);
    if (blockChunks.length === 0) break;

    const text = blockChunks.map((c) => c.text.trim()).join(' ');
    const chunkIds = blockChunks.map((c) => c.id);

    if (text.trim()) {
      blocks.push({
        text: text.trim(),
        startTime: blockChunks[0].startTime,
        chunkIds,
      });
    }

    // Stop if we've reached the end
    if (i + chunksPerBlock >= chunks.length) break;
  }

  return blocks;
}
