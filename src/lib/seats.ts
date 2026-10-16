import { prisma } from "./prisma";

// Koltuk kuralı: aktif kullanıcılar + bekleyen davetler, şirketin maxSeats değerinden küçük olmalı.
// Davet gönderme (dashboard/invite) ve pasif kullanıcıyı yeniden aktifleştirme aynı kuralı kullanır.
export function koltukVarMi(params: { aktifKullanici: number; bekleyenDavet: number; maxSeats: number }): boolean {
  return params.aktifKullanici + params.bekleyenDavet < params.maxSeats;
}

// Pasif bir kullanıcıyı yeniden aktifleştirir. Şirket satırı kilitlenir (FOR UPDATE) ki
// eşzamanlı davet/aktifleştirme işlemleri kotayı aşmasın. Kota doluysa SEATS_FULL fırlatır.
export async function kullaniciAktiflestirKoltukKontrollu(
  companyId: string,
  userId: string,
  data: { isActive?: boolean; role?: "EMPLOYEE" | "COMPANY_ADMIN" }
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${companyId} FOR UPDATE`;

    const [aktifKullanici, bekleyenDavet, company] = await Promise.all([
      tx.user.count({ where: { companyId, isActive: true, NOT: { id: userId } } }),
      tx.inviteToken.count({ where: { companyId, usedAt: null, expiresAt: { gt: new Date() } } }),
      tx.company.findUnique({ where: { id: companyId }, select: { maxSeats: true } }),
    ]);

    if (!company) throw Object.assign(new Error("Şirket bulunamadı."), { code: "NOT_FOUND" });

    if (!koltukVarMi({ aktifKullanici, bekleyenDavet, maxSeats: company.maxSeats })) {
      throw Object.assign(
        new Error("Lisans kotanız dolu olduğu için bu kullanıcı yeniden aktifleştirilemez. Bir koltuk boşaltın veya yöneticinizle iletişime geçin."),
        { code: "SEATS_FULL" }
      );
    }

    return tx.user.update({ where: { id: userId }, data, select: { id: true, isActive: true, role: true } });
  });
}
