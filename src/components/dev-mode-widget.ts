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
    title.textContent = "Recent Runs";
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
    try {
      const response = await fetch("/api/workflow-runs");
      if (!response.ok) throw new Error("Failed to fetch workflow runs");

      const data = await response.json();
      this.renderWorkflowRuns(data.workflow_runs);
    } catch (error) {
      console.error("Error loading workflow runs:", error);
      this.runsContainer.innerHTML = '<div class="dev-mode-widget__error">Error loading workflow runs</div>';
    }
  }

  private async renderWorkflowRuns(runs: any[]) {
    this.runsContainer.innerHTML = "";

    if (!runs.length) {
      this.runsContainer.innerHTML = '<div class="dev-mode-widget__error">No workflow runs found</div>';
      return;
    }

    for (const run of runs) {
      const runElement = document.createElement("div");
      runElement.className = "workflow-run";
      runElement.className = `workflow-run${this.currentRunId === String(run.id) ? ' workflow-run--active' : ''}`;

      const timestamp = new Date(run.created_at).toLocaleString();
      let statusColor = "#63e6be"; // Default green
      let runDetail = "Processing...";

      // Fetch workflow inputs from new API endpoint
      let inputs: any = {};
      try {
        const res = await fetch(`/api/workflow-inputs/${run.id}`);
        if (res.ok) {
          inputs = await res.json();
        } else {
          console.error(`Failed to fetch workflow inputs for run ${run.id}:`, await res.text());
        }
      } catch (e) {
        console.error("Error fetching workflow inputs for run", run.id, e);
      }
      console.log("Parsed workflow inputs for run", run.id, ":", inputs);

      const organization = inputs.organization;
      const repo = inputs.repo;

      if (organization && repo) {
        runDetail = `${organization}${repo ? `/${repo}` : ""}`;
      } else if (organization) {
        runDetail = organization;
      } else if (repo) {
        runDetail = repo;
      } else {
        runDetail = "No workflow inputs";
        statusColor = "#ff6b6b";
      }

      runElement.innerHTML = `
        <div class="workflow-run__header">
          <span class="workflow-run__id">#${run.id}</span>
          <span class="workflow-run__timestamp">${timestamp}</span>
        </div>
        <div class="workflow-run__detail" style="color: ${statusColor}">
          ${runDetail}
        </div>
      `;

      runElement.addEventListener("mouseover", () => {
        // Hover state is handled by CSS
      });

      runElement.addEventListener("mouseout", () => {
        // Background is handled by CSS classes
      });

      runElement.addEventListener("click", () => {
        window.location.href = `/?run=${run.id}`;
      });

      this.runsContainer.appendChild(runElement);
    }
  }
}

customElements.define("dev-mode-widget", DevModeWidget);
