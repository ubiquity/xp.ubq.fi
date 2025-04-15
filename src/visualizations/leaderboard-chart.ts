import type { LeaderboardEntry } from '../data-transform';

interface LeaderboardChartProps {
  data: LeaderboardEntry[]; // Expects pre-sorted data
  className?: string;
  // Config might be needed later for options like row limits, etc.
  // config: ChartConfig;
}

/**
 * Renders a simple leaderboard table into a container element.
 * @param container - The HTMLElement to render the table into.
 * @param props - The properties for the leaderboard chart.
 */
export function renderLeaderboardChart(container: HTMLElement, props: LeaderboardChartProps): void {
  const {
    data,
    className = ''
  } = props;

  // Clear previous content
  container.innerHTML = '';
  container.className = `leaderboard-chart ${className}`;

  if (!data || data.length === 0) {
    container.textContent = 'No leaderboard data available.';
    container.classList.add('empty');
    return;
  }

  // Data is assumed to be sorted by totalXP descending by getLeaderboardData

  const table = document.createElement('table');

  // Table Header
  const thead = table.createTHead();
  const headerRow = thead.insertRow();
  const thRank = document.createElement('th');
  thRank.textContent = 'Rank';
  headerRow.appendChild(thRank);
  const thContributor = document.createElement('th');
  thContributor.textContent = 'Contributor';
  headerRow.appendChild(thContributor);
  const thXp = document.createElement('th');
  thXp.textContent = 'Total XP';
  headerRow.appendChild(thXp);
  // Add more header cells if needed

  // Table Body
  const tbody = table.createTBody();
  data.forEach((entry, index) => {
    const row = tbody.insertRow();

    const cellRank = row.insertCell();
    cellRank.textContent = (index + 1).toString();

    const cellContributor = row.insertCell();
    cellContributor.textContent = entry.contributor;

    const cellXp = row.insertCell();
    cellXp.textContent = entry.totalXP.toFixed(2); // Format XP

    // Add more cells if needed
  });

  container.appendChild(table);
}
