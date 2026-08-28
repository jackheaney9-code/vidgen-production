import { NextResponse } from "next/server";

import { getErrorMessage, HttpError } from "@/lib/errors";

export function jsonOk<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status: number): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status });
}

export function jsonFromUnknown(error: unknown): NextResponse<{ error: string }> {
  if (error instanceof HttpError) {
    return jsonError(error.message, error.status);
  }
  console.error(error);
  return jsonError(getErrorMessage(error), 500);
}
