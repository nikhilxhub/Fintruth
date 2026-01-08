"use client";

import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";

interface LeaderboardItem {
  rank: number;
  creatorId: string;
  channelId: string;
  name: string;
  youtubeHandle: string | null;
  avatarUrl: string | null;
  totalVideos: number;
  videosWithTranscripts: number;
  videosWithPredictions: number;
  totalPredictions: number;
  createdAt: string;
}

export default function Leaderboard() {
  const [data, setData] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setLoading(true);
        const response = await fetch("/api/leaderboard");
        const result = await response.json();

        if (result.success) {
          setData(result.data);
        } else {
          setError(result.message || "Failed to load leaderboard");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <NavBar />
      <div className="pt-16 md:pt-20">
        <div className="container mx-auto px-4 py-12 max-w-7xl">
          {/* Title */}
          <h1 className="text-5xl md:text-6xl font-bold mb-4 tracking-tight">
            LEADERBOARD
          </h1>
          
          {/* Info Note */}
          <p className="text-[#a0a0a0] mb-8 text-sm">
            Ranked by total predictions extracted. Accuracy scoring coming in Phase 2.
          </p>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <p className="text-[#a0a0a0]">Loading leaderboard...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 mb-8">
              <p className="text-red-400">Error: {error}</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && data.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[#a0a0a0] text-lg mb-4">
                No data available yet.
              </p>
              <p className="text-[#666] text-sm">
                Start ingesting channels to see them appear here.
              </p>
            </div>
          )}

          {/* Table Container */}
          {!loading && !error && data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#2a2a2a]">
                    <th className="text-left py-4 px-6 text-sm font-semibold text-[#a0a0a0] uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-[#a0a0a0] uppercase tracking-wider">
                      Creator Name
                    </th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-[#a0a0a0] uppercase tracking-wider">
                      Total Videos
                    </th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-[#a0a0a0] uppercase tracking-wider">
                      Videos Processed
                    </th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-[#a0a0a0] uppercase tracking-wider">
                      Total Predictions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item) => (
                    <tr
                      key={item.creatorId}
                      className="border-b border-[#1a1a1a] hover:bg-[#141414] transition-colors"
                    >
                      <td className="py-5 px-6 text-base font-medium text-white">
                        {item.rank}
                      </td>
                      <td className="py-5 px-6 text-base text-white">
                        <div className="flex items-center gap-3">
                          {item.avatarUrl && (
                            <img
                              src={item.avatarUrl}
                              alt={item.name}
                              className="w-10 h-10 rounded-full"
                            />
                          )}
                          <div>
                            <div className="font-medium">{item.name}</div>
                            {item.youtubeHandle && (
                              <div className="text-sm text-[#a0a0a0]">
                                @{item.youtubeHandle.replace('@', '')}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-6 text-right text-base text-[#d0d0d0]">
                        {item.totalVideos.toLocaleString()}
                      </td>
                      <td className="py-5 px-6 text-right text-base text-[#d0d0d0]">
                        <span className="text-green-400">
                          {item.videosWithPredictions}
                        </span>
                        <span className="text-[#666] mx-1">/</span>
                        <span className="text-[#a0a0a0]">
                          {item.videosWithTranscripts}
                        </span>
                      </td>
                      <td className="py-5 px-6 text-right text-base font-medium text-green-400">
                        {item.totalPredictions.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}