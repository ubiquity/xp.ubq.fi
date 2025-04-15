import React from 'react';
import type { LeaderboardEntry } from '../data-transform';

interface LeaderboardChartProps {
  data: LeaderboardEntry[]; // Expects pre-sorted data
  className?: string;
  // Config might be needed later for options like row limits, etc.
  // config: ChartConfig;
}

/**
 * Renders a simple leaderboard table from pre-sorted LeaderboardEntry data.
 */
const LeaderboardChart: React.FC<LeaderboardChartProps> = ({
  data,
  className = ''
}) => {

  if (!data || data.length === 0) {
    return <div className={`leaderboard-chart empty ${className}`}>No leaderboard data available.</div>;
  }

  // Data is assumed to be sorted by totalXP descending by getLeaderboardData

  return (
    <div className={`leaderboard-chart ${className}`}>
      {/* We might add a title from config later */}
      {/* <h2>Leaderboard</h2> */}
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Contributor</th>
            <th>Total XP</th>
            {/* Add more columns if needed, e.g., breakdown by repo */}
          </tr>
        </thead>
        <tbody>
          {data.map((entry, index) => (
            <tr key={entry.userId || entry.contributor}>
              <td>{index + 1}</td>
              <td>{entry.contributor}</td>
              <td>{entry.totalXP.toFixed(2)}</td> {/* Format XP */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LeaderboardChart;
