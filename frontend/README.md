 FinTruth Pipeline - Complete

  I've built the complete YouTube Finfluencer Accuracy Pipeline. Here's a summary:

  Project Structure

  frontend/
  ├── prisma/
  │   └── schema.prisma           # Database schema (Creator, Video, TranscriptChunk, Prediction)
  ├── lib/
  │   ├── db.ts                   # Prisma client singleton
  │   ├── rateLimit.ts            # Rate limiting utilities
  │   ├── youtube/
  │   │   ├── fetchVideos.ts      # YouTube Data API v3 integration
  │   │   └── index.ts
  │   ├── transcript/
  │   │   ├── fetchTranscript.ts  # YouTube transcript fetching
  │   │   ├── segmentTranscript.ts # Semantic block segmentation
  │   │   └── index.ts
  │   ├── llm/
  │   │   ├── extractPredictions.ts # Gemini API prediction extraction
  │   │   └── index.ts
  │   └── pipeline/
  │       ├── runIngestion.ts     # Pipeline orchestrator
  │       └── index.ts
  ├── app/api/ingest/channel/
  │   └── route.ts                # POST /api/ingest/channel endpoint
  ├── __tests__/
  │   ├── segmentTranscript.test.ts
  │   └── extractPredictions.test.ts
  ├── .env.example                # Environment variables template
  └── jest.config.js              # Jest configuration

  Features Implemented

  1. Database Schema - 4 models with proper relations and indexes
  2. YouTube Ingestion - Fetches videos filtered by finance keywords (market, stock, invest, economy)
  3. Transcript Fetching - Uses youtube-transcript with error handling
  4. Transcript Segmentation - Groups chunks into ~2-3 sentence semantic blocks
  5. LLM Extraction - Gemini API with exact system prompt, JSON parsing, retry logic
  6. Pipeline Orchestrator - Idempotent flow with logging and error handling
  7. API Endpoint - POST /api/ingest/channel with API key auth and rate limiting
  8. Tests - 28 passing tests for segmentation and JSON parsing

  To Get Started

  1. Copy .env.example to .env and fill in:
    - DATABASE_URL - PostgreSQL connection string
    - YOUTUBE_API_KEY - YouTube Data API v3 key
    - GEMINI_API_KEY - Google Gemini API key
    - INGEST_API_KEY - Secret key for API protection
  2. Run database migration:
  cd frontend && npm run db:migrate
  3. Start the dev server and call the API:
  curl -X POST http://localhost:3000/api/ingest/channel \
    -H "Content-Type: application/json" \
    -H "x-api-key: your-secret-key" \
    -d '{"channelId": "UCXXXX"}'