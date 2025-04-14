import "./components/dev-mode-widget";
import type { LeaderboardEntry, TimeSeriesEntry } from "./data-transform";
import { cubicBezier, getRunIdFromQuery, isProduction } from "./utils";
import { renderLeaderboardChart } from "./visualization/leaderboard-chart";
import { renderTimeSeriesChart } from "./visualization/time-series-chart";
import { cleanupWorker, loadArtifactData } from "./workers/artifact-worker-manager";

type ViewMode = "leaderboard" | "timeseries";

// Set up loading overlay
const loadingOverlay = document.createElement("div");
loadingOverlay.className = "loading-overlay";

const progressText = document.createElement("div");
progressText.className = "loading-overlay-progress";
loadingOverlay.appendChild(progressText);

async function init() {
  try {
    // Initialize dev mode widget
    // (No longer needed: widget is instantiated via <dev-mode-widget> in HTML)

    const runId = getRunIdFromQuery();
    if (!runId) {
      if (!isProduction()) {
        const root = document.getElementById("xp-analytics-root")!;
        root.innerHTML = `
          <div class="dev-mode-message">
            <div>
              <h2>Development Mode</h2>
              <p>Select a run from the widget in the bottom right corner</p>
            </div>
          </div>
        `;
      } else {
        console.error("No run ID found in URL");
      }
      return;
    }

    // --- State and Data ---
    let leaderboardData: LeaderboardEntry[] = [];
    let timeSeriesData: TimeSeriesEntry[] = [];
    let viewMode: ViewMode = "leaderboard";
    let selectedContributor: string = "All";
    let timeRangePercent: number = 100;
    let maxYValue: number = 1;
    // let finalScores: { [contributor: string]: number } = {}; // Replaced by ranks
    let ranks: { [contributor: string]: number } = {};
    let highestScorer: string | null = null;
    let globalMinTime: number | null = null;
    let globalMaxTime: number | null = null;

    // --- UI Elements ---
    const root = document.getElementById("xp-analytics-root")!;
    const chartArea = document.getElementById("xp-analytics-chart-area")!;
    const contributorSelect = document.getElementById("contributor-select") as HTMLSelectElement;
    const viewToggle = document.getElementById("view-toggle") as HTMLButtonElement;
    const timeRange = document.getElementById("time-range") as HTMLInputElement;

    // --- Render function ---
    function render() {
      chartArea.innerHTML = "";
      const timeRangeLabel = document.getElementById("time-range-label") as HTMLSpanElement;
      let timeRangeText = "";

      if (viewMode === "leaderboard") {
        // Filter leaderboard data by contributor if not "All"
        const filtered = selectedContributor === "All"
          ? leaderboardData
          : leaderboardData.filter((entry) => entry.contributor === selectedContributor);

        renderLeaderboardChart(filtered, chartArea, {
          height: Math.max(200, filtered.length * 32 + 64),
          highlightContributor: selectedContributor !== "All" ? selectedContributor : leaderboardData[0]?.contributor,
        });
        timeRangeText = "";
      } else {
        // Filter time series data by contributor if not "All"
        let filtered = selectedContributor === "All"
          ? timeSeriesData
          : timeSeriesData.filter((entry) => entry.contributor === selectedContributor);

        // Apply time range filter based on absolute time
        if (filtered.length > 0 && timeRangePercent < 100 && globalMinTime !== null && globalMaxTime !== null) {
          const timeRangeDuration = globalMaxTime - globalMinTime;
          const cutoffTime = globalMinTime + timeRangeDuration * (timeRangePercent / 100);

          filtered = filtered.map((entry) => {
            // Filter points up to the cutoff time
            const timeFilteredSeries = entry.series.filter(pt => new Date(pt.time).getTime() <= cutoffTime);

            // Ensure at least one point remains if original series had points and cutoffTime is past the first point's time
            if (entry.series.length > 0 && timeFilteredSeries.length === 0) {
               const firstPointTime = new Date(entry.series[0].time).getTime();
               if (cutoffTime >= firstPointTime) {
                 return { ...entry, series: entry.series.slice(0, 1) };
               } else {
                 // If cutoff is before the first point, return empty series for this entry
                 return { ...entry, series: [] };
               }
            }
            return { ...entry, series: timeFilteredSeries };
          }).filter(entry => entry.series.length > 0); // Remove entries with no points within the time range
        }

        renderTimeSeriesChart(filtered, chartArea, {
          // width: 720,
          height: 320,
          highlightContributor: selectedContributor !== "All" ? selectedContributor : (highestScorer ?? undefined), // Use highest scorer if "All", pass undefined if null
          maxYValue: maxYValue,
          timeRangePercent: timeRangePercent,
          ranks: ranks, // Pass ranks for opacity calculation
          minTime: globalMinTime, // Pass fixed min time
          maxTime: globalMaxTime, // Pass fixed max time
          animationProgress: timeRangePercent / 100 // Pass animation progress (0-1)
        });

        // --- Human-readable time range label ---
        // Find min and max timestamps in the filtered data
        const allTimestamps: number[] = [];
        filtered.forEach(entry => {
          entry.series.forEach(pt => {
            allTimestamps.push(new Date(pt.time).getTime());
          });
        });
        if (allTimestamps.length > 0) {
          const min = Math.min(...allTimestamps);
          const max = Math.max(...allTimestamps);
          const format = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
          timeRangeText = `${format(new Date(min))} — ${format(new Date(max))}`;
        } else {
          timeRangeText = "";
        }
      }
      // Update time range label
      if (timeRangeLabel) {
        timeRangeLabel.textContent = timeRangeText;
      }
      // Update toggle button label
      viewToggle.textContent = viewMode === "leaderboard" ? "Leaderboard" : "Time Series";
    }

    function animateTimeline() {
      const startTime = performance.now();
      const duration = 2500; // 2.5 seconds

      let animationComplete = false; // Flag to stop passing progress after animation

      function animate(currentTime: number) {
        if (animationComplete) return; // Stop animation loop if complete

        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Apply ease-in-out easing (cubic-bezier(0.42, 0, 0.58, 1))
        const eased = cubicBezier(0.42, 0, 0.58, 1, progress);

        timeRangePercent = eased * 100;
        timeRange.value = String(Math.floor(timeRangePercent));
        render(); // Render will now use timeRangePercent / 100 as animationProgress

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      }

      requestAnimationFrame(animate);

      // Set flag when animation should be done
      setTimeout(() => {
        animationComplete = true;
        // Optional: Final render at 100% without animation progress
        // timeRangePercent = 100;
        // render();
      }, duration);
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

      // Calculate initial max Y value if not set
      if (maxYValue === 1) {
        timeSeriesData.forEach(entry => {
          let cumulative = 0;
          entry.series.forEach(pt => {
            cumulative += pt.xp;
            if (cumulative > maxYValue) maxYValue = cumulative;
          });
        });
      }

      // Calculate ranks based on leaderboard totalXP for consistency
      const scoresArray: [string, number][] = leaderboardData.map(entry => {
        return [entry.contributor, entry.totalXP];
      });

      scoresArray.sort(([, scoreA], [, scoreB]) => scoreB - scoreA); // Sort descending by score

      ranks = {};
      highestScorer = scoresArray.length > 0 ? scoresArray[0][0] : null;
      scoresArray.forEach(([contributor], index) => {
        ranks[contributor] = index + 1; // Rank starts at 1
      });

      // Calculate global time range from full dataset
      const allTimestampsFull: number[] = timeSeriesData.flatMap(entry =>
        entry.series.map(pt => new Date(pt.time).getTime())
      );
      if (allTimestampsFull.length > 0) {
        globalMinTime = Math.min(...allTimestampsFull);
        globalMaxTime = Math.max(...allTimestampsFull);
      } else {
        globalMinTime = null;
        globalMaxTime = null;
      }


      // Set to timeseries view and render
      viewMode = "timeseries";
      render();

      // Store max height and fix it
      chartArea.style.height = `${chartArea.offsetHeight}px`;

      // Start animation from beginning
      timeRangePercent = 0;
      timeRange.value = "0";
      animateTimeline();
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
        progressText.classList.remove("error");
      },
      onError: (error) => {
        console.error(error);
        progressText.textContent = `Error: ${error.message}`;
        progressText.classList.add("error");
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
