/**
 * Shared constants and pure helpers for citizen service requests.
 * Kept free of React/Cloud imports so they can be unit-tested.
 */
import {
  Droplets,
  Lightbulb,
  Trash2,
  Construction,
  Waves,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

export type RequestStatus = "pending" | "in_progress" | "resolved";
export type RequestCategory = "streetlight" | "water" | "garbage" | "roads" | "drainage" | "other";

export const CATEGORIES: {
  value: RequestCategory;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    value: "streetlight",
    label: "Streetlight Issue",
    hint: "Lights out, flickering or damaged poles",
    icon: Lightbulb,
  },
  { value: "water", label: "Water issue", hint: "Leaks, burst pipes, no supply", icon: Droplets },
  {
    value: "garbage",
    label: "Garbage collection",
    hint: "Missed pickups, illegal dumping",
    icon: Trash2,
  },
  {
    value: "roads",
    label: "Roads & potholes",
    hint: "Potholes, damaged roads or signs",
    icon: Construction,
  },
  {
    value: "drainage",
    label: "Drainage & sewage",
    hint: "Blocked drains, overflowing sewers",
    icon: Waves,
  },
  {
    value: "other",
    label: "Other",
    hint: "Anything else the county should know",
    icon: HelpCircle,
  },
];

/** Order of the status pipeline: Pending → In Progress → Resolved. */
export const STATUS_FLOW: RequestStatus[] = ["pending", "in_progress", "resolved"];

export const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  resolved: "Resolved",
};

export const categoryLabel = (c: string) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

/** Open = anything not yet resolved (pending + in progress). */
export function computeStats(rows: { status: RequestStatus; category: string }[]) {
  const byStatus = { pending: 0, in_progress: 0, resolved: 0 } as Record<RequestStatus, number>;
  const byCategory: Record<string, number> = {};
  for (const r of rows) {
    byStatus[r.status]++;
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
  }
  const total = rows.length;
  const open = byStatus.pending + byStatus.in_progress;
  return {
    total,
    open,
    resolved: byStatus.resolved,
    byStatus,
    byCategory,
    resolutionRate: total === 0 ? 0 : Math.round((byStatus.resolved / total) * 100),
  };
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateRequestImage(file: Pick<File, "type" | "size">): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "Use a JPG, PNG or WebP image";
  if (file.size > MAX_IMAGE_BYTES) return "Image must be 5 MB or smaller";
  return null;
}
