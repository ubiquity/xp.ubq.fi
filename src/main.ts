import { getRunIdFromQuery } from "./utils";
import { renderLeaderboardChart } from "./visualization/leaderboard-chart";
import { renderTimeSeriesChart } from "./visualization/time-series-chart";
import { loadArtifactData, cleanupWorker } from "./workers/artifact-worker-manager";
import type { LeaderboardEntry, TimeSeriesEntry } from "./data-transform";

type ViewMode = "leaderboard" | "timeseries";

// Set up loading overlay
const loadingOverlay = document.createElement("div");
loadingOverlay.style.cssText = `
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(24, 26, 27, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #00e0ff;
  font-size: 16px;
  z-index: 1000;
`;

const progressText = document.createElement("div");
progressText.style.marginTop = "16px";
loadingOverlay.appendChild(progressText);

async function init() {
  try {
    const runId = getRunIdFromQuery();
    if (!runId) {
      console.error("No run ID found in URL");
      return;
    }

    // --- State and Data ---
    let leaderboardData: LeaderboardEntry[] = [];
    let timeSeriesData: TimeSeriesEntry[] = [];
    let viewMode: ViewMode = "leaderboard";
    let selectedContributor: string = "All";
    let timeRangePercent: number = 100;

    // --- UI Elements ---
    const root = document.getElementById("xp-analytics-root")!;
    const chartArea = document.getElementById("xp-analytics-chart-area")!;
    const contributorSelect = document.getElementById("contributor-select") as HTMLSelectElement;
    const viewToggle = document.getElementById("view-toggle") as HTMLButtonElement;
    const timeRange = document.getElementById("time-range") as HTMLInputElement;

    // --- Render function ---
    function render() {
      chartArea.innerHTML = "";
      if (viewMode === "leaderboard") {
        // Filter leaderboard data by contributor if not "All"
        const filtered = selectedContributor === "All"
          ? leaderboardData
          : leaderboardData.filter((entry) => entry.contributor === selectedContributor);

        renderLeaderboardChart(filtered, chartArea, {
          width: 720,
          height: Math.max(200, filtered.length * 32 + 64),
          highlightContributor: selectedContributor !== "All" ? selectedContributor : leaderboardData[0]?.contributor,
        });
      } else {
        // Filter time series data by contributor if not "All"
        let filtered = selectedContributor === "All"
          ? timeSeriesData
          : timeSeriesData.filter((entry) => entry.contributor === selectedContributor);

        // Apply time range filter (show only up to N% of the timeline)
        if (filtered.length > 0 && timeRangePercent < 100) {
          filtered = filtered.map((entry) => {
            const cutoff = Math.floor((entry.series.length * timeRangePercent) / 100);
            return {
              ...entry,
              series: entry.series.slice(0, Math.max(1, cutoff)),
            };
          });
        }

        renderTimeSeriesChart(filtered, chartArea, {
          width: 720,
          height: 320,
          highlightContributor: selectedContributor !== "All" ? selectedContributor : timeSeriesData[0]?.contributor,
        });
      }
      // Update toggle button label
      viewToggle.textContent = viewMode === "leaderboard" ? "Leaderboard" : "Time Series";
    }

    // --- Initialize UI with data ---
    function initializeUI() {
      const allContributors = Array.from(
        new Set([
          ...leaderboardData.map((entry) => entry.contributor),
          ...timeSeriesData.map((entry) => entry.contributor),
        ])
      ).sort((a, b) => a.localeCompare(b));
      contributorSelect.innerHTML = "";
      const allOption = document.createElement("option");
      allOption.value = "All";
      allOption.textContent = "All Contributors";
      contributorSelect.appendChild(allOption);
      allContributors.forEach((contributor) => {
        const opt = document.createElement("option");
        opt.value = contributor;
        opt.textContent = contributor;
        contributorSelect.appendChild(opt);
      });

      render(); // Initial render
    }

    // --- Event listeners ---
    contributorSelect.addEventListener("change", (e) => {
      selectedContributor = contributorSelect.value;
      render();
    });

    viewToggle.addEventListener("click", () => {
      viewMode = viewMode === "leaderboard" ? "timeseries" : "leaderboard";
      render();
    });

    timeRange.addEventListener("input", () => {
      timeRangePercent = parseInt(timeRange.value, 10);
      render();
    });

    // Show loading overlay
    root.style.position = "relative";
    root.appendChild(loadingOverlay);

    // --- Load Data ---
    await loadArtifactData(runId, {
      onProgress: (phase, percent, detail) => {
        progressText.textContent = `${phase}: ${Math.round(percent)}%${detail ? ` - ${detail}` : ""}`;
      },
      onError: (error) => {
        console.error(error);
        progressText.textContent = `Error: ${error.message}`;
        progressText.style.color = "#ff2d2d";
      },
      onComplete: (data) => {
        // Remove loading overlay
        loadingOverlay.remove();

        // Update data
        leaderboardData = data.leaderboard;
        timeSeriesData = data.timeSeries;

        // Make data available for debugging
        (window as any).analyticsData = data;
        console.log(
          "%c✨ Developer Note: Access all analytics data via window.analyticsData",
          "color: #00e0ff; font-weight: bold;"
        );
        console.log("Leaderboard Data:", leaderboardData);
        console.log("Time Series Data:", timeSeriesData);

        // Initialize UI with data
        initializeUI();
      }
    });


    // Clean up on unload
    window.addEventListener("unload", cleanupWorker);
  } catch (error) {
    console.error(error);
  }
}

init();
