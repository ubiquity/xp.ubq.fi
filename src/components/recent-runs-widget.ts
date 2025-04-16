/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import {
  getRecentRuns,
  getWorkflowInputs,
  setRecentRuns,
  setWorkflowInputs,
} from "../db/recent-runs-cache";
import { fetchArtifactsList } from "../fetch-artifacts-list";
import { downloadArtifactZip } from "../download-artifact";
import { unzipArtifact } from "../unzip-artifact";
import type { Artifact } from "../types";

interface WorkflowRun {
  id: number;
  created_at: string;
  head_repository?: {
    owner: {
      login: string;
    };
    name: string;
  };
  repository?: {
    owner: {
      login: string;
    };
    name: string;
  };
}

export class RecentRunsWidget extends HTMLElement {
  private container!: HTMLDivElement;
  private runsContainer!: HTMLDivElement;
  private currentRunId: string | null = null;

  constructor() {
    super();

    this.container = document.createElement("div");
    this.container.className = "recent-runs-widget";

    this.runsContainer = document.createElement("div");
    this.container.appendChild(this.runsContainer);

    // Add title
    const title = document.createElement("div");
    title.textContent = "Recent Reports";
    title.className = "recent-runs-widget__title";
    this.container.insertBefore(title, this.runsContainer);

    this.loadWorkflowRuns();
  }

  connectedCallback() {
    this.appendChild(this.container);
  }

  disconnectedCallback() {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  private async loadWorkflowRuns() {
    console.log('Starting loadWorkflowRuns...');
    let hasRenderedCache = false;

    try {
      // 1. Load cached data immediately
      const cachedRuns = await getRecentRuns();
      if (cachedRuns && Array.isArray(cachedRuns)) {
        console.log('Rendering cached runs');
        this.renderWorkflowRuns(cachedRuns);
        hasRenderedCache = true;
      }

      // Show loading only if we don't have cache
      if (!hasRenderedCache) {
        this.runsContainer.innerHTML = `
          <div class="recent-runs-widget__loading">
            <div class="recent-runs-widget__spinner"></div>
            <div>Loading reports...</div>
          </div>
        `;
      }

      // 2. Fetch fresh data from API in background
      console.log('Fetching fresh workflow runs...');
      const response = await fetch("/api/workflow-runs");
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();

      if (!Array.isArray(data.workflow_runs)) {
        throw new Error('Invalid API response format');
      }

      // Find any new runs that we don't have cached
      const existingRunIds = new Set((cachedRuns || []).map(r => r.id));
      const newRuns = data.workflow_runs.filter((run: WorkflowRun) => !existingRunIds.has(run.id));

      // Only update cache and re-render if we have new runs
      if (newRuns.length > 0) {
        await setRecentRuns(data.workflow_runs);
        this.renderWorkflowRuns(data.workflow_runs);
      }
    } catch (error) {
      console.error("Error in loadWorkflowRuns:", error);
      // Show error only if we have no data at all
      if (!this.runsContainer.querySelector('.workflow-run')) {
        this.runsContainer.innerHTML = `
          <div class="recent-runs-widget__error">
            Failed to load reports
          </div>
        `;
      }
    }
  }

  private async renderWorkflowRuns(runs: WorkflowRun[]) {
    const itemHeight = 68;
    let numToDisplay = 10;

    if (this.offsetHeight > 0) {
      const availableHeight = this.offsetHeight - 40;
      numToDisplay = Math.max(1, Math.floor(availableHeight / itemHeight));
    }

    this.runsContainer.innerHTML = "";

    const uniqueRuns = runs.reduce<WorkflowRun[]>((acc, run) => {
      if (!acc.find(r => r.id === run.id)) {
        acc.push(run);
      }
      return acc;
    }, []);

    const runsToRender = uniqueRuns.slice(0, numToDisplay);

    if (!runsToRender.length) {
      this.runsContainer.innerHTML = '<div class="recent-runs-widget__error">No workflow runs found</div>';
      return;
    }

    for (const run of runsToRender) {
      const runElement = document.createElement("div");
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

      let statusColor = '#63e6be';
      let runDetail = "";

      let inputs: Record<string, any> | null = null;
      const cachedInputs = await getWorkflowInputs(String(run.id));

      if (cachedInputs === undefined) {
        try {
          console.log(`Fetching artifacts for run ${run.id}...`);
          const artifacts = await fetchArtifactsList(String(run.id));
          const inputsArtifact = artifacts.find((a: Artifact) =>
            a.name.startsWith('workflow-inputs-') ||
            a.name === 'workflow-inputs' ||
            a.name === 'input' ||
            a.name === 'workflow_inputs'
          );

          if (inputsArtifact) {
            const zipData = await downloadArtifactZip(inputsArtifact, String(run.id));
            const unzippedData = await unzipArtifact(zipData) as Record<string, any> | Record<string, any>[];
            const processedInputs = Array.isArray(unzippedData) ? unzippedData[0] : unzippedData;
            inputs = processedInputs as Record<string, any>;
            await setWorkflowInputs(String(run.id), inputs);
          } else {
            await setWorkflowInputs(String(run.id), null);
          }
        } catch (e) {
          console.error("Error getting workflow inputs for run", run.id, e);
          await setWorkflowInputs(String(run.id), null);
        }
      } else {
        inputs = cachedInputs;
      }

      let organization;
      if (inputs?.organization) {
        organization = Array.isArray(inputs.organization) ? inputs.organization[0] : inputs.organization;
        organization = organization.trim();
      }

      const repo = inputs?.repository || inputs?.repo;

      if (organization && repo) {
        runDetail = `${organization}/${repo}`;
      } else if (organization) {
        runDetail = organization;
      } else {
        runDetail = "⚠ Unknown Report";
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

customElements.define("recent-runs-widget", RecentRunsWidget);
