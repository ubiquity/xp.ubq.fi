export function isProduction(): boolean {
  return window.location.hostname === "xp.ubq.fi";
}

export function getRunIdFromQuery(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("run");
}
