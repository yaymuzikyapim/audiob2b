import { cache } from "react";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getSession } from "./session";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  companyId: true,
  company: {
    select: {
      id: true,
      name: true,
      isActive: true,
      endDate: true,
      packageId: true,
      logoUrl: true,
      brandColor: true,
    },
  },
} satisfies Prisma.UserSelect;

export type AuthUser = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

type RequireUserOpts = {
  roles?: Array<"SUPER_ADMIN" | "COMPANY_ADMIN" | "EMPLOYEE">;
  // SUPER_ADMIN hariç default: true — şirket durumu + lisans tarihi + paket kontrolü
  requireActiveCompany?: boolean;
};

export type RequireUserResult =
  | { ok: true; user: AuthUser; response: null }
  | { ok: false; user: null; response: NextResponse };

async function fetchDbUser(id: string): Promise<AuthUser | null> {
  return prisma.user.findUnique({ where: { id }, select: USER_SELECT });
}

/**
 * API route handler'lar için yetki doğrulama.
 * JWT'den YALNIZCA kullanıcı ID'si alınır; role/companyId/isActive DB'den okunur.
 */
export async function requireUser(opts?: RequireUserOpts): Promise<RequireUserResult> {
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      user: null,
      response: NextResponse.json({ error: "Yetkisiz." }, { status: 401 }),
    };
  }

  const user = await fetchDbUser(session.id);

  if (!user || !user.isActive) {
    return {
      ok: false,
      user: null,
      response: NextResponse.json(
        { error: "Hesap aktif değil.", code: "ACCOUNT_INACTIVE" },
        { status: 401 },
      ),
    };
  }

  if (opts?.roles && !opts.roles.includes(user.role)) {
    return {
      ok: false,
      user: null,
      response: NextResponse.json({ error: "Yetkisiz." }, { status: 403 }),
    };
  }

  if (user.role !== "SUPER_ADMIN" && opts?.requireActiveCompany !== false) {
    if (!user.company || !user.company.isActive) {
      return {
        ok: false,
        user: null,
        response: NextResponse.json(
          { error: "Şirket hesabı aktif değil.", code: "COMPANY_INACTIVE" },
          { status: 403 },
        ),
      };
    }
    if (new Date() > user.company.endDate) {
      return {
        ok: false,
        user: null,
        response: NextResponse.json(
          { error: "Lisans süresi dolmuştur.", code: "LICENSE_EXPIRED" },
          { status: 403 },
        ),
      };
    }
    if (!user.company.packageId) {
      return {
        ok: false,
        user: null,
        response: NextResponse.json(
          { error: "Pakete erişim yok.", code: "NO_PACKAGE" },
          { status: 403 },
        ),
      };
    }
  }

  return { ok: true, user, response: null };
}

/**
 * Server component ve layout'lar için.
 * React cache: aynı render ağacında birden fazla çağrı tek DB sorgusuna indirilir.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const session = await getSession();
  if (!session) return null;
  return fetchDbUser(session.id);
});
