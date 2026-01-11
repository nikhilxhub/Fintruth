import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/youtube/oauth2';

/**
 * GET /api/auth/youtube/callback
 * 
 * OAuth2 callback endpoint
 * Receives authorization code and exchanges it for tokens
 * 
 * IMPORTANT: After receiving tokens, update your .env file with:
 * YOUTUBE_OAUTH_REFRESH_TOKEN=<the_refresh_token_here>
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'OAuth2 authorization failed',
          errorDescription: error,
        },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          error: 'No authorization code provided',
        },
        { status: 400 }
      );
    }

    console.log('[OAuth2] Exchanging code for tokens...');
    const tokens = await exchangeCodeForTokens(code);

    // Return tokens to user (they need to add refresh_token to .env)
    return NextResponse.json({
      success: true,
      message: 'OAuth2 authorization successful!',
      instructions: {
        step1: 'Copy the refresh_token below',
        step2: 'Add it to your .env file as YOUTUBE_OAUTH_REFRESH_TOKEN',
        step3: 'Restart your dev server',
        step4: 'DO NOT commit the refresh token to git!',
      },
      tokens: {
        refresh_token: tokens.refresh_token,
        // Access token is temporary, don't store it
        access_token_length: tokens.access_token?.length || 0,
        expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[OAuth2] Error in callback:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to exchange code for tokens',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

