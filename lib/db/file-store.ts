import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { storeFileSchema, type AdRecord, type ProfileRecord, type StoreFile } from "@/lib/db/schema";
import { HttpError } from "@/lib/errors";
import type { Ad, CreditTransaction, Profile, Purchase } from "@/types";
import { adSchema, creditTransactionSchema, profileSchema, purchaseSchema } from "@/lib/db/schema";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

const emptyStore: StoreFile = {
  profiles: [],
  ads: [],
  transactions: [],
  purchases: [],
};

let chain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function loadStore(): Promise<StoreFile> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const result = storeFileSchema.safeParse(parsed);
    if (!result.success) {
      return emptyStore;
    }
    return result.data;
  } catch {
    return emptyStore;
  }
}

async function saveStore(store: StoreFile): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function toProfile(record: ProfileRecord): Profile {
  return {
    id: record.id,
    email: record.email,
    credits: record.credits,
    stripeCustomerId: record.stripeCustomerId ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toAd(record: AdRecord): Ad {
  return adSchema.parse(record);
}

export async function fileGetProfile(id: string): Promise<Profile | null> {
  const store = await loadStore();
  const record = store.profiles.find((item) => item.id === id);
  return record ? toProfile(record) : null;
}

export async function fileGetProfileByEmail(
  email: string,
): Promise<ProfileRecord | null> {
  const store = await loadStore();
  return store.profiles.find((item) => item.email === email.toLowerCase()) ?? null;
}

export async function fileCreateProfile(input: {
  id: string;
  email: string;
  credits: number;
  passwordHash?: string;
}): Promise<Profile> {
  return withLock(async () => {
    const store = await loadStore();
    const now = new Date().toISOString();
    const record: ProfileRecord = {
      id: input.id,
      email: input.email.toLowerCase(),
      credits: input.credits,
      stripeCustomerId: null,
      createdAt: now,
      updatedAt: now,
      passwordHash: input.passwordHash,
    };
    store.profiles.push(record);
    await saveStore(store);
    return toProfile(record);
  });
}

export async function fileUpdateCredits(
  userId: string,
  delta: number,
  reason: string,
  adId: string | null,
  stripeSessionId: string | null,
): Promise<Profile> {
  return withLock(async () => {
    const store = await loadStore();
    const profile = store.profiles.find((item) => item.id === userId);
    if (!profile) {
      throw new Error("Profile not found");
    }
    const next = profile.credits + delta;
    if (next < 0) {
      throw new Error("INSUFFICIENT_CREDITS");
    }
    profile.credits = next;
    profile.updatedAt = new Date().toISOString();
    store.transactions.push({
      id: crypto.randomUUID(),
      userId,
      amount: delta,
      reason,
      adId,
      stripeSessionId,
      createdAt: nowOr(profile.updatedAt),
    });
    await saveStore(store);
    return toProfile(profile);
  });
}

function nowOr(value: string): string {
  return value;
}

export async function fileListAds(userId: string): Promise<Ad[]> {
  const store = await loadStore();
  return store.ads
    .filter((item) => item.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map(toAd);
}

export async function fileGetAd(id: string): Promise<Ad | null> {
  const store = await loadStore();
  const record = store.ads.find((item) => item.id === id);
  return record ? toAd(record) : null;
}

export async function fileCreateAd(ad: Ad): Promise<Ad> {
  return withLock(async () => {
    const store = await loadStore();
    const record = adSchema.parse(ad);
    store.ads.unshift(record);
    await saveStore(store);
    return toAd(record);
  });
}

export async function fileUpdateAd(
  id: string,
  patch: Partial<Ad>,
): Promise<Ad> {
  return withLock(async () => {
    const store = await loadStore();
    const index = store.ads.findIndex((item) => item.id === id);
    if (index < 0) {
      throw new Error("Ad not found");
    }
    const current = store.ads[index];
    if (!current) {
      throw new Error("Ad not found");
    }
    const merged = adSchema.parse({
      ...current,
      ...patch,
      id: current.id,
      userId: current.userId,
      updatedAt: new Date().toISOString(),
    });
    store.ads[index] = merged;
    await saveStore(store);
    return toAd(merged);
  });
}

export async function fileListTransactions(
  userId: string,
): Promise<CreditTransaction[]> {
  const store = await loadStore();
  return store.transactions
    .filter((item) => item.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((item) => creditTransactionSchema.parse(item));
}

export async function fileGetProfileByStripeCustomerId(
  customerId: string,
): Promise<Profile | null> {
  const store = await loadStore();
  const record = store.profiles.find((item) => item.stripeCustomerId === customerId);
  return record ? toProfile(record) : null;
}

export async function fileUpdateStripeCustomerId(
  userId: string,
  customerId: string,
): Promise<Profile> {
  return withLock(async () => {
    const store = await loadStore();
    const profile = store.profiles.find((item) => item.id === userId);
    if (!profile) {
      throw new Error("Profile not found");
    }
    profile.stripeCustomerId = customerId;
    profile.updatedAt = new Date().toISOString();
    await saveStore(store);
    return toProfile(profile);
  });
}

export async function fileGetPurchaseBySessionId(
  sessionId: string,
): Promise<Purchase | null> {
  const store = await loadStore();
  const record = store.purchases.find((item) => item.stripeSessionId === sessionId);
  return record ? purchaseSchema.parse(record) : null;
}

export async function fileCreatePurchase(purchase: Purchase): Promise<Purchase> {
  return withLock(async () => {
    const store = await loadStore();
    const existing = store.purchases.find(
      (item) => item.stripeSessionId === purchase.stripeSessionId,
    );
    if (existing) {
      return purchaseSchema.parse(existing);
    }
    const record = purchaseSchema.parse(purchase);
    store.purchases.unshift(record);
    await saveStore(store);
    return record;
  });
}

export async function fileListPurchases(userId: string): Promise<Purchase[]> {
  const store = await loadStore();
  return store.purchases
    .filter((item) => item.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function fileFulfillStripePurchase(input: {
  sessionId: string;
  customerId: string | null;
  userId: string | null;
  credits: number;
  amountPaid: number;
}): Promise<{ duplicate: boolean; profile: Profile }> {
  return withLock(async () => {
    const store = await loadStore();
    const existingPurchase = store.purchases.find(
      (item) => item.stripeSessionId === input.sessionId,
    );
    const profileRecord =
      (input.customerId
        ? store.profiles.find((item) => item.stripeCustomerId === input.customerId)
        : undefined) ??
      (input.userId ? store.profiles.find((item) => item.id === input.userId) : undefined);
    if (!profileRecord) {
      throw new HttpError(500, "No profile matches this Stripe customer.");
    }
    if (existingPurchase) {
      return { duplicate: true, profile: toProfile(profileRecord) };
    }
    const now = new Date().toISOString();
    store.purchases.unshift({
      id: crypto.randomUUID(),
      userId: profileRecord.id,
      stripeSessionId: input.sessionId,
      creditsPurchased: input.credits,
      amountPaid: input.amountPaid,
      createdAt: now,
    });
    profileRecord.credits += input.credits;
    profileRecord.updatedAt = now;
    store.transactions.push({
      id: crypto.randomUUID(),
      userId: profileRecord.id,
      amount: input.credits,
      reason: "stripe_purchase",
      adId: null,
      stripeSessionId: input.sessionId,
      createdAt: now,
    });
    await saveStore(store);
    return { duplicate: false, profile: toProfile(profileRecord) };
  });
}

export function parseProfile(record: ProfileRecord): Profile {
  const parsed = profileSchema.omit({ passwordHash: true }).parse(record);
  return {
    id: parsed.id,
    email: parsed.email,
    credits: parsed.credits,
    stripeCustomerId: parsed.stripeCustomerId ?? null,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
  };
}
