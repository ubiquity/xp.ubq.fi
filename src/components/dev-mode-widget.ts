import {
  getRecentRuns,
  getWorkflowInputs,
  setRecentRuns,
  setWorkflowInputs,
} from "../db/recent-runs-cache";
import { isProduction } from "../utils";

export class DevModeWidget extends HTMLElement {
  private container!: HTMLDivElement;
  private runsContainer!: HTMLDivElement;
  private currentRunId: string | null = null;

  constructor() {
    super();
    if (isProduction()) return;

    this.container = document.createElement("div");
    this.container.className = "dev-mode-widget";

    this.runsContainer = document.createElement("div");
    this.container.appendChild(this.runsContainer);

    // Add title
    const title = document.createElement("div");
    title.textContent = "Recent Reports";
    title.className = "dev-mode-widget__title";
    this.container.insertBefore(title, this.runsContainer);

    this.loadWorkflowRuns();
  }

  connectedCallback() {
    if (!isProduction()) {
      this.appendChild(this.container);
    }
  }

  disconnectedCallback() {
    if (!isProduction() && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  private async loadWorkflowRuns() {
    // 1. Try to load from cache and render instantly
    let cachedRuns: any[] | null = null;
    try {
      cachedRuns = await getRecentRuns();
    } catch (e) {
      console.error("Error loading cached workflow runs:", e);
    }
    if (cachedRuns && Array.isArray(cachedRuns)) {
      this.renderWorkflowRuns(cachedRuns, true);
    } else {
      // Show loading state if no cache
      this.runsContainer.innerHTML = '<div class="dev-mode-widget__loading">Loading recent reports...</div>';
    }

    // 2. In parallel, fetch from API and update cache (do not re-render)
    try {
      const response = await fetch("/api/workflow-runs");
      if (!response.ok) throw new Error("Failed to fetch workflow runs");
      const data = await response.json();
      if (Array.isArray(data.workflow_runs)) {
        await setRecentRuns(data.workflow_runs);
      }
    } catch (error) {
      console.error("Error fetching workflow runs from API:", error);
    }
  }

  // isCacheOnly: true if rendering from cache, false if rendering from fresh API (should only be true in this widget)
  private async renderWorkflowRuns(runs: any[], isCacheOnly = false) {
    this.runsContainer.innerHTML = "";

    if (!runs.length) {
      this.runsContainer.innerHTML = '<div class="dev-mode-widget__error">No workflow runs found</div>';
      return;
    }

    for (const run of runs) {
      const runElement = document.createElement("div");
      // Get current run ID from URL
      const urlParams = new URLSearchParams(window.location.search);
      const currentRunId = urlParams.get('run');
      const isActiveRun = currentRunId === String(run.id);

      runElement.className = `workflow-run${isActiveRun ? ' workflow-run--active' : ''}`;

      const timestamp = new Date(run.created_at).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      let statusColor = "#63e6be"; // Default green
      let runDetail = "";

      // Try to get workflow inputs from cache first
      let inputs: any = undefined;
      try {
        inputs = await getWorkflowInputs(String(run.id));
        if (typeof inputs === "undefined") {
          // Not in cache, fetch from API and cache for next load
          const res = await fetch(`/api/workflow-inputs/${run.id}`);
          if (res.ok) {
            inputs = await res.json();
            await setWorkflowInputs(String(run.id), inputs);
          } else {
            // Cache null to avoid repeated fetches for missing inputs
            await setWorkflowInputs(String(run.id), null);
            inputs = null;
            console.error(`Failed to fetch workflow inputs for run ${run.id}:`, await res.text());
          }
        }
      } catch (e) {
        console.error("Error getting workflow inputs for run", run.id, e);
      }

      const organization = inputs?.organization;
      const repo = inputs?.repo;

      if (organization && repo) {
        runDetail = `${organization}${repo ? `/${repo}` : ""}`;
      } else if (organization) {
        runDetail = organization;
      } else if (repo) {
        runDetail = repo;
      } else {
        runDetail = "No inputs found";
        statusColor = "#ff6b6b";
      }

      runElement.innerHTML = `
        <div class="workflow-run__header" data-run-id="${run.id}">
          <span class="workflow-run__timestamp">${timestamp}</span>
        </div>
        <div class="workflow-run__detail" style="color: ${statusColor}">
          ${runDetail}
        </div>
      `;

      runElement.addEventListener("click", () => {
        window.location.href = `/?run=${run.id}`;
      });

      this.runsContainer.appendChild(runElement);
    }
  }
}

customElements.define("dev-mode-widget", DevModeWidget);
