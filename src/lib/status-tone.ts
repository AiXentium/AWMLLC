/** Maps a free-form status label to the AWM badge palette. */
export function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (
    normalized.includes("complete") ||
    normalized.includes("approved") ||
    normalized.includes("verified") ||
    normalized.includes("matched") ||
    normalized.includes("ready") ||
    normalized.includes("clean") ||
    normalized.includes("connected")
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (
    normalized.includes("review") ||
    normalized.includes("warning") ||
    normalized.includes("pending") ||
    normalized.includes("mismatch") ||
    normalized.includes("duplicate") ||
    normalized.includes("conflict") ||
    normalized.includes("setup")
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (
    normalized.includes("progress") ||
    normalized.includes("active") ||
    normalized.includes("new") ||
    normalized.includes("included") ||
    normalized.includes("processing") ||
    normalized.includes("queued") ||
    normalized.includes("extracting")
  ) {
    return "border-primary/20 bg-primary/8 text-primary";
  }
  if (
    normalized.includes("hold") ||
    normalized.includes("rejected") ||
    normalized.includes("error") ||
    normalized.includes("failed") ||
    normalized.includes("manual") ||
    normalized.includes("quarantine")
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-border bg-secondary text-secondary-foreground";
}
