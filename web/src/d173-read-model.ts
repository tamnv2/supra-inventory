export type D173ReadModelRequest = { kind: "PICKER" | "REPORTER"; params: Record<string, string> };

export function readModelSnapshot(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = (value as { snapshot?: unknown }).snapshot;
  return snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot as Record<string, unknown> : null;
}

export function mutationReadModel(value: unknown): unknown {
  return value && typeof value === "object" ? (value as { read_model?: unknown }).read_model : null;
}

export function readModelMatches(value: unknown, request: D173ReadModelRequest): boolean {
  if (!value || typeof value !== "object") return false;
  const view = (value as { view?: { kind?: string; params?: Record<string, unknown> } }).view;
  return Boolean(view?.kind === request.kind && view.params && Object.entries(request.params)
    .every(([key, expected]) => String(view.params![key] ?? "") === expected));
}
