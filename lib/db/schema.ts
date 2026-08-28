import { z } from "zod";

import { AD_STYLES } from "@/types";

export const adScriptSchema = z.object({
  hook: z.string().min(1),
  body: z.string().min(1),
  cta: z.string().min(1),
  fullText: z.string().min(1),
  visualPrompt: z.string().min(1),
  onScreenText: z.array(z.string()).default([]),
  durationSeconds: z.number().min(8).max(30),
});

export const adStyleSchema = z.enum(AD_STYLES);

export const adStatusSchema = z.enum([
  "pending",
  "generating_script",
  "generating_video",
  "generating_voice",
  "compositing",
  "completed",
  "failed",
]);

export const profileSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  credits: z.number().int(),
  stripeCustomerId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  passwordHash: z.string().optional(),
});

export const adSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  productName: z.string().min(1),
  productDescription: z.string().min(1),
  audience: z.string().min(1),
  style: adStyleSchema,
  productImagePath: z.string().min(1),
  script: adScriptSchema.nullable(),
  videoPath: z.string().nullable(),
  voicePath: z.string().nullable(),
  finalPath: z.string().nullable(),
  status: adStatusSchema,
  error: z.string().nullable(),
  creditDeducted: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const creditTransactionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  amount: z.number().int(),
  reason: z.string().min(1),
  adId: z.string().nullable(),
  stripeSessionId: z.string().nullable(),
  createdAt: z.string(),
});

export const purchaseSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  stripeSessionId: z.string().min(1),
  creditsPurchased: z.number().int(),
  amountPaid: z.number().int(),
  createdAt: z.string(),
});

export const generateBodySchema = z.object({
  adId: z.string().min(1),
});

export const scriptUpdateSchema = z.object({
  adId: z.string().min(1),
  script: adScriptSchema,
});

export const checkoutSchema = z.object({
  priceId: z.string().min(1),
});

export const magicLinkSchema = z.object({
  email: z.string().email(),
});

export const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const storeFileSchema = z.object({
  profiles: z.array(profileSchema),
  ads: z.array(adSchema),
  transactions: z.array(creditTransactionSchema),
  purchases: z.array(purchaseSchema).default([]),
});

export type ProfileRecord = z.infer<typeof profileSchema>;
export type AdRecord = z.infer<typeof adSchema>;
export type StoreFile = z.infer<typeof storeFileSchema>;
export type PurchaseRecord = z.infer<typeof purchaseSchema>;
