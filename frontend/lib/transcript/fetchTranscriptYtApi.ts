import { getAuthorizedYoutubeClient } from '../youtube/oauth2';
import { FetchTranscriptResult, TranscriptEntry } from './fetchTranscript';

/**
 * Parse time string to seconds
 * Supports: "HH:MM:SS.mmm", "HH:MM:SS,mmm", "SS.mmm", "SS,mmm"
 */
function parseTimeToSeconds(timeStr: string): number | null {
  // Try full format: HH:MM:SS.mmm or HH:MM:SS,mmm
  const fullMatch = timeStr.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
  if (fullMatch) {
    const hours = parseInt(fullMatch[1], 10);
    const minutes = parseInt(fullMatch[2], 10);
    const seconds = parseInt(fullMatch[3], 10);
    const milliseconds = parseInt(fullMatch[4], 10);
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }
  
  // Try short format: SS.mmm or SS,mmm
  const shortMatch = timeStr.match(/(\d+)[,.](\d{3})/);
  if (shortMatch) {
    const seconds = parseInt(shortMatch[1], 10);
    const milliseconds = parseInt(shortMatch[2], 10);
    return seconds + milliseconds / 1000;
  }
  
  // Try seconds only
  const secondsMatch = timeStr.match(/^(\d+)$/);
  if (secondsMatch) {
    return parseFloat(secondsMatch[1]);
  }
  
  return null;
}

/**
 * Parse TTML/SRT caption format to extract text and timestamps
 */
function parseCaptionContent(content: string, format: string = 'ttml'): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  
  if (format === 'ttml') {
    // TTML format: XML-based format
    // Parse <p> elements with begin attribute
    const pMatches = content.matchAll(/<p[^>]*begin="([^"]+)"[^>]*>(.*?)<\/p>/gs);
    
    for (const match of pMatches) {
      const timeStr = match[1];
      const text = match[2]
        .replace(/<[^>]+>/g, '') // Remove XML tags
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n/g, ' ')
        .trim();
      
      if (!text) continue;
      
      // Parse time format: HH:MM:SS.mmm or HH:MM:SS,mmm or SS.mmm
      const timeInSeconds = parseTimeToSeconds(timeStr);
      if (timeInSeconds !== null) {
        entries.push({
          text,
          startTime: timeInSeconds,
        });
      }
    }
  } else if (format === 'srt') {
    // SRT format: "00:00:01,500 --> 00:00:03,000\nText content"
    const blocks = content.split(/\n\s*\n/); // Split by double newline
    
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 2) continue;
      
      // Second line contains timestamp: "00:00:01,500 --> 00:00:03,000"
      const timeLine = lines[1];
      const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
      
      if (timeMatch) {
        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const seconds = parseInt(timeMatch[3], 10);
        const milliseconds = parseInt(timeMatch[4], 10);
        const startTime = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
        
        // Remaining lines are text
        const text = lines.slice(2).join(' ').trim().replace(/<[^>]+>/g, '');
        
        if (text) {
          entries.push({
            text,
            startTime,
          });
        }
      }
    }
  }
  
  // Sort by startTime
  entries.sort((a, b) => a.startTime - b.startTime);
  
  return entries;
}

/**
 * Fetch transcript using YouTube Data API v3 captions.download with OAuth2
 * This is more reliable than youtube-transcript library
 */
export async function fetchTranscriptUsingYtApi(videoId: string): Promise<FetchTranscriptResult | null> {
  try {
    // Get authorized YouTube client
    const youtube = await getAuthorizedYoutubeClient();
    
    if (!youtube) {
      // OAuth2 not configured, return null to fall back to youtube-transcript library
      return null;
    }

    console.log(`[fetchTranscriptYtApi] Listing caption tracks for video: ${videoId}`);
    
    // Step 1: List caption tracks for the video
    const captionListResponse = await youtube.captions.list({
      part: ['snippet'],
      videoId: videoId,
    });

    const captionTracks = captionListResponse.data.items || [];

    if (captionTracks.length === 0) {
      console.log(`[fetchTranscriptYtApi] No caption tracks found for video: ${videoId}`);
      return null;
    }

    // Find English caption track (prefer non-auto-generated, fallback to any)
    let captionTrack = captionTracks.find(
      (track) => 
        track.snippet?.language === 'en' && 
        track.snippet?.trackKind === 'standard'
    ) || captionTracks.find((track) => track.snippet?.language === 'en') || captionTracks[0];

    const captionId = captionTrack?.id;
    if (!captionId) {
      console.log(`[fetchTranscriptYtApi] No valid caption track ID found for video: ${videoId}`);
      return null;
    }

    console.log(`[fetchTranscriptYtApi] Found caption track: ${captionId} (language: ${captionTrack.snippet?.language}, kind: ${captionTrack.snippet?.trackKind})`);

    // Step 2: Download caption content
    // TTML is the default format from YouTube API
    let captionContent: string | null = null;
    let captionFormat = 'ttml';

    try {
      console.log(`[fetchTranscriptYtApi] Downloading caption (default TTML format)...`);
      const captionResponse = await youtube.captions.download({
        id: captionId,
        // Don't specify tfmt - use default TTML format
      });

      // The response is a stream, convert to string
      if (typeof captionResponse.data === 'string') {
        captionContent = captionResponse.data;
      } else {
        // Convert stream to string
        const chunks: Buffer[] = [];
        const stream = captionResponse.data as any;
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        captionContent = Buffer.concat(chunks).toString('utf-8');
      }
      
      console.log(`[fetchTranscriptYtApi] Successfully downloaded caption (${captionContent.length} bytes)`);
    } catch (downloadError) {
      console.error(`[fetchTranscriptYtApi] Failed to download caption: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`);
      return null;
    }

    if (!captionContent) {
      console.log(`[fetchTranscriptYtApi] Failed to download caption content for video: ${videoId}`);
      return null;
    }

    // Step 3: Parse caption content
    const transcriptEntries = parseCaptionContent(captionContent, captionFormat);

    if (transcriptEntries.length === 0) {
      console.log(`[fetchTranscriptYtApi] Failed to parse caption content for video: ${videoId}`);
      return null;
    }

    console.log(`[fetchTranscriptYtApi] Successfully parsed ${transcriptEntries.length} transcript entries`);

    return {
      success: true,
      videoId,
      chunksStored: transcriptEntries.length,
      transcriptEntries, // Return entries for storage
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[fetchTranscriptYtApi] Error: ${errorMessage}`);
    return null; // Return null to fall back to youtube-transcript library
  }
}

