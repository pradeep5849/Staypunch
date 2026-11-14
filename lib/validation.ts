import { z } from "zod";
export const email = z.string().trim().toLowerCase().email().max(254);
export const password = z
  .string()
  .min(12)
  .max(72)
  .refine(
    (v) => Buffer.byteLength(v, "utf8") <= 72,
    "Password must fit in 72 bytes",
  );
export const credentials = z.object({
  email,
  password: z.string().min(1).max(72),
});
export const registration = z.object({
  name: z.string().trim().min(2).max(100),
  email,
  password,
  propertyName: z.string().trim().min(2).max(160),
  website: z.string().max(0).optional(),
});
export const leadSchema = z.object({
  kind: z.enum(["demo", "contact", "trial"]),
  name: z.string().trim().min(2).max(100),
  email,
  propertyName: z.string().trim().max(160).default(""),
  message: z.string().trim().max(3000).default(""),
  website: z.string().max(0).optional(),
});
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(160),
  type: z.enum(["hotel", "resort", "homestay", "other"]),
  email: email.or(z.literal("")),
  phone: z.string().max(40),
  address: z.string().max(500),
  amenities: z.array(z.string().max(60)).max(30),
});
export const roomSchema = z.object({
  name: z.string().trim().min(2).max(100),
  capacity: z.coerce.number().int().min(1).max(30),
  units: z.coerce.number().int().min(1).max(10000),
});
