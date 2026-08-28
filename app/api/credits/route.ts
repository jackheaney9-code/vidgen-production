import { requireUserWithProfile } from "@/lib/auth/require-user";
import { listTransactions } from "@/lib/db";
import { jsonFromUnknown, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { profile, user } = await requireUserWithProfile();
    const transactions = await listTransactions(user.id);
    return jsonOk({ credits: profile.credits, transactions });
  } catch (error) {
    return jsonFromUnknown(error);
  }
}
