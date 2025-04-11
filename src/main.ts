import { getUsableArtifacts } from "./artifact-data";
import { getRunIdFromQuery, groupArtifactsByOrgRepoIssue } from "./utils";
import { getLeaderboardData, getTimeSeriesData } from "./data-transform";
import { renderLeaderboardChart } from "./visualization/leaderboard-chart";
import { renderTimeSeriesChart } from "./visualization/time-series-chart";

type ViewMode = "leaderboard" | "timeseries";

async function init() {
  try {
    const runId = getRunIdFromQuery();
    if (!runId) {
      console.error("No run ID found in URL");
      return;
    }

    // Get usable artifacts as a plain JS object
    const artifacts = await getUsableArtifacts(
      runId,
      (phase: string, percent: number, detail?: string) => {
        console.log(
          `${phase}: ${Math.round(percent)}%${detail ? ` - ${detail}` : ""}`
        );
      },
      (error: Error) => {
        console.error(error);
      }
    );

    // Make data available globally for debugging
    (window as any).artifactsData = artifacts;

    // --- Data transformation ---
    // Log artifact keys to debug grouping
    console.log("Artifact keys:", Object.keys(artifacts));
    // Group flat artifacts into org -> repo -> issue/pr -> contributor structure
    const groupedArtifacts = groupArtifactsByOrgRepoIssue(artifacts);
    console.log("Grouped Artifacts:", groupedArtifacts);
    // The groupedArtifacts object is: { [org]: { [repo]: { [issue]: { [contributor]: ContributorAnalytics } } } }
    const leaderboardData = getLeaderboardData(groupedArtifacts);
    const timeSeriesData = getTimeSeriesData(groupedArtifacts);
    console.log("Leaderboard Data:", leaderboardData);
    console.log("Time Series Data:", timeSeriesData);

    // --- UI Elements ---
    const chartArea = document.getElementById("xp-analytics-chart-area")!;
    const contributorSelect = document.getElementById("contributor-select") as HTMLSelectElement;
    const viewToggle = document.getElementById("view-toggle") as HTMLButtonElement;
    const timeRange = document.getElementById("time-range") as HTMLInputElement;

    // --- State ---
    let viewMode: ViewMode = "leaderboard";
    let selectedContributor: string = "All";
    let timeRangePercent: number = 100;

    // --- Populate contributor dropdown ---
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

    // --- Initial render ---
    render();

    // Developer note
    console.log(
      "%c✨ Developer Note: Access all artifacts data via window.artifactsData",
      "color: #00c853; font-weight: bold;"
    );
  } catch (error) {
    console.error(error);
  }
}

init();
