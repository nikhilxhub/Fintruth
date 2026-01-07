

📊 Finfluencer Accuracy Leaderboard (India)
Project Documentation

1. Project Overview
Project Name
Finfluencer Accuracy Leaderboard (India)
Project Type
AI-powered finance analytics & public accountability platform
Inspiration
Inspired by projects like Alpha Arena (nof1.ai), but focused on Indian finance YouTubers and long-term prediction accuracy instead of short-term alpha calls.

2. Problem Statement
In India, finance YouTubers and influencers (finfluencers) regularly publish market predictions and macroeconomic opinions such as:
Stock market direction predictions
Index level expectations (NIFTY, SENSEX)
Sectoral outlooks
Asset allocation advice (equity vs gold vs real estate)
These predictions influence millions of retail investors, yet:
There is no systematic tracking of prediction accuracy
Creators highlight successful calls and ignore failed ones
Viewers lack an objective way to judge long-term credibility
Core Problem
There is no transparent, data-driven system to evaluate how accurate these finfluencers actually are over time.

3. Project Objective
To build a public, neutral, evidence-based leaderboard that:
Extracts financial predictions from YouTube videos
Compares predictions against real market outcomes
Scores prediction accuracy objectively
Ranks finfluencers based on historical performance
This platform does not provide investment advice and focuses only on retrospective analysis.

4. Target Audience
Primary Users
Retail investors
Finance learners
Analysts and researchers
Secondary Users
Finfluencers themselves
Journalists and media
Fintech communities

5. Initial Creator Scope
Examples of creators to include initially:
Akshat Shrivastava
Ankur Warikoo
CA Rachana Ranade
Pranjal Kamra
Asset Yogi
The platform is creator-agnostic and expandable.

6. Key Insight
Finance videos often contain implicit or explicit predictions, such as:
“Markets will correct soon”
“Gold will outperform equities”
“This stock will struggle in the next year”
These statements can be:
Extracted from transcripts
Evaluated after sufficient time passes
Compared against factual market data
This enables objective scoring.

7. High-Level System Architecture

Current Implementation (Phase 1 - Ingestion Pipeline):
YouTube API
   ↓
Video Metadata & Transcripts
   ↓
Transcript Segmentation
   ↓
Prediction Extraction (LLM)
   ↓
Prediction Storage

Planned Implementation (Phase 2):
   ↓
Market Outcome Retrieval
   ↓
Prediction Evaluation (LLM)
   ↓
Scoring Engine
   ↓
Leaderboard & Creator Pages


8. Technology Stack
Frontend
Next.js (App Router)
TypeScript
Tailwind CSS
shadcn/ui
Recharts (data visualization)
Backend
Node.js (via Next.js API routes or separate service)
Prisma ORM
PostgreSQL
AI & Data Services
YouTube Data API
YouTube Transcript API
Gemini API (free tier)
Exa AI or similar search-based retrieval
Yahoo Finance / NSE data (fallback)

9. Functional Requirements
9.1 Creator Management
Store creator metadata
Map YouTube channel to creator profile
Aggregate scores per creator
9.2 Video Ingestion
Fetch videos from YouTube channels
Filter finance/market-related videos
Store metadata (title, URL, publish date)
9.3 Transcript Processing
Fetch full video transcript
Segment transcript by timestamps
Store transcript blocks
9.4 Prediction Extraction (IMPLEMENTED)
Identify prediction statements using AI
Extract:
- Claim (required)
- Asset / market (optional)
- Time horizon in months (optional)
- Confidence level: low, medium, or high (required, defaults to medium)
- Prediction type: price, direction, relative performance, or macro (required, defaults to direction)
- Links predictions to transcript chunks and videos
9.5 Outcome Evaluation (Planned - Phase 2)
Fetch real market data after prediction horizon
Compare predicted vs actual outcomes
Generate natural-language explanation
9.6 Scoring System (Planned - Phase 2)
Assign numerical accuracy scores
Aggregate per video and creator
9.7 API Endpoints (IMPLEMENTED)
POST /api/ingest/channel
- Triggers full ingestion pipeline for a YouTube channel
- Requires API key authentication (x-api-key header)
- Rate limited: 5 requests per minute per IP
- Request body: { "channelId": "UCXXXX", "options": {...} }
- Options: maxVideos, skipVideoFetch, skipTranscriptFetch, skipPredictionExtraction
- Returns pipeline execution results with stage-by-stage statistics

GET /api/ingest/channel?channelId=UCXXXX
- Check if pipeline is currently running for a channel
- Returns: { channelId, isRunning, message }

9.8 Frontend Display
Public leaderboard (UI implemented, using mock data)
Creator detail pages (Planned - Phase 2)
Prediction-level breakdown (Planned - Phase 2)

10. Database Design (Prisma)
Creator Table
model Creator {
  id            String   @id @default(uuid())
  name          String
  channelId     String   @unique
  youtubeHandle String?
  avatarUrl     String?
  createdAt     DateTime @default(now())

  videos        Video[]

  @@index([channelId])
}


Video Table
model Video {
  id                 String            @id // YouTube video ID
  creatorId          String
  title              String
  description        String?
  url                String
  publishedAt        DateTime
  transcriptFetched  Boolean           @default(false)
  predictionsExtracted Boolean         @default(false)
  createdAt          DateTime          @default(now())

  creator            Creator           @relation(fields: [creatorId], references: [id], onDelete: Cascade)
  transcriptChunks   TranscriptChunk[]
  predictions        Prediction[]

  @@index([creatorId])
  @@index([publishedAt])
}


TranscriptChunk Table
model TranscriptChunk {
  id          String       @id @default(uuid())
  videoId     String
  text        String
  startTime   Float        // seconds
  createdAt   DateTime     @default(now())

  video       Video        @relation(fields: [videoId], references: [id], onDelete: Cascade)
  predictions Prediction[]

  @@index([videoId])
  @@index([startTime])
}


Prediction Table
model Prediction {
  id                String   @id @default(uuid())
  videoId           String
  transcriptChunkId String
  timestamp         Float    // seconds from video start
  transcriptText    String   // original transcript text
  predictedClaim    String
  asset             String?
  horizonMonths     Int?
  confidence        String   // low, medium, high
  predictionType    String   // price, direction, relative performance, macro
  createdAt         DateTime @default(now())

  video             Video           @relation(fields: [videoId], references: [id], onDelete: Cascade)
  transcriptChunk   TranscriptChunk @relation(fields: [transcriptChunkId], references: [id], onDelete: Cascade)

  @@index([videoId])
  @@index([asset])
  @@index([predictionType])
  @@index([createdAt])
}


Note: Outcome and CreatorScore tables are planned for future implementation (Phase 2) when prediction evaluation and scoring features are added.


11. AI Processing Pipeline

Current Implementation (Phase 1):

Step 1: Video Ingestion
- Fetch videos from YouTube Data API v3
- Filter finance-related videos using keywords (market, stock, invest, economy)
- Store video metadata (title, description, URL, publish date)
- Create/update Creator records

Step 2: Transcript Fetching
- Fetch full video transcripts using youtube-transcript library
- Store transcript chunks with timestamps
- Mark videos as transcriptFetched

Step 3: Transcript Segmentation
- Group transcript chunks into semantic blocks (~2-3 sentences)
- Each block represents a coherent segment of speech
- Blocks are used for prediction extraction

Step 4: Prediction Extraction (Gemini)
- Process each transcript block using Gemini 1.5 Flash
- Extract explicit or implicit future-oriented financial predictions
- Output structure:
  {
    "claim": "NIFTY will fall 15% in 2023",
    "asset": "NIFTY50" | null,
    "horizonMonths": 12 | null,
    "confidence": "low" | "medium" | "high",
    "predictionType": "price" | "direction" | "relative performance" | "macro"
  }
- Store predictions linked to video and transcript chunk
- Mark videos as predictionsExtracted

Planned Implementation (Phase 2):

Step 5: Market Outcome Retrieval
- Search historical market performance
- Store:
  - Price movement
  - Time period
  - Key events

Step 6: Prediction Evaluation (Gemini)
- Evaluation Prompt:
  - Compare claim vs reality
  - Generate explanation
  - Score accuracy between 0.0 – 1.0

12. Scoring Methodology
Prediction-Level Score
Factors:
Direction correctness
Magnitude closeness
Time horizon match
Clarity of prediction
Example:
Direction correct
Magnitude partially correct
Horizon correct
Final Score: 0.70

Creator-Level Score
Weighted average of:
Prediction accuracy
Confidence
Time horizon
Recency

13. Frontend Pages

Current Implementation:
/leaderboard
- UI implemented with mock data
- Displays: Rank, Creator name, Overall accuracy %, Total predictions evaluated
- Note: Currently shows placeholder data; will be connected to database in Phase 2

Planned Implementation (Phase 2):
/creator/[slug]
- Creator profile
- Accuracy trend chart
- List of predictions:
  - Video link
  - Timestamp
  - Prediction
  - Outcome
  - Score
/methodology
- Explanation of system
- Scoring logic
- AI limitations

14. Cron Jobs & Automation

Current Implementation:
- Manual API endpoint: POST /api/ingest/channel
- Rate limiting: 5 requests per minute per IP
- API key authentication via INGEST_API_KEY

Planned Implementation (Phase 2):
- Daily video ingestion (automated)
- Weekly prediction extraction (automated)
- Monthly re-evaluation for long horizons
- Score recalculation

15. Legal & Ethical Considerations
Mandatory Disclaimers
Not investment advice
Retrospective analysis only
AI-generated evaluations
Ethical Rules
No mocking or defamatory language
Evidence-backed explanations only
Transparent methodology

16. MVP Scope

Phase 1 (Current Implementation - COMPLETED)
✅ Database schema with 4 models (Creator, Video, TranscriptChunk, Prediction)
✅ YouTube video ingestion via API
✅ Transcript fetching and segmentation
✅ Prediction extraction using Gemini API
✅ API endpoint with authentication and rate limiting
✅ Pipeline orchestrator with idempotent flow
✅ Test coverage for core functionality

Phase 2 (Planned - NOT YET IMPLEMENTED)
⏳ Outcome evaluation system
⏳ Scoring engine
⏳ CreatorScore aggregation
⏳ Frontend integration with real data
⏳ Fully automated pipeline
⏳ Public launch
⏳ Community feedback

17. Future Enhancements
Stock-level accuracy
Bull vs Bear bias score
Confidence vs accuracy visualization
Creator verification & response feature

18. Conclusion
This project introduces accountability and transparency into Indian finance content using AI + data + objective scoring.
It empowers users to judge credibility based on history, not hype.

