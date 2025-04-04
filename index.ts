import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Headers } from "https://deno.land/std@0.168.0/http/mod.ts";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

// Ambil variabel lingkungan untuk konfigurasi server
const target = Deno.env.get("TARGET_URL") || "https://ww1.anoboy.app";
const port = parseInt(Deno.env.get("PORT") || "8000");
const CACHE_TTL = parseInt(Deno.env.get("CACHE_TTL") || "60000"); // default 60 detik

// Mekanisme caching sederhana untuk GET request HTML
const cache = new Map<
  string,
  { expiry: number; content: string; status: number; statusText: string }
>();

// Header CORS standar
const corsHeaders = new Headers({
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Origin, X-Requested-With, Content-Type, Accept",
});

/**
 * Fungsi untuk menyaring header request agar tidak mengirim header yang sensitif.
 * Misalnya, header "host", "connection", atau header terkait IP.
 */
function filterRequestHeaders(headers: Headers): Headers {
  const newHeaders = new Headers();
  const forbidden = [
    "host",
    "connection",
    "x-forwarded-for",
    "cf-connecting-ip",
    "cf-ipcountry",
    "x-real-ip",
  ];

  for (const [key, value] of headers) {
    if (!forbidden.includes(key.toLowerCase())) {
      newHeaders.append(key, value);
    }
  }
  return newHeaders;
}

/**
 * Fungsi transformHTML untuk memodifikasi konten HTML:
 * - Menghapus elemen iklan dan banner.
 * - Mengubah tautan agar tidak memiliki base URL target.
 * - Menambahkan meta charset jika belum ada.
 * - Menambahkan doctype jika belum ada.
 */
function transformHTML(html: string): string {
  const $ = cheerio.load(html);

  // Daftar selector elemen yang akan dihapus
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
  ].forEach((selector) => $(selector).remove());

  // Ubah tautan <a> agar tidak menyertakan base URL target
  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      $(el).attr("href", href.replace(target, ""));
    }
  });

  // Tambahkan meta charset jika belum ada
  if ($("meta[charset]").length === 0) {
    $("head").prepend(`<meta charset="UTF-8">`);
  }

  const processedHtml = $.html();

  // Tambahkan DOCTYPE jika belum ada di awal dokumen
  if (!/^<!DOCTYPE\s+/i.test(processedHtml)) {
    return "<!DOCTYPE html>\n" + processedHtml;
  }
  return processedHtml;
}

/**
 * Handler utama untuk memproses permintaan proxy.
 * - Memfilter header request agar header sensitif tidak diteruskan ke target.
 * - Menerapkan caching untuk GET request HTML.
 * - Menggunakan streaming langsung untuk konten non-HTML.
 */
async function handler(req: Request): Promise<Response> {
  const requestUrl = new URL(req.url);

  // Tangani request preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Buat URL target dengan menggabungkan target base, path, dan query parameter
  const targetUrl = new URL(target + requestUrl.pathname + requestUrl.search);

  // Terapkan caching untuk GET request (hanya untuk respons HTML)
  if (req.method === "GET" && cache.has(requestUrl.toString())) {
    const cachedEntry = cache.get(requestUrl.toString());
    if (cachedEntry && cachedEntry.expiry > Date.now()) {
      const responseHeaders = new Headers(corsHeaders);
      responseHeaders.set("Content-Type", "text/html; charset=utf-8");
      return new Response(cachedEntry.content, {
        status: cachedEntry.status,
        statusText: cachedEntry.statusText,
        headers: responseHeaders,
      });
    } else {
      cache.delete(requestUrl.toString());
    }
  }

  try {
    // Salin dan filter header request
    const filteredHeaders = filterRequestHeaders(req.headers);
    const targetResponse = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: filteredHeaders,
      body: req.body,
    });

    const contentType = targetResponse.headers.get("content-type") || "";

    // Jika respons berupa HTML, lakukan transformasi dan caching
    if (contentType.includes("text/html")) {
      const htmlContent = await targetResponse.text();
      const modifiedHtml = transformHTML(htmlContent);

      if (req.method === "GET") {
        cache.set(requestUrl.toString(), {
          expiry: Date.now() + CACHE_TTL,
          content: modifiedHtml,
          status: targetResponse.status,
          statusText: targetResponse.statusText,
        });
      }

      const responseHeaders = new Headers(corsHeaders);
      responseHeaders.set("Content-Type", "text/html; charset=utf-8");
      return new Response(modifiedHtml, {
        status: targetResponse.status,
        statusText: targetResponse.statusText,
        headers: responseHeaders,
      });
    } else {
      // Untuk konten non-HTML, gunakan streaming langsung agar konsumsi memori minimal
      const responseHeaders = new Headers(corsHeaders);
      // Salin header dari targetResponse, kecuali header sensitif atau yang dapat mengganggu
      for (const [key, value] of targetResponse.headers) {
        if (key.toLowerCase() === "content-encoding" || key.toLowerCase() === "content-length") {
          continue;
        }
        responseHeaders.set(key, value);
      }
      return new Response(targetResponse.body, {
        status: targetResponse.status,
        statusText: targetResponse.statusText,
        headers: responseHeaders,
      });
    }
  } catch (error) {
    console.error("Error fetching target:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

console.log(`Server proxy dengan CORS berjalan di port ${port}`);
serve(handler, { port });
