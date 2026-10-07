import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { parsePeriod, computeReportData } from "@/lib/report-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? "30d";
  const { from, to } = parsePeriod(period, url.searchParams.get("from"), url.searchParams.get("to"));

  const data = await computeReportData(user.companyId!, from, to, period);
  return NextResponse.json(data);
}
