import { z } from "zod";

export const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100),
  national_id: z
    .string()
    .trim()
    .regex(/^\d{6,10}$/, "ID number must be 6–10 digits"),
  phone: z
    .string()
    .trim()
    .regex(/^(\+254|0)\d{9}$/, "Use format 07XXXXXXXX or +2547XXXXXXXX"),
  email: z.string().trim().email().max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

export const requestSchema = z.object({
  category: z.enum(["streetlight", "water", "garbage", "roads", "drainage", "other"], {
    message: "Choose a category",
  }),
  location: z.string().trim().min(3, "Enter the location (at least 3 characters)").max(200),
  description: z.string().trim().min(10, "Describe the issue (at least 10 characters)").max(2000),
});
