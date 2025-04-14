import "./components/dev-mode-widget";
import type { LeaderboardEntry, TimeSeriesEntry } from "./data-transform";
import { getRunIdFromQuery, isProduction } from "./utils";
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
          // width: 720,
          height: 320,
          highlightContributor: selectedContributor !== "All" ? selectedContributor : timeSeriesData[0]?.contributor,
          maxYValue: maxYValue
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

    // Cubic bezier easing function
    function cubicBezier(x1: number, y1: number, x2: number, y2: number, t: number): number {
      const cx = 3 * x1;
      const bx = 3 * (x2 - x1) - cx;
      const ax = 1 - cx - bx;
      const cy = 3 * y1;
      const by = 3 * (y2 - y1) - cy;
      const ay = 1 - cy - by;

      function sampleCurveX(t: number): number {
        return ((ax * t + bx) * t + cx) * t;
      }

      function sampleCurveY(t: number): number {
        return ((ay * t + by) * t + cy) * t;
      }

      function solveCurveX(x: number): number {
        let t0 = 0;
        let t1 = 1;
        let t2 = x;

        for (let i = 0; i < 8; i++) {
          const x2 = sampleCurveX(t2);
          if (Math.abs(x2 - x) < 0.001) return t2;
          const d2 = (3 * ax * t2 + 2 * bx) * t2 + cx;
          if (Math.abs(d2) < 0.000001) break;
          t2 = t2 - (x2 - x) / d2;
        }

        let t = (x - sampleCurveX(t0)) / (sampleCurveX(t1) - sampleCurveX(t0));
        return t;
      }

      return sampleCurveY(solveCurveX(t));
    }

    function animateTimeline() {
      const startTime = performance.now();
      const duration = 2500; // 2.5 seconds

      function animate(currentTime: number) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Apply cubic-bezier(0,1,1,1) easing
        const eased = cubicBezier(0, 1, 1, 1, progress);

        timeRangePercent = Math.floor(eased * 100);
        timeRange.value = String(timeRangePercent);
        render();

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      }

      requestAnimationFrame(animate);
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
