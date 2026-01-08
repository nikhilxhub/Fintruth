import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const youtube = google.youtube('v3');

/**
 * GET /api/test/youtube?channelId=UCXXXX
 * 
 * Test endpoint to verify YouTube API key is working
 */
export async function GET(request: NextRequest) {
  const channelId = request.nextUrl.searchParams.get('channelId') || 'UCqW8jxh4tH1Z1sWPbkGWL4g';
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'YOUTUBE_API_KEY not found in environment variables',
        message: 'Please check your .env file',
      },
      { status: 500 }
    );
  }

  try {
    // Test 1: Try to fetch channel info
    console.log(`[Test] Testing YouTube API with channel: ${channelId}`);
    
    const response = await youtube.channels.list({
      key: apiKey,
      id: [channelId],
      part: ['snippet'],
    });

    const channel = response.data.items?.[0];

    if (!channel) {
      return NextResponse.json(
        {
          success: false,
          error: 'Channel not found',
          channelId,
          apiKeyPrefix: apiKey.substring(0, 10) + '...',
          message: 'The API key works, but the channel ID might be wrong',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'YouTube API key is working correctly!',
      channel: {
        id: channel.id,
        title: channel.snippet?.title,
        handle: channel.snippet?.customUrl,
        description: channel.snippet?.description?.substring(0, 100) + '...',
      },
      apiKeyPrefix: apiKey.substring(0, 10) + '...',
    });
  } catch (err: any) {
    const errorMessage = err.message || 'Unknown error';
    const errorCode = err.code || 'UNKNOWN';

    return NextResponse.json(
      {
        success: false,
        error: 'YouTube API Error',
        errorCode,
        errorMessage,
        apiKeyPrefix: apiKey.substring(0, 10) + '...',
        troubleshooting: {
          ifApiNotEnabled: 'Go to Google Cloud Console and enable YouTube Data API v3',
          ifInvalidKey: 'Create a new API key from Google Cloud Console',
          ifWrongProject: 'Make sure the API key is from the project where YouTube Data API v3 is enabled',
        },
      },
      { status: 400 }
    );
  }
}

