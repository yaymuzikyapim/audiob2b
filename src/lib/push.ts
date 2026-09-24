import { Expo, ExpoPushMessage } from "expo-server-sdk";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const expo = new Expo();

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// Aktif kullanıcı filtresi: user.isActive + company.isActive + lisans geçerli
function activeFilter(): Prisma.UserWhereInput {
  return {
    isActive: true,
    pushToken: { not: null },
    company: {
      isActive: true,
      endDate: { gt: new Date() },
    },
  };
}

async function _send(
  users: { id: string; pushToken: string | null }[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const tokenToUserId = new Map<string, string>();
  const messages: ExpoPushMessage[] = [];

  for (const user of users) {
    const token = user.pushToken!;
    if (!Expo.isExpoPushToken(token)) continue;
    tokenToUserId.set(token, user.id);
    messages.push({
      to: token,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: "default",
    });
  }

  if (messages.length === 0) return { sent: 0, failed: 0 };

  const chunks = expo.chunkPushNotifications(messages);
  let sent = 0;
  let failed = 0;
  const invalidTokens: string[] = [];

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        if (ticket.status === "ok") {
          sent++;
        } else {
          failed++;
          // DeviceNotRegistered: uygulama kaldırılmış — token'ı temizle
          if (ticket.details?.error === "DeviceNotRegistered") {
            const token = (chunk[i] as ExpoPushMessage).to as string;
            invalidTokens.push(token);
          }
        }
      });
    } catch {
      failed += chunk.length;
    }
  }

  // Geçersiz token'ları veritabanından sil
  if (invalidTokens.length > 0) {
    const userIds = invalidTokens.map((t) => tokenToUserId.get(t)).filter(Boolean) as string[];
    if (userIds.length > 0) {
      prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { pushToken: null },
      }).catch(() => {});
    }
  }

  return { sent, failed };
}

export async function sendToUsers(userIds: string[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, ...activeFilter() },
    select: { id: true, pushToken: true },
  });
  return _send(users, payload);
}

export async function sendToCompany(companyId: string, payload: PushPayload) {
  const users = await prisma.user.findMany({
    where: { companyId, ...activeFilter() },
    select: { id: true, pushToken: true },
  });
  return _send(users, payload);
}

export async function sendToAll(payload: PushPayload) {
  const users = await prisma.user.findMany({
    where: activeFilter(),
    select: { id: true, pushToken: true },
  });
  return _send(users, payload);
}

// Kaç aktif kullanıcı token'a sahip? (onay adımı için)
export async function countActiveTokens(target: "all" | "company", companyId?: string): Promise<number> {
  const where = target === "company" && companyId
    ? { companyId, ...activeFilter() }
    : activeFilter();
  return prisma.user.count({ where });
}
