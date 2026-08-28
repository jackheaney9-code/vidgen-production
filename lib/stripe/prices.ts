import { CREDIT_PACKS_CATALOG } from "@/lib/constants";
import { getEnv, hasStripe } from "@/lib/env";
import { HttpError } from "@/lib/errors";
import { getStripe } from "@/lib/stripe/client";
import type { CreditPack } from "@/types";

const stripePriceByPack = new Map<string, string>();
const packByStripePrice = new Map<string, CreditPack>();
let ensured = false;

export function getCreditPack(id: string): CreditPack {
  const pack = CREDIT_PACKS_CATALOG.find((item) => item.id === id);
  if (!pack) {
    throw new HttpError(400, "Unknown credit pack");
  }
  return pack;
}

export function findPackByPriceId(priceId: string): CreditPack | null {
  const fromCatalog = CREDIT_PACKS_CATALOG.find(
    (item) =>
      item.id === priceId ||
      item.lookupKey === priceId ||
      item.envPriceId === priceId,
  );
  if (fromCatalog) {
    return fromCatalog;
  }
  return packByStripePrice.get(priceId) ?? null;
}

function envPriceId(pack: CreditPack): string | undefined {
  return getEnv(pack.envPriceVar) ?? getEnv(`NEXT_PUBLIC_${pack.envPriceVar}`);
}

export async function ensureStripeCreditPrices(): Promise<void> {
  if (ensured || !hasStripe()) {
    return;
  }
  const stripe = getStripe();
  for (const pack of CREDIT_PACKS_CATALOG) {
    const configured = envPriceId(pack);
    if (configured) {
      stripePriceByPack.set(pack.id, configured);
      packByStripePrice.set(configured, pack);
      continue;
    }
    const listed = await stripe.prices.list({
      lookup_keys: [pack.lookupKey],
      limit: 1,
      active: true,
    });
    const existing = listed.data[0];
    if (existing) {
      stripePriceByPack.set(pack.id, existing.id);
      packByStripePrice.set(existing.id, pack);
      continue;
    }
    const product = await stripe.products.create({
      name: pack.name,
      description: pack.blurb,
      metadata: {
        lumina_credits: String(pack.credits),
        lumina_pack: pack.id,
      },
    });
    const price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: pack.priceCents,
      lookup_key: pack.lookupKey,
      metadata: {
        lumina_credits: String(pack.credits),
        lumina_pack: pack.id,
      },
    });
    stripePriceByPack.set(pack.id, price.id);
    packByStripePrice.set(price.id, pack);
  }
  ensured = true;
}

export async function resolveCheckoutPrice(priceId: string): Promise<{
  pack: CreditPack;
  stripePriceId: string;
}> {
  const pack = findPackByPriceId(priceId);
  if (!hasStripe()) {
    if (!pack) {
      throw new HttpError(400, "Unknown price.");
    }
    return { pack, stripePriceId: pack.lookupKey };
  }

  await ensureStripeCreditPrices();

  if (pack) {
    const stripePriceId = stripePriceByPack.get(pack.id) ?? envPriceId(pack);
    if (!stripePriceId) {
      throw new HttpError(500, "Stripe price is missing for this pack.");
    }
    return { pack, stripePriceId };
  }

  const cached = packByStripePrice.get(priceId);
  if (cached) {
    return { pack: cached, stripePriceId: priceId };
  }

  const stripe = getStripe();
  try {
    const price = await stripe.prices.retrieve(priceId);
    const fromMeta = packFromStripePrice(price);
    if (!fromMeta) {
      throw new HttpError(400, "That price is not a Lumina credit pack.");
    }
    packByStripePrice.set(price.id, fromMeta);
    return { pack: fromMeta, stripePriceId: price.id };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(400, "Unknown price.");
  }
}

export function packFromStripePrice(price: {
  id: string;
  lookup_key?: string | null;
  metadata?: Record<string, string> | null;
  unit_amount?: number | null;
}): CreditPack | null {
  if (price.lookup_key) {
    const byKey = CREDIT_PACKS_CATALOG.find((item) => item.lookupKey === price.lookup_key);
    if (byKey) {
      return byKey;
    }
  }
  const packId = price.metadata?.lumina_pack;
  if (packId) {
    const byId = CREDIT_PACKS_CATALOG.find((item) => item.id === packId);
    if (byId) {
      return byId;
    }
  }
  const creditsRaw = price.metadata?.lumina_credits;
  if (creditsRaw) {
    const credits = Number.parseInt(creditsRaw, 10);
    const byCredits = CREDIT_PACKS_CATALOG.find((item) => item.credits === credits);
    if (byCredits) {
      return byCredits;
    }
  }
  if (typeof price.unit_amount === "number") {
    const byAmount = CREDIT_PACKS_CATALOG.find((item) => item.priceCents === price.unit_amount);
    if (byAmount) {
      return byAmount;
    }
  }
  return packByStripePrice.get(price.id) ?? null;
}
