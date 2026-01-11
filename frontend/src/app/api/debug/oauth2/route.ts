import { NextResponse } from 'next/server';
import { getOAuth2Client } from '@/lib/youtube/oauth2';

/**
 * GET /api/debug/oauth2
 * 
 * Debug endpoint to see what OAuth2 settings are being used
 */
export async function GET() {
  try {
    const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.YOUTUBE_OAUTH_REDIRECT_URI || 'http://localhost:3000/api/auth/youtube/callback';

    // Create client to verify it works
    const oauth2Client = getOAuth2Client();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/youtube.force-ssl'],
      prompt: 'consent',
    });

    return NextResponse.json({
      success: true,
      message: 'OAuth2 configuration check',
      config: {
        clientId: clientId ? `${clientId.substring(0, 20)}...` : 'NOT SET',
        clientSecret: clientSecret ? `${clientSecret.substring(0, 10)}...` : 'NOT SET',
        redirectUri: redirectUri,
        redirectUriLength: redirectUri.length,
        redirectUriBytes: Buffer.from(redirectUri).length,
      },
      authorizationUrl: authUrl,
      instructions: {
        step1: 'Copy the redirectUri value above',
        step2: 'Make sure this EXACT value is in Google Cloud Console',
        step3: 'No trailing slash, no spaces, exact match required',
        step4: 'Changes in Google Cloud Console can take 1-5 minutes to propagate',
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check OAuth2 configuration',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

