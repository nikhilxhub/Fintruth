<!-- # OAuth2 Setup Guide for YouTube Data API v3 Captions

This guide will help you set up OAuth2 authentication to use YouTube Data API v3 for fetching video transcripts.

## Prerequisites

- Google Cloud Console account
- YouTube Data API v3 enabled in your project
- Existing YOUTUBE_API_KEY (for video fetching, not captions)

## Step 1: Create OAuth2 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (the same one where YouTube Data API v3 is enabled)
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**

### Configure OAuth Consent Screen (if prompted)

1. Choose **External** (unless you have Google Workspace)
2. Fill in required fields:
   - **App name**: FinTruth
   - **User support email**: Your email
   - **Developer contact information**: Your email
3. Click **Save and Continue**
4. **Scopes**: Click **Add or Remove Scopes**
   - Search for and add: `https://www.googleapis.com/auth/youtube.force-ssl`
   - Or use: `https://www.googleapis.com/auth/youtube.readonly` (read-only)
   - Click **Update** > **Save and Continue**
5. **Test users**: Add your Google account email (for testing)
   - Click **Save and Continue**
6. Click **Back to Dashboard**

### Create OAuth Client ID

1. **Application type**: Select **Web application**
2. **Name**: FinTruth Transcript Fetcher
3. **Authorized redirect URIs**: Add:
   ```
   http://localhost:3000/api/auth/youtube/callback
   ```
   (For production, add your production URL)
4. Click **Create**
5. **Copy your Client ID and Client Secret** (you'll need these!)

## Step 2: Update Environment Variables

Add these to your `frontend/.env` file:

```env
# OAuth2 Credentials (for YouTube Data API v3 captions)
YOUTUBE_OAUTH_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
YOUTUBE_OAUTH_CLIENT_SECRET=your-client-secret-here
YOUTUBE_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/youtube/callback

# After OAuth2 flow, add the refresh token:
YOUTUBE_OAUTH_REFRESH_TOKEN=your-refresh-token-here
```

## Step 3: Run OAuth2 Authorization Flow

1. **Start your dev server** (if not already running):
   ```bash
   cd frontend
   npm run dev
   ```

2. **Open authorization URL in browser**:
   ```
   http://localhost:3000/api/auth/youtube
   ```
   Or visit it directly - it will redirect you to Google's authorization page.

3. **Authorize the application**:
   - You'll see a Google consent screen
   - Click **Allow** to grant permissions
   - You'll be redirected back to `/api/auth/youtube/callback`

4. **Copy the refresh token**:
   - The callback page will show you a JSON response with `refresh_token`
   - Copy the `refresh_token` value
   - Add it to your `.env` file as `YOUTUBE_OAUTH_REFRESH_TOKEN`

5. **Restart your dev server**:
   ```bash
   # Stop the server (Ctrl+C)
   # Start it again
   npm run dev
   ```

## Step 4: Test Transcript Fetching

Now you can test transcript fetching:

```bash
# Test with a single video
curl "http://localhost:3000/api/test/transcript?videoId=l3sU-z6kExk"

# Or run the full ingestion pipeline
curl -X POST http://localhost:3000/api/ingest/channel \
  -H "Content-Type: application/json" \
  -H "x-api-key: 123123123123" \
  -d '{"channelId": "UCqW8jxh4tH1Z1sWPbkGWL4g", "options": {"skipVideoFetch": true}}'
```

## How It Works

1. **Fallback Strategy**: The code first tries YouTube Data API v3 (if OAuth2 is configured)
2. **If OAuth2 is not configured**: Falls back to `youtube-transcript` library
3. **Automatic Token Refresh**: The OAuth2 client automatically refreshes access tokens using the refresh token

## Troubleshooting

### "OAuth2 not configured" message
- Check that all environment variables are set correctly
- Make sure you've completed the OAuth2 flow and added the refresh token
- Restart your dev server after adding environment variables

### "Invalid client" error
- Verify your Client ID and Client Secret are correct
- Make sure the redirect URI matches exactly (including http://localhost:3000)

### "Access denied" error
- Check that you've added yourself as a test user in OAuth consent screen
- Make sure you've granted the correct scopes

### Refresh token not appearing
- Make sure you use `prompt=consent` in the authorization URL (already included in the code)
- Delete cookies and try again
- Check that the redirect URI matches exactly

## Security Notes

⚠️ **IMPORTANT**:
- Never commit your `.env` file to git
- Keep your Client Secret and Refresh Token secure
- In production, use environment variables or a secrets manager
- Restrict your OAuth client ID to specific domains/IPs in Google Cloud Console

## Production Setup

For production:
1. Add your production redirect URI to OAuth client
2. Publish your OAuth consent screen (or it will be limited to test users)
3. Use secure environment variable storage (not `.env` file in production)
4. Consider storing refresh token in a database with encryption
 -->
