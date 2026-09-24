import { Expo, ExpoPushMessage } from "expo-server-sdk";
import { prisma } from "./prisma";

const expo = new Expo();

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendToUsers(userIds: string[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, pushToken: { not: null } },
    select: { id: true, pushToken: true },
  });

  const messages: ExpoPushMessage[] = [];
  for (const user of users) {
    const token = user.pushToken!;
    if (!Expo.isExpoPushToken(token)) continue;
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

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      for (const ticket of tickets) {
        if (ticket.status === "ok") sent++;
        else failed++;
      }
    } catch {
      failed += chunk.length;
    }
  }

  return { sent, failed };
}

export async function sendToCompany(companyId: string, payload: PushPayload) {
  const users = await prisma.user.findMany({
    where: { companyId, pushToken: { not: null } },
    select: { id: true },
  });
  return sendToUsers(users.map((u) => u.id), payload);
}

export async function sendToAll(payload: PushPayload) {
  const users = await prisma.user.findMany({
    where: { pushToken: { not: null } },
    select: { id: true },
  });
  return sendToUsers(users.map((u) => u.id), payload);
}
