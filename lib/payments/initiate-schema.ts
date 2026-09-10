import { z } from "zod";
import { quoteFromRequest } from "./catalog";

export const initiateSchema = z.object({
  method: z.enum(["MPESA", "STRIPE"]).optional(),
  sku: z.string().min(1).max(64).optional(),
  amount: z.number().positive().optional(),
  currency: z.string().min(3).max(3).optional(),
  country: z.string().min(2).max(2).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  user_id: z.string().optional(),
  description: z.string().max(80).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type InitiateBody = z.infer<typeof initiateSchema>;

export function quoteOrThrow(input: InitiateBody) {
  return quoteFromRequest({
    sku: input.sku,
    amount: input.amount,
    currency: input.currency,
    metadata: input.metadata as { item?: unknown; resource_type?: unknown; sku?: unknown } | undefined,
  });
}
