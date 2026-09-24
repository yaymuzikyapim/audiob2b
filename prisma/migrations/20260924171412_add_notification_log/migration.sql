-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "companyId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bookId" TEXT,
    "coverUrl" TEXT,
    "sent" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
