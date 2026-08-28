import type { AdStatus } from "@/types";

export const POLL_INTERVAL_MS = 3_000;

export function isGeneratingStatus(status: AdStatus): boolean {
  return (
    status === "generating_script" ||
    status === "generating_video" ||
    status === "generating_voice" ||
    status === "compositing"
  );
}

export function statusBadgeLabel(status: AdStatus): "Generating" | "Completed" | "Failed" | "Draft" {
  if (status === "completed") {
    return "Completed";
  }
  if (status === "failed") {
    return "Failed";
  }
  if (isGeneratingStatus(status)) {
    return "Generating";
  }
  return "Draft";
}

export function statusBadgeVariant(
  status: AdStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") {
    return "default";
  }
  if (status === "failed") {
    return "destructive";
  }
  if (isGeneratingStatus(status)) {
    return "secondary";
  }
  return "outline";
}

export function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
