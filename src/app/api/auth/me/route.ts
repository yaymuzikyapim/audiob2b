import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;
  return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role });
}
