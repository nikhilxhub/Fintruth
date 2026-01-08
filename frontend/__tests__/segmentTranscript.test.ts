import {
  segmentTranscript,
  segmentByChunkCount,
  segmentWithOverlap,
} from '../lib/transcript/segmentTranscript';
import { TranscriptChunk } from '@prisma/client';

// Helper to create mock transcript chunks
function createMockChunks(texts: string[], startTimes?: number[]): TranscriptChunk[] {
  return texts.map((text, index) => ({
    id: `chunk-${index}`,
    videoId: 'test-video',
    text,
    startTime: startTimes?.[index] ?? index * 5,
    createdAt: new Date(),
  }));
}

describe('segmentTranscript', () => {
  it('should return empty array for empty input', () => {
    const result = segmentTranscript([]);
    expect(result).toEqual([]);
  });

  it('should handle single chunk', () => {
    const chunks = createMockChunks(['This is a single chunk of text.']);
    const result = segmentTranscript(chunks);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('This is a single chunk of text.');
    expect(result[0].startTime).toBe(0);
    expect(result[0].chunkIds).toEqual(['chunk-0']);
  });

  it('should group short chunks together', () => {
    const chunks = createMockChunks([
      'Hello',
      'this is',
      'a test',
      'of grouping',
      'short chunks',
      'together into',
      'semantic blocks.',
    ]);

    const result = segmentTranscript(chunks);

    // Should be grouped into at least one block
    expect(result.length).toBeGreaterThanOrEqual(1);

    // Total text should be preserved
    const totalText = result.map((b) => b.text).join(' ');
    expect(totalText).toContain('Hello');
    expect(totalText).toContain('semantic blocks.');
  });

  it('should respect sentence boundaries', () => {
    const chunks = createMockChunks([
      'The market is going up.',
      'I think stocks will rise.',
      'This is my prediction for 2024.',
      'Economic growth looks strong.',
      'The Fed might cut rates.',
    ]);

    const result = segmentTranscript(chunks);

    // Each block should end with sentence-ending punctuation
    for (const block of result) {
      expect(block.text).toMatch(/[.!?]$/);
    }
  });

  it('should preserve startTime from first chunk in block', () => {
    const startTimes = [0, 10, 20, 30, 40, 50, 60];
    const chunks = createMockChunks(
      [
        'First sentence here.',
        'Second sentence here.',
        'Third sentence here.',
        'Fourth sentence here.',
        'Fifth sentence here.',
        'Sixth sentence here.',
        'Seventh sentence here.',
      ],
      startTimes
    );

    const result = segmentTranscript(chunks);

    // First block should start at time 0
    expect(result[0].startTime).toBe(0);
  });

  it('should track chunk IDs correctly', () => {
    const chunks = createMockChunks([
      'The Indian stock market',
      'is expected to',
      'perform well in 2024.',
    ]);

    const result = segmentTranscript(chunks);

    // All chunk IDs should be present
    const allChunkIds = result.flatMap((b) => b.chunkIds);
    expect(allChunkIds).toContain('chunk-0');
    expect(allChunkIds).toContain('chunk-1');
    expect(allChunkIds).toContain('chunk-2');
  });

  it('should handle long text blocks', () => {
    const longText =
      'The stock market is showing signs of strength with multiple indicators pointing to continued growth in the coming months and years.';
    const chunks = createMockChunks([
      longText,
      longText,
      longText,
      longText,
    ]);

    const result = segmentTranscript(chunks);

    // Should split into multiple blocks due to MAX_WORDS_PER_BLOCK
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('should skip empty chunks', () => {
    const chunks = createMockChunks(['Hello world.', '', '  ', 'Goodbye world.']);

    const result = segmentTranscript(chunks);

    // Empty chunks should be skipped
    const totalText = result.map((b) => b.text).join(' ');
    expect(totalText).not.toContain('  ');
  });
});

describe('segmentByChunkCount', () => {
  it('should return empty array for empty input', () => {
    const result = segmentByChunkCount([]);
    expect(result).toEqual([]);
  });

  it('should group by specified chunk count', () => {
    const chunks = createMockChunks([
      'One',
      'Two',
      'Three',
      'Four',
      'Five',
      'Six',
      'Seven',
      'Eight',
      'Nine',
      'Ten',
    ]);

    const result = segmentByChunkCount(chunks, 5);

    expect(result).toHaveLength(2);
    expect(result[0].chunkIds).toHaveLength(5);
    expect(result[1].chunkIds).toHaveLength(5);
  });

  it('should handle remainder chunks', () => {
    const chunks = createMockChunks(['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven']);

    const result = segmentByChunkCount(chunks, 3);

    expect(result).toHaveLength(3);
    expect(result[0].chunkIds).toHaveLength(3);
    expect(result[1].chunkIds).toHaveLength(3);
    expect(result[2].chunkIds).toHaveLength(1);
  });

  it('should default to 5 chunks per block', () => {
    const chunks = createMockChunks(Array(15).fill('Text'));

    const result = segmentByChunkCount(chunks);

    expect(result).toHaveLength(3);
  });
});

describe('segmentWithOverlap', () => {
  it('should return empty array for empty input', () => {
    const result = segmentWithOverlap([]);
    expect(result).toEqual([]);
  });

  it('should create overlapping blocks', () => {
    const chunks = createMockChunks(Array(10).fill(null).map((_, i) => `Chunk ${i}`));

    const result = segmentWithOverlap(chunks, 6, 2);

    // With 10 chunks, block size 6, overlap 2 (step 4):
    // Block 1: chunks 0-5
    // Block 2: chunks 4-9
    expect(result.length).toBeGreaterThanOrEqual(2);

    // First block should have chunk-0
    expect(result[0].chunkIds).toContain('chunk-0');
  });

  it('should preserve context with overlap', () => {
    const chunks = createMockChunks([
      'The market',
      'is going',
      'to rise',
      'by 10%',
      'next year.',
      'This is',
      'based on',
      'my analysis.',
    ]);

    const result = segmentWithOverlap(chunks, 4, 2);

    // With overlap, some chunks should appear in multiple blocks
    const allChunkIds = result.flatMap((b) => b.chunkIds);
    const uniqueCount = new Set(allChunkIds).size;

    // Total should be greater than unique (indicating overlap)
    expect(allChunkIds.length).toBeGreaterThan(uniqueCount);
  });
});
