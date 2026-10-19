import { describe, expect, it } from "vitest";
import { requestSchema, signupSchema } from "@/lib/validation";

describe("citizen form validation", () => {
  it("accepts a valid citizen signup and trims text fields", () => {
    const result = signupSchema.safeParse({
      full_name: "  Amina Wanjiku ",
      national_id: "12345678",
      phone: "0712345678",
      email: "  amina@example.com ",
      password: "secure-password",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.full_name).toBe("Amina Wanjiku");
      expect(result.data.email).toBe("amina@example.com");
    }
  });

  it("rejects invalid national IDs, phone numbers and short passwords", () => {
    const result = signupSchema.safeParse({
      full_name: "Amina Wanjiku",
      national_id: "123",
      phone: "12345",
      email: "amina@example.com",
      password: "short",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual([
        "national_id",
        "phone",
        "password",
      ]);
    }
  });

  it("accepts valid requests and normalizes leading and trailing spaces", () => {
    const result = requestSchema.safeParse({
      category: "water",
      location: "  Moi Avenue, Nairobi  ",
      description: "  Water pipe leaking near the market.  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.location).toBe("Moi Avenue, Nairobi");
      expect(result.data.description).toBe("Water pipe leaking near the market.");
    }
  });

  it("rejects missing categories and too-short request details", () => {
    const result = requestSchema.safeParse({
      category: "",
      location: "Hi",
      description: "Broken",
    });

    expect(result.success).toBe(false);
  });
});
