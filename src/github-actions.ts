export interface WorkflowRun {
  id: number;
  created_at: string;
  display_title: string;
}

export async function fetchLatestWorkflowRuns(): Promise<WorkflowRun[]> {
  const response = await fetch("/api/workflow-runs");

  if (!response.ok) {
    throw new Error("Failed to fetch workflow runs");
  }

  const data = await response.json();
  return data.workflow_runs
    .filter((run: any) => run.name === "Bun GitHub Action" && run.event === "workflow_dispatch")
    .map((run: any) => ({
      id: run.id,
      created_at: run.created_at,
      display_title: `Run #${run.id} (${new Date(run.created_at).toLocaleString()})`
    }));
}
