import { NextResponse } from "next/server";
import { prisma } from "./prisma";

export interface ActiveAccess {
  userId: string;
  companyId: string;
  packageId: string;
}

/**
 * Kullanıcı aktifliği, şirket aktifliği ve lisans süresini tek sorguda doğrular.
 * companyId token'dan değil, veritabanından okunur.
 */
export async function getActiveAccess(
  userId: string | undefined
): Promise<{ ok: true; data: ActiveAccess } | { ok: false; response: ReturnType<typeof NextResponse.json> }> {
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: "Oturum gerekli." }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isActive: true,
      company: {
        select: { id: true, packageId: true, isActive: true, endDate: true },
      },
    },
  });

  if (!user?.isActive) {
    return { ok: false, response: NextResponse.json({ error: "Hesabınız pasif durumdadır. Lütfen yöneticinizle iletişime geçin.", code: "ACCOUNT_INACTIVE" }, { status: 403 }) };
  }

  const co = user.company;
  if (!co?.isActive) {
    return { ok: false, response: NextResponse.json({ error: "Şirket hesabı pasif durumdadır. Lütfen yöneticinizle iletişime geçin.", code: "COMPANY_INACTIVE" }, { status: 403 }) };
  }

  if (co.endDate && co.endDate < new Date()) {
    return { ok: false, response: NextResponse.json({ error: "Şirketinizin lisans süresi sona ermiştir. Lütfen yöneticinizle iletişime geçin.", code: "LICENSE_EXPIRED" }, { status: 403 }) };
  }

  if (!co.packageId) {
    return { ok: false, response: NextResponse.json({ error: "Şirketinize tanımlı aktif bir paket bulunmuyor. Lütfen yöneticinizle iletişime geçin.", code: "NO_PACKAGE" }, { status: 403 }) };
  }

  return { ok: true, data: { userId, companyId: co.id, packageId: co.packageId } };
}
