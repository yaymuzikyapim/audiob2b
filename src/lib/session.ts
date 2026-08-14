import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import type { UserRole } from "@/types";

export interface SessionPayload {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  companyId?: string | null;
}

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET!);
export const SESSION_COOKIE = "audiob2b_session";
const EXPIRES_IN = 60 * 60 * 24 * 30; // 30 gün (saniye)

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRES_IN}s`)
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// Server Component / Route Handler içinde kullan (cookie + Bearer token)
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (cookieToken) return verifySession(cookieToken);

  // Mobil uygulama: Authorization: Bearer <token>
  const headerStore = await headers();
  const auth = headerStore.get("authorization");
  if (auth?.startsWith("Bearer ")) return verifySession(auth.slice(7));

  return null;
}

// proxy.ts (middleware) içinde kullan — cookies() Edge'de yok
export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const cookieToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (cookieToken) return verifySession(cookieToken);

  // Mobil Bearer token desteği
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return verifySession(auth.slice(7));

  return null;
}
