import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

// Konfigurasi melalui environment variable atau gunakan default
const target = Deno.env.get("TARGET_URL") || "https://ww1.anoboy.app";
const port = parseInt(Deno.env.get("PORT") || "8000");

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
 * Fungsi transformHTML menerapkan perbaikan SEO:
 *
 * • Memastikan canonicalUrl selalu menggunakan protokol HTTPS.  
 * • Menghapus elemen-elemen yang tidak diinginkan (iklan, banner, dsb.).  
 * • Menambahkan meta tag (charset, viewport, keywords, description) jika belum ada.  
 * • Menambahkan tag canonical dengan canonical URL yang diambil dari request (canonicalUrl).  
 * • Menyisipkan structured data JSON‑LD (schema.org).  
 * • Menambahkan atribut lazy loading ke semua tag <img> dan <iframe>.  
 * • Mengganti setiap tag link (<a> dan <link>) yang memiliki href yang diawali target, sehingga host-nya diubah menjadi host dari URL permintaan.
 *
 * @param html - Konten HTML asli.
 * @param canonicalUrl - Canonical URL yang diambil dari request (requestUrl.href).
 * @returns HTML yang telah dimodifikasi.
 */
function transformHTML(html: string, canonicalUrl: string): string {
  // Pastikan canonicalUrl diawali dengan 'https://'
  if (!canonicalUrl.startsWith("https://")) {
    canonicalUrl = "https://" + canonicalUrl.replace(/^https?:\/\//, "");
  }

  const $ = cheerio.load(html);

  // Hapus elemen yang tidak diinginkan
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

  // Tambahkan meta tag bila belum ada
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

  // Tambahkan tag canonical dengan canonicalUrl (override apa pun)
  $("head").append(`<link rel="canonical" href="${canonicalUrl}">`);

  // Sisipkan structured data JSON‑LD untuk schema.org
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    "headline": $("title").text() || "Artikel Anime",
    "description": $("meta[name='description']").attr("content") || "",
    "author": {
      "@type": "Organization",
      "name": $("meta[name='author']").attr("content") || "anoBoy",
    },
    "publisher": {
      "@type": "Organization",
      "name": "anoBoy",
      "logo": {
        "@type": "ImageObject",
        "url": "https://ww1.anoboy.app/wp-content/uploads/2019/02/cropped-512x512-192x192.png",
      },
    },
    "datePublished": $("meta[property='article:published_time']").attr("content") || new Date().toISOString(),
    "dateModified": $("meta[property='article:modified_time']").attr("content") || new Date().toISOString(),
  };
  $("head").append(`<script type="application/ld+json">${JSON.stringify(structuredData)}</script>`);

  // Tambahkan lazy loading ke semua tag <img> dan <iframe>
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

  // Ubah setiap tag link (<a> dan <link>) yang memiliki href yang mengandung target,
  // sehingga host-nya diganti dengan host dari canonicalUrl.
  const currentOrigin = new URL(canonicalUrl).origin;
  $("a[href], link[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href && href.startsWith(target)) {
      const newHref = currentOrigin + href.slice(target.length);
      $(el).attr("href", newHref);
    }
  });

  let processedHtml = $.html();
  if (!/^<!DOCTYPE\s+/i.test(processedHtml)) {
    processedHtml = "<!DOCTYPE html>\n" + processedHtml;
  }
  return processedHtml;
}

/**
 * Handler untuk setiap request:
 * - Menggunakan request URL dengan basis "https://" (meskipun header host mungkin berbeda).
 * - Meneruskan request ke target dengan header yang sudah difilter.
 * - Jika respons bertipe HTML, lakukan transformasi untuk peningkatan SEO.
 */
async function handler(req: Request): Promise<Response> {
  // Gunakan host dari header, namun force basis "https://"
  const host = req.headers.get("host") || `localhost:${port}`;
  const requestUrl = new URL(req.url, `https://${host}`);
  // Gunakan URL permintaan sebagai canonical URL (akan dipastikan menggunakan https)
  const canonicalUrl = requestUrl.href;

  // Tangani preflight CORS (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Bentuk URL target berdasarkan path & query dari request
  const targetUrl = new URL(target + requestUrl.pathname + requestUrl.search);

  try {
    const filteredHeaders = filterRequestHeaders(req.headers);
    const targetResponse = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: filteredHeaders,
      body: req.body,
    });
    const contentType = targetResponse.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const htmlContent = await targetResponse.text();
      const modifiedHtml = transformHTML(htmlContent, canonicalUrl);
      const responseHeaders = new Headers(corsHeaders);
      responseHeaders.set("Content-Type", "text/html; charset=utf-8");
      return new Response(modifiedHtml, {
        status: targetResponse.status,
        statusText: targetResponse.statusText,
        headers: responseHeaders,
      });
    } else {
      const responseHeaders = new Headers(corsHeaders);
      for (const [key, value] of targetResponse.headers) {
        if (key.toLowerCase() === "content-encoding" || key.toLowerCase() === "content-length") continue;
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

console.log(`Server proxy dengan peningkatan SEO berjalan di port ${port}`);
serve(handler, { port });
