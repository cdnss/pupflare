import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

const target = "https://ww1.anoboy.app";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Origin, X-Requested-With, Content-Type, Accept",
};

function transformHTML(html: string): string {
  const $ = cheerio.load(html);

  // Hapus elemen-elemen iklan dan banner
  [
    ".ads",
    ".advertisement",
    ".banner",
    "#coloma",
    ".iklan",
    ".sidebar a",
    "#ad_box",
    "#ad_bawah",
    "#judi",
    
    "#judi2",
  ].forEach((sel) => $(sel).remove());

  // Ubah tautan <a> agar menghilangkan base URL target
  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      $(el).attr("href", href.replace(target, ""));
    }
  });

const processedHtml = $.html();
  // Prepend doctype jika tidak ada
  if (!/^<!DOCTYPE\s+/i.test(processedHtml)) {
    return "<!DOCTYPE html>\n" + processedHtml;
  }
  return processedHtml
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const targetUrl = new URL(target + url.pathname + url.search);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const targetResponse = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });

    const contentType = targetResponse.headers.get("Content-Type") || "";
    if (contentType.includes("text/html")) {
      const html = await targetResponse.text();
      const modifiedHtml = transformHTML(html);
      const headers = new Headers({
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
      });
      return new Response(modifiedHtml, {
        status: targetResponse.status,
        statusText: targetResponse.statusText,
        headers,
      });
    } else {
      const headers = new Headers({ ...corsHeaders });
      targetResponse.headers.forEach((value, key) => {
        headers.append(key, value);
      });
      return new Response(targetResponse.body, {
        status: targetResponse.status,
        statusText: targetResponse.statusText,
        headers,
      });
    }
  } catch (error) {
    console.error(error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

console.log("CORS-enabled web server listening on port 8000");
serve(handler, { port: 8000 });
