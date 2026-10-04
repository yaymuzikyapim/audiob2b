/**
 * AudioB2B Smoke Test — canlı Vercel ortamı
 * Şifreler hiçbir çıktıya yazılmaz.
 * Kullanım: node scripts/smoke-test.mjs <vercel-url>
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

function readEnv(filePath) {
  const vars = {};
  if (!fs.existsSync(filePath)) return vars;
  for (const line of fs.readFileSync(filePath, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return vars;
}

const env = {
  ...readEnv(path.join(PROJECT_ROOT, ".env")),
  ...readEnv(path.join(PROJECT_ROOT, ".env.local")),
};

if (!env.DATABASE_URL) throw new Error("DATABASE_URL bulunamadı");
if (!env.TEST_USER_EMAIL) throw new Error("TEST_USER_EMAIL bulunamadı");
if (!env.TEST_USER_PASSWORD) throw new Error("TEST_USER_PASSWORD bulunamadı");

const BASE = process.argv[2] || process.env.SMOKE_BASE_URL;
if (!BASE) throw new Error("Vercel URL gerekli: node smoke-test.mjs <https://...>");

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function request(urlPath, method = "GET", body = null, cookie = null) {
  return new Promise((resolve) => {
    const url = new URL(urlPath, BASE);
    const transport = url.protocol === "https:" ? https : http;
    const opts = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    };
    const req = transport.request(url, opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        const setCookie = res.headers["set-cookie"];
        let sessionCookie = null;
        if (setCookie) {
          const match = setCookie.join(";").match(/audiob2b_session=([^;]+)/);
          if (match) sessionCookie = `audiob2b_session=${match[1]}`;
        }
        try {
          resolve({ status: res.statusCode, body: JSON.parse(d), sessionCookie });
        } catch {
          resolve({ status: res.statusCode, body: d, sessionCookie });
        }
      });
    });
    req.on("error", (e) => resolve({ status: 0, error: e.message, sessionCookie: null }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Login
  const loginRes = await request("/api/auth/login", "POST", {
    email: env.TEST_USER_EMAIL,
    password: env.TEST_USER_PASSWORD,
  });
  if (loginRes.status !== 200 || !loginRes.sessionCookie) {
    console.error("Login başarısız:", loginRes.status, JSON.stringify(loginRes.body));
    process.exit(1);
  }
  const cookie = loginRes.sessionCookie;
  const role = loginRes.body?.role;
  console.log(`Login: OK (rol=${role})`);

  const results = [];

  // 1. GET /api/dashboard/library
  const lib = await request("/api/dashboard/library", "GET", null, cookie);
  results.push({ endpoint: "GET /api/dashboard/library", expected: 200, actual: lib.status, pass: lib.status === 200 });

  // Library'den bir kitap al
  const books = lib.body?.books ?? lib.body ?? [];
  const firstBook = Array.isArray(books) && books.length > 0 ? books[0] : null;
  const bookId = firstBook?.id ?? firstBook?.bookId ?? null;

  // 2. GET /api/dashboard/book/:id
  if (bookId) {
    const bk = await request(`/api/dashboard/book/${bookId}`, "GET", null, cookie);
    results.push({ endpoint: `GET /api/dashboard/book/${bookId}`, expected: 200, actual: bk.status, pass: bk.status === 200 });

    // Bölüm al — s3Key endpoint tarafından beklenen parametre
    const chapters = bk.body?.book?.chapters ?? bk.body?.chapters ?? [];
    const firstChapter = Array.isArray(chapters) && chapters.length > 0 ? chapters[0] : null;
    const chapterId = firstChapter?.id ?? null;
    const s3Key = firstChapter?.s3Key ?? null;

    // 3. GET /api/dashboard/audio-url?key=<s3Key>
    if (s3Key) {
      const au = await request(`/api/dashboard/audio-url?key=${encodeURIComponent(s3Key)}`, "GET", null, cookie);
      let urlInfo = "yok";
      if (au.status === 200 && au.body?.url) {
        try {
          const parsed = new URL(au.body.url);
          const expires = parsed.searchParams.get("X-Amz-Expires") ?? "?";
          urlInfo = `host=${parsed.hostname} süre=${expires}s`;
        } catch {
          urlInfo = "URL parse edilemedi";
        }
      }
      results.push({
        endpoint: "GET /api/dashboard/audio-url",
        expected: 200,
        actual: `${au.status}${au.status === 200 ? ` (${urlInfo})` : ""}`,
        pass: au.status === 200,
      });

      // 5. POST /api/dashboard/player-state
      if (chapterId) {
        const ps = await request("/api/dashboard/player-state", "POST", {
          bookId,
          chapterId,
          positionSec: 10,
          clientSavedAt: new Date().toISOString(),
        }, cookie);
        results.push({ endpoint: "POST /api/dashboard/player-state", expected: 200, actual: ps.status, pass: ps.status === 200 });
      }
    } else {
      results.push({ endpoint: "GET /api/dashboard/audio-url", expected: 200, actual: "SKIP (s3Key yok)", pass: null });
      results.push({ endpoint: "POST /api/dashboard/player-state", expected: 200, actual: "SKIP (bölüm yok)", pass: null });
    }
  } else {
    results.push({ endpoint: "GET /api/dashboard/book/:id", expected: 200, actual: "SKIP (kitap yok)", pass: null });
    results.push({ endpoint: "GET /api/dashboard/audio-url", expected: 200, actual: "SKIP (kitap yok)", pass: null });
    results.push({ endpoint: "POST /api/dashboard/player-state", expected: 200, actual: "SKIP (kitap yok)", pass: null });
  }

  // 4. GET /api/mobile/last-played
  const lp = await request("/api/mobile/last-played", "GET", null, cookie);
  results.push({ endpoint: "GET /api/mobile/last-played", expected: 200, actual: lp.status, pass: lp.status === 200 });

  await prisma.$disconnect();
  return results;
}

main()
  .then((results) => {
    const col = [44, 12, 12];
    const pad = (s, n) => String(s).slice(0, n).padEnd(n);
    console.log(`\n${"─".repeat(80)}`);
    console.log(`${pad("ENDPOINT", col[0])} ${pad("BEKLENEN", col[1])} ${pad("GERÇEKLEŞEN", col[2])} DURUM`);
    console.log(`${"─".repeat(80)}`);
    for (const r of results) {
      const durum = r.pass === null ? "⏭  SKIP" : r.pass ? "✅" : "❌ BAŞARISIZ";
      console.log(`${pad(r.endpoint, col[0])} ${pad(r.expected, col[1])} ${pad(r.actual, col[2])} ${durum}`);
    }
    const passed = results.filter((r) => r.pass === true).length;
    const tested = results.filter((r) => r.pass !== null).length;
    console.log(`${"─".repeat(80)}`);
    console.log(`Toplam: ${passed}/${tested} test geçti.\n`);
    if (results.some((r) => r.pass === false)) process.exit(1);
  })
  .catch((err) => {
    console.error("[HATA]", err.message);
    process.exit(1);
  });
