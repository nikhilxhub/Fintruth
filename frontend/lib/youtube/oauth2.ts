import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

/**
 * Create OAuth2 client for YouTube API
 */
export function getOAuth2Client(): OAuth2Client {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_OAUTH_REDIRECT_URI || 'http://localhost:3000/api/auth/youtube/callback';

  if (!clientId || !clientSecret) {
    throw new Error(
      'YOUTUBE_OAUTH_CLIENT_ID and YOUTUBE_OAUTH_CLIENT_SECRET must be set in environment variables'
    );
  }

  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

/**
 * Get authorized YouTube API client using stored tokens
 * Returns null if tokens are not available
 */
export async function getAuthorizedYoutubeClient(): Promise<typeof google.youtube | null> {
  const refreshToken = process.env.YOUTUBE_OAUTH_REFRESH_TOKEN;
  
  if (!refreshToken) {
    console.warn('[OAuth2] YOUTUBE_OAUTH_REFRESH_TOKEN not set. Run OAuth2 flow first.');
    return null;
  }

  const oauth2Client = getOAuth2Client();
  
  try {
    // Set credentials using refresh token
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    // Refresh access token
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // Set the new access token
    oauth2Client.setCredentials(credentials);

    // Create YouTube client with OAuth2
    return google.youtube({
      version: 'v3',
      auth: oauth2Client,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[OAuth2] Error refreshing access token:', errorMessage);
    return null;
  }
}

/**
 * Generate authorization URL for OAuth2 flow
 */
export function getAuthorizationUrl(): string {
  const oauth2Client = getOAuth2Client();
  
  const scopes = [
    'https://www.googleapis.com/auth/youtube.force-ssl', // Read/write access to YouTube account
    // Alternatively, use readonly scope if you only need to read:
    // 'https://www.googleapis.com/auth/youtube.readonly',
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Required to get refresh token
    scope: scopes,
    prompt: 'consent', // Force consent screen to get refresh token
  });

  return authUrl;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expiry_date: number | null;
}> {
  const oauth2Client = getOAuth2Client();
  
  const { tokens } = await oauth2Client.getToken(code);
  
  if (!tokens.refresh_token) {
    throw new Error('No refresh token received. Make sure prompt=consent is used in authorization URL.');
  }

  return {
    access_token: tokens.access_token || '',
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date || null,
  };
}

