import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AcceptInviteForm from "@/components/AcceptInviteForm";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invite = await prisma.inviteToken.findUnique({
    where: { token },
    include: { company: { select: { name: true } } },
  });

  if (!invite) notFound();

  if (invite.usedAt) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-white text-xl font-semibold mb-2">Bu davet zaten kullanıldı</h2>
          <p className="text-gray-400 text-sm mb-6">Hesabınız oluşturulmuş. Giriş yapabilirsiniz.</p>
          <a href="/login" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors">
            Giriş Yap
          </a>
        </div>
      </div>
    );
  }

  if (invite.expiresAt < new Date()) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-4xl mb-4">⏰</div>
          <h2 className="text-white text-xl font-semibold mb-2">Davet süresi doldu</h2>
          <p className="text-gray-400 text-sm">Yöneticinizden yeni bir davet linki isteyin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">AudioB2B</h1>
          <p className="text-gray-400 mt-2">Kurumsal Sesli Kitap Platformu</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
          <div className="text-center mb-6">
            <div className="text-3xl mb-3">🎉</div>
            <h2 className="text-xl font-semibold text-white">{invite.company.name} ekibine davet edildiniz</h2>
            <p className="text-gray-400 text-sm mt-2">Hesabınızı oluşturmak için aşağıdaki formu doldurun.</p>
          </div>

          <div className="bg-gray-800 rounded-xl px-4 py-3 mb-6">
            <div className="text-gray-500 text-xs">Davet edilen e-posta</div>
            <div className="text-white text-sm font-medium mt-0.5">{invite.email}</div>
          </div>

          <AcceptInviteForm token={token} email={invite.email} />
        </div>
      </div>
    </div>
  );
}
