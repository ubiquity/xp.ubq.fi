export function getRunIdFromQuery(): string | null {
  const params = new URLSearchParams(window.location.search);
  const runId = params.get('run');
  return runId;
}
