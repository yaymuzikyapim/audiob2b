-- public şemadaki tüm tablolarda Row-Level Security etkinleştir.
-- Komut idempotent: zaten açık tablolarda etkisi yoktur.
-- Amaç: sıfırdan kurulan veritabanında RLS tekrar üretilebilir olsun.
ALTER TABLE "Book"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bookmark"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Chapter"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Company"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InviteToken"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationLog"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Package"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PackageBook"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlayHistory"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlayerState"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Series"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserFavorite"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
