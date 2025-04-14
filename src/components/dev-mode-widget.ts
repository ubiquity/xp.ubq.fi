import type { WorkflowRun } from "../github-actions";

interface DevWidgetElements {
  widget: HTMLDivElement;
  title: HTMLDivElement;
  runsList: HTMLDivElement;
  style: HTMLStyleElement;
}

export function createDevWidget(): DevWidgetElements {
  const widget = document.createElement("div");
  widget.className = "dev-mode-widget";

  const title = document.createElement("div");
  title.textContent = "Development Mode";
  title.className = "dev-mode-title";

  const runsList = document.createElement("div");
  runsList.className = "runs-list";

  const style = document.createElement("style");
  style.textContent = `
    .dev-mode-widget {
      position: fixed;
      bottom: 16px;
      right: 16px;
      background: rgba(24, 26, 27, 0.9);
      border: 1px solid #00e0ff;
      color: #00e0ff;
      padding: 12px;
      border-radius: 4px;
      z-index: 1000;
      min-width: 200px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    .dev-mode-title {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(0,224,255,0.3);
    }

    .runs-list {
      max-height: 300px;
      overflow-y: auto;
    }

    .run-item {
      cursor: pointer;
      padding: 8px;
      font-size: 12px;
      border-bottom: 1px solid rgba(0,224,255,0.1);
      transition: background-color 0.2s ease;
    }

    .run-item:hover {
      background: rgba(0,224,255,0.1);
    }

    .run-item.active {
      background: rgba(0,224,255,0.2);
    }
  `;

  widget.appendChild(title);
  widget.appendChild(runsList);

  return { widget, title, runsList, style };
}

export function updateRunsList(runsList: HTMLDivElement, runs: WorkflowRun[], currentRunId: string | null) {
  runsList.innerHTML = "";

  runs.forEach(run => {
    const runItem = document.createElement("div");
    runItem.className = `run-item${currentRunId && run.id.toString() === currentRunId ? " active" : ""}`;
    runItem.textContent = run.display_title;
    runItem.onclick = () => {
      const url = new URL(window.location.href);
      url.searchParams.set("run", run.id.toString());
      window.location.href = url.toString();
    };
    runsList.appendChild(runItem);
  });
}
