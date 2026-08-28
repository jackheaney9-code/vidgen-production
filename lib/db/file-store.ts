import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { storeFileSchema, type AdRecord, type ProfileRecord, type StoreFile } from "@/lib/db/schema";
import type { Ad, CreditTransaction, Profile } from "@/types";
import { adSchema, creditTransactionSchema, profileSchema } from "@/lib/db/schema";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

const emptyStore: StoreFile = {
  profiles: [],
  ads: [],
  transactions: [],
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

export function parseProfile(record: ProfileRecord): Profile {
  return profileSchema
    .omit({ passwordHash: true })
    .parse(record);
}
