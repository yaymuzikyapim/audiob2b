export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const link = await prisma.proposalLink.findUnique({ where: { token } });
  if (!link) return new Response("Bulunamadı.", { status: 404 });
  if (link.expiresAt < new Date()) {
    return new Response("Bu bağlantının süresi dolmuştur.", { status: 410 });
  }

  let html: string;
  try {
    html = await readFile(join(process.cwd(), "private", `${link.slug}.html`), "utf-8");
  } catch {
    return new Response("İçerik bulunamadı.", { status: 404 });
  }

  const trackingScript = `\n<script>
(function(){
  try {
    var k='proposal_vid';
    var vid=localStorage.getItem(k);
    if(!vid){vid=crypto.randomUUID();localStorage.setItem(k,vid);}
    fetch('/api/p/${token}/view',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({visitorId:vid})
    }).catch(function(){});
  }catch(e){}
})();
</script>`;

  return new Response(html + trackingScript, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
