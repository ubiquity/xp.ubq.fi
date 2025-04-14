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

const MS_PER_MINUTE = 60 * 1000;

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
    let currentTimeValue: number = 0; // Current slider value (minutes since epoch)
    let maxYValue: number = 1;
    let ranks: { [contributor: string]: number } = {};
    let highestScorer: string | null = null;
    let globalMinTimeMs: number | null = null; // In milliseconds
    let globalMaxTimeMs: number | null = null; // In milliseconds
    let globalMinTimeMins: number = 0; // In minutes since epoch
    let globalMaxTimeMins: number = 0; // In minutes since epoch
    let isAnimating: boolean = false; // Flag to control fade-in

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
        timeRangeText = ""; // No time range label for leaderboard
      } else {
        // Filter time series data by contributor if not "All"
        let filtered = selectedContributor === "All"
          ? timeSeriesData
          : timeSeriesData.filter((entry) => entry.contributor === selectedContributor);

        // Calculate cutoff time based on slider value, but don't filter data here
        let cutoffTimeMs: number | undefined = undefined;
        if (globalMinTimeMs !== null && globalMaxTimeMs !== null) {
           cutoffTimeMs = currentTimeValue * MS_PER_MINUTE;
           // Ensure cutoff doesn't exceed max time (can happen due to rounding/ceil)
            cutoffTimeMs = Math.min(cutoffTimeMs, globalMaxTimeMs);
         }
         // Filtering is now handled within renderTimeSeriesChart based on cutoffTimeMs

         // Calculate animation progress only if animating
        const animationProgress = isAnimating && globalMaxTimeMins > globalMinTimeMins
          ? (currentTimeValue - globalMinTimeMins) / (globalMaxTimeMins - globalMinTimeMins)
          : 1; // Default to 1 (no fade) if not animating or range is zero

        renderTimeSeriesChart(filtered, chartArea, {
          height: 320,
          highlightContributor: selectedContributor !== "All" ? selectedContributor : (highestScorer ?? undefined),
          maxYValue: maxYValue,
          ranks: ranks,
          minTime: globalMinTimeMs, // Pass fixed min/max time in MS
          maxTime: globalMaxTimeMs,
          animationProgress: animationProgress, // Pass animation progress (0-1)
          cutoffTimeMs: cutoffTimeMs // Pass the calculated cutoff time
        });

        // --- Human-readable time range label ---
        // Display current time based on slider value
        if (globalMinTimeMs !== null) {
           const currentDisplayTimeMs = currentTimeValue * MS_PER_MINUTE;
           const format = (d: Date) =>
             `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
           timeRangeText = `Up to: ${format(new Date(currentDisplayTimeMs))}`;
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
      isAnimating = true; // Start animation fade-in
      const startTime = performance.now();
      const duration = 2500; // 2.5 seconds
      const startValue = globalMinTimeMins;
      const endValue = globalMaxTimeMins;
      const range = endValue - startValue;

      function animate(currentTime: number) {
        const elapsed = currentTime - startTime;
        let progress = Math.min(elapsed / duration, 1);

        // Apply ease-in-out easing (cubic-bezier(0.42, 0, 0.58, 1))
        const easedProgress = cubicBezier(0.42, 0, 0.58, 1, progress);

        currentTimeValue = startValue + range * easedProgress;
        timeRange.value = String(currentTimeValue); // Update slider position
        render();

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          isAnimating = false; // Animation finished, stop fade-in effect
          // Ensure final state is exactly the max time
          currentTimeValue = globalMaxTimeMins;
          timeRange.value = String(currentTimeValue);
          render(); // Final render at 100%
        }
      }

      requestAnimationFrame(animate);
    }

    // --- Initialize UI with data ---
    function initializeUI() {
      // --- Contributor Select Dropdown ---
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

      // --- Calculate Max Y Value ---
      if (maxYValue === 1) { // Only calculate once
        timeSeriesData.forEach(entry => {
          let cumulative = 0;
          entry.series.forEach(pt => {
            cumulative += pt.xp;
            if (cumulative > maxYValue) maxYValue = cumulative;
          });
        });
      }

      // --- Calculate Ranks ---
      const scoresArray: [string, number][] = leaderboardData.map(entry => {
        return [entry.contributor, entry.totalXP];
      });
      scoresArray.sort(([, scoreA], [, scoreB]) => scoreB - scoreA);
      ranks = {};
      highestScorer = scoresArray.length > 0 ? scoresArray[0][0] : null;
      scoresArray.forEach(([contributor], index) => {
        ranks[contributor] = index + 1;
      });

      // --- Calculate Global Time Range and Set Slider ---
      const allTimestampsFull: number[] = timeSeriesData.flatMap(entry =>
        entry.series.map(pt => new Date(pt.time).getTime())
      );
      if (allTimestampsFull.length > 0) {
        globalMinTimeMs = Math.min(...allTimestampsFull);
        globalMaxTimeMs = Math.max(...allTimestampsFull);
        globalMinTimeMins = Math.floor(globalMinTimeMs / MS_PER_MINUTE);
        globalMaxTimeMins = Math.ceil(globalMaxTimeMs / MS_PER_MINUTE); // Use ceil for max to include the last minute
      } else {
        globalMinTimeMs = Date.now(); // Fallback if no data
        globalMaxTimeMs = Date.now();
        globalMinTimeMins = Math.floor(globalMinTimeMs / MS_PER_MINUTE);
        globalMaxTimeMins = globalMinTimeMins;
      }

      // Set slider attributes
      timeRange.min = String(globalMinTimeMins);
      timeRange.max = String(globalMaxTimeMins);
      timeRange.value = String(globalMinTimeMins); // Start slider at the beginning
      currentTimeValue = globalMinTimeMins; // Sync state

      // --- Initial Render & Animation ---
      viewMode = "timeseries"; // Default to timeseries for animation
      render(); // Initial render before animation starts

      // Store max height and fix it
      chartArea.style.height = `${chartArea.offsetHeight}px`;

      // Start animation
      animateTimeline();
    }

    // --- Event listeners ---
    contributorSelect.addEventListener("change", (e) => {
      selectedContributor = contributorSelect.value;
      isAnimating = false; // Stop animation if user interacts
      render();
    });

    viewToggle.addEventListener("click", () => {
      viewMode = viewMode === "leaderboard" ? "timeseries" : "leaderboard";
      isAnimating = false; // Stop animation if user interacts
      // If switching back to timeseries, maybe restart animation or set to max?
      // For now, just render current state
      if (viewMode === 'timeseries') {
         currentTimeValue = parseInt(timeRange.value, 10); // Sync state with slider
      }
      render();
    });

    timeRange.addEventListener("input", () => {
      isAnimating = false; // Stop animation if user interacts
      currentTimeValue = parseInt(timeRange.value, 10);
      render();
    });

    // --- Load Data ---
    root.style.position = "relative";
    root.appendChild(loadingOverlay);
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
        loadingOverlay.remove();
        leaderboardData = data.leaderboard;
        timeSeriesData = data.timeSeries;

        (window as any).analyticsData = data;
        console.log("%c✨ Developer Note: Access all analytics data via window.analyticsData", "color: #00e0ff; font-weight: bold;");
        console.log("Leaderboard Data:", leaderboardData);
        console.log("Time Series Data:", timeSeriesData);

        initializeUI(); // Initialize after data is loaded
      }
    });

    // Clean up on unload
    window.addEventListener("unload", cleanupWorker);
  } catch (error) {
    console.error(error);
  }
}

init();
