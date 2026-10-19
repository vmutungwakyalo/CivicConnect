import { describe, expect, it } from "vitest";
import { computeStats, MAX_IMAGE_BYTES, STATUS_FLOW, validateRequestImage } from "@/lib/requests";

describe("request rules", () => {
  it("status flow is Pending → In Progress → Resolved", () => {
    expect(STATUS_FLOW).toEqual(["pending", "in_progress", "resolved"]);
  });

  it("counts pending and in-progress cases as open, resolved separately", () => {
    const s = computeStats([
      { status: "pending", category: "water" },
      { status: "in_progress", category: "water" },
      { status: "resolved", category: "garbage" },
    ]);
    expect(s.open).toBe(2);
    expect(s.resolved).toBe(1);
    expect(s.byCategory["water"]).toBe(2);
    expect(s.resolutionRate).toBe(33);
  });

  it("returns zeroed analytics when there are no requests", () => {
    expect(computeStats([])).toEqual({
      total: 0,
      open: 0,
      resolved: 0,
      byStatus: { pending: 0, in_progress: 0, resolved: 0 },
      byCategory: {},
      resolutionRate: 0,
    });
  });

  it("accepts supported images at the 5 MB limit", () => {
    expect(validateRequestImage({ type: "image/jpeg", size: MAX_IMAGE_BYTES })).toBeNull();
    expect(validateRequestImage({ type: "image/png", size: 1 })).toBeNull();
    expect(validateRequestImage({ type: "image/webp", size: 1 })).toBeNull();
  });

  it("rejects unsupported and oversized images", () => {
    expect(validateRequestImage({ type: "image/gif", size: 1 })).toBe(
      "Use a JPG, PNG or WebP image",
    );
    expect(validateRequestImage({ type: "image/jpeg", size: MAX_IMAGE_BYTES + 1 })).toBe(
      "Image must be 5 MB or smaller",
    );
  });
});
