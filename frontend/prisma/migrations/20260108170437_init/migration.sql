-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "youtubeHandle" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "transcriptFetched" BOOLEAN NOT NULL DEFAULT false,
    "predictionsExtracted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptChunk" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "startTime" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "transcriptChunkId" TEXT NOT NULL,
    "timestamp" DOUBLE PRECISION NOT NULL,
    "transcriptText" TEXT NOT NULL,
    "predictedClaim" TEXT NOT NULL,
    "asset" TEXT,
    "horizonMonths" INTEGER,
    "confidence" TEXT NOT NULL,
    "predictionType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Creator_channelId_key" ON "Creator"("channelId");

-- CreateIndex
CREATE INDEX "Creator_channelId_idx" ON "Creator"("channelId");

-- CreateIndex
CREATE INDEX "Video_creatorId_idx" ON "Video"("creatorId");

-- CreateIndex
CREATE INDEX "Video_publishedAt_idx" ON "Video"("publishedAt");

-- CreateIndex
CREATE INDEX "TranscriptChunk_videoId_idx" ON "TranscriptChunk"("videoId");

-- CreateIndex
CREATE INDEX "TranscriptChunk_startTime_idx" ON "TranscriptChunk"("startTime");

-- CreateIndex
CREATE INDEX "Prediction_videoId_idx" ON "Prediction"("videoId");

-- CreateIndex
CREATE INDEX "Prediction_asset_idx" ON "Prediction"("asset");

-- CreateIndex
CREATE INDEX "Prediction_predictionType_idx" ON "Prediction"("predictionType");

-- CreateIndex
CREATE INDEX "Prediction_createdAt_idx" ON "Prediction"("createdAt");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptChunk" ADD CONSTRAINT "TranscriptChunk_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_transcriptChunkId_fkey" FOREIGN KEY ("transcriptChunkId") REFERENCES "TranscriptChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
