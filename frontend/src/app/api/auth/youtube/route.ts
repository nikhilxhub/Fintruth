import { NextResponse } from 'next/server';
import { getAuthorizationUrl } from '@/lib/youtube/oauth2';

/**
 * GET /api/auth/youtube
 * 
 * Redirects to Google OAuth2 authorization page
 * After authorization, user will be redirected to /api/auth/youtube/callback
 */
export async function GET() {
  try {
    const authUrl = getAuthorizationUrl();
    return NextResponse.redirect(authUrl);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[OAuth2] Error generating authorization URL:', errorMessage);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate authorization URL',
        message: errorMessage,
        setupInstructions: {
          step1: 'Set YOUTUBE_OAUTH_CLIENT_ID in .env',
          step2: 'Set YOUTUBE_OAUTH_CLIENT_SECRET in .env',
          step3: 'Create OAuth2 credentials in Google Cloud Console',
        },
      },
      { status: 500 }
    );
  }
}

