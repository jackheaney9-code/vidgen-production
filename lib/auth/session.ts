import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { z } from "zod";

import { SESSION_COOKIE } from "@/lib/constants";
import { getSessionSecret } from "@/lib/env";
import type { AuthUser } from "@/types";

const sessionPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
});

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getSessionSecret());
}

export async function createSessionToken(user: AuthUser): Promise<string> {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function readSessionToken(token: string): Promise<AuthUser | null> {
  try {
    const result = await jwtVerify(token, secretKey());
    const parsed = sessionPayloadSchema.safeParse({
      sub: result.payload.sub,
      email: result.payload.email,
    });
    if (!parsed.success) {
      return null;
    }
    return { id: parsed.data.sub, email: parsed.data.email };
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: AuthUser): Promise<void> {
  const token = await createSessionToken(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getDemoSessionUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  return readSessionToken(token);
}
