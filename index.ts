import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

// Konfigurasi melalui environment variable (atau gunakan default)
const target = Deno.env.get("TARGET_URL") || "https://ww1.anoboy.app";
const port = parseInt(Deno.env.get("PORT") || "8000");
const CACHE_TTL = parseInt(Deno.env.get("CACHE_TTL") || "60000"); // 60 detik

// Mekanisme caching sederhana untuk GET request dengan HTML
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
 * Fungsi untuk menyaring header request agar tidak mengirimkan header sensitif.
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
 * Fungsi transformHTML menerapkan perbaikan SEO berikut:
 * - Menghapus elemen (misalnya iklan) yang tidak diinginkan.
 * - Memodifikasi tautan <a> untuk menghilangkan base URL target.
 * - Menambahkan meta charset, viewport, keywords, dan canonical link jika belum ada.
 * - Menyisipkan markup JSON‑LD untuk structured data.
 * - Menambahkan atribut lazy loading pada semua tag <img> dan <iframe>.
 * - Menyisipkan blok tautan internal (related links) jika belum ada.
 *
 * @param html - Konten HTML asli.
 * @param canonicalUrl - URL canonical yang digunakan untuk halaman.
 * @returns HTML yang telah dimodifikasi.
 */
function transformHTML(html: string, canonicalUrl: string): string {
  const $ = cheerio.load(html);

  // Hapus elemen yang tidak diinginkan (misalnya: iklan dan banner)
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

  // Ubah tautan <a> agar tidak memuat base URL target
  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      $(el).attr("href", href.replace(target, ""));
    }
  });

  // Tambahkan meta tags jika tidak ada
  if ($("meta[charset]").length === 0) {
    $("head").prepend(`<meta charset="UTF-8">`);
  }
  if ($("meta[name='viewport']").length === 0) {
    $("head").append(`<meta name="viewport" content="width=device-width, initial-scale=1">`);
  }
  if ($("meta[name='keywords']").length === 0) {
    $("head").append(`<meta name="keywords" content="anime, streaming, subtitle indonesia, download anime">`);
  }
  if ($("meta[name='description']").length === 0) {
    $("head").append(`<meta name="description" content="Akses konten anime terbaru dengan subtitle Indonesia.">`);
  }
  if ($("link[rel='canonical']").length === 0) {
    $("head").append(`<link rel="canonical" href="${canonicalUrl}">`);
  }

  // Sisipkan structured data JSON‑LD untuk schema.org
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": canonicalUrl
    },
    "headline": $("title").text() || "Artikel Anime",
    "description": $("meta[name='description']").attr("content") || "",
    "author": {
      "@type": "Organization",
      "name": $("meta[name='author']").attr("content") || "anoBoy"
    },
    "publisher": {
      "@type": "Organization",
      "name": "anoBoy",
      "logo": {
        "@type": "ImageObject",
        "url": "https://ww1.anoboy.app/wp-content/uploads/2019/02/cropped-512x512-192x192.png"
      }
    },
    "datePublished": $("meta[property='article:published_time']").attr("content") || new Date().toISOString(),
    "dateModified": $("meta[property='article:modified_time']").attr("content") || new Date().toISOString()
  };

  $("head").append(
    `<script type="application/ld+json">${JSON.stringify(structuredData)}</script>`
  );

  // Tambahkan lazy loading ke semua <img> dan <iframe>
  $("img").each((_, el) => {
    if (!$(el).attr("loading")) {
      $(el).attr("loading", "lazy");
    }
  });
  $("iframe").each((_, el) => {
    if (!$(el).attr("loading")) {
      $(el).attr("loading", "lazy");
    }
  });

  // Tambahkan blok internal linking (related links) jika belum ada
  if ($("div.related-links").length === 0) {
    const relatedLinksHTML = `
      <div class="related-links">
        <h3>Rekomendasi Terkait:</h3>
        <ul>
          <li><a href="/category/comedy/">Anime Komedi</a></li>
          <li><a href="/category/harem/">Anime Harem</a></li>
          <li><a href="/category/school/">Anime Sekolah</a></li>
        </ul>
      </div>
    `;
    if ($("#footer").length > 0) {
      $("#footer").before(relatedLinksHTML);
    } else {
      $("body").append(relatedLinksHTML);
    }
  }

  let processedHtml = $.html();

  // Pastikan DOCTYPE ada di awal dokumen
  if (!/^<!DOCTYPE\s+/i.test(processedHtml)) {
    processedHtml = "<!DOCTYPE html>\n" + processedHtml;
  }
  return processedHtml;
}

/**
 * Handler untuk memproses setiap request.
 * - Menggunakan caching untuk GET request HTML.
 * - Filter header dan meneruskan request ke target.
 * - Melakukan transformasi HTML jika respons berjenis text/html.
 */
async function handler(req: Request): Promise<Response> {
  const requestUrl = new URL(req.url);

  // Tangani preflight CORS (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Bentuk URL target berdasarkan path dan query string
  const targetUrl = new URL(target + requestUrl.pathname + requestUrl.search);

  // Cek cache untuk GET request HTML
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
    // Filter header request untuk menghindari header sensitif
    const filteredHeaders = filterRequestHeaders(req.headers);
    const targetResponse = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: filteredHeaders,
      body: req.body,
    });

    const contentType = targetResponse.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const htmlContent = await targetResponse.text();
      // Lakukan transformasi HTML dengan penambahan perbaikan SEO
      const modifiedHtml = transformHTML(htmlContent, targetUrl.toString());

      // Simpan respons ke cache untuk GET request
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
      // Untuk respons non-HTML, teruskan body sebagai stream
      const responseHeaders = new Headers(corsHeaders);
      for (const [key, value] of targetResponse.headers) {
        // Lewati header tertentu
        if (
          key.toLowerCase() === "content-encoding" ||
          key.toLowerCase() === "content-length"
        ) {
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

console.log(`Server proxy dengan CORS dan peningkatan SEO berjalan di port ${port}`);
serve(handler, { port });
