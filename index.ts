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
    "x-real-ip"
  ];
  for (const [key, value] of headers) {
    if (!forbidden.includes(key.toLowerCase())) {
      newHeaders.append(key, value);
    }
  }
  return newHeaders;
}

/**
 * Fungsi transformHTML menerapkan perbaikan SEO berupa:
 *
 * • Menghapus elemen yang tidak diinginkan (iklan, banner, dsb.).  
 * • Menambahkan meta tag (charset, viewport, keywords, description) bila belum ada.  
 * • Menambahkan tag canonical, dengan canonical URL yang diambil dari request (requestUrl.href).  
 * • Menyisipkan structured data JSON‑LD (schema.org) supaya mesin pencari dapat memahami konten.  
 * • Menambahkan lazy loading ke semua tag <img> dan <iframe>.  
 * • Mengubah setiap tag link (<a> dan <link>) yang memiliki href mengandung target,
 *   sehingga host-nya diganti dengan host dari URL permintaan (requestUrl.origin).
 * • Menambahkan blok internal linking (related links) jika belum ada.
 *
 * @param html - Konten HTML asli.
 * @param canonicalUrl - URL canonical yang diambil dari request (requestUrl.href).
 * @returns HTML yang telah dimodifikasi.
 */
function transformHTML(html: string, canonicalUrl: string): string {
  const $ = cheerio.load(html);

  // Hapus elemen yang tidak diinginkan.
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
    "#judi2"
  ].forEach(selector => $(selector).remove());

  // Tambahkan meta tag jika belum ada.
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

  // Jika belum ada canonical link, gunakan canonicalUrl dari request.
  let canonicalLink = $("link[rel='canonical']").attr("href");
  if (!canonicalLink) {
    canonicalLink = canonicalUrl;
    $("head").append(`<link rel="canonical" href="${canonicalLink}">`);
  }

  // Sisipkan structured data JSON‑LD untuk schema.org.
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": canonicalLink
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
  $("head").append(`<script type="application/ld+json">${JSON.stringify(structuredData)}</script>`);

  // Tambahkan lazy loading ke semua tag <img> dan <iframe>.
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

  // Ambil origin dari canonicalUrl (misalnya "http://yourhost.com").
  const currentOrigin = new URL(canonicalUrl).origin;

  // Ganti setiap tag link (<a> dan <link>) yang memiliki href berisi target
  // agar host-nya menggunakan currentOrigin.
  $("a[href], link[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href && href.startsWith(target)) {
      // Ganti target (misalnya "https://ww1.anoboy.app") dengan currentOrigin.
      const newHref = currentOrigin + href.slice(target.length);
      $(el).attr("href", newHref);
    }
  });

  // Sisipkan blok internal linking (related links) jika belum ada.
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
  // Pastikan DOCTYPE ada di awal dokumen.
  if (!/^<!DOCTYPE\s+/i.test(processedHtml)) {
    processedHtml = "<!DOCTYPE html>\n" + processedHtml;
  }
  return processedHtml;
}

/**
 * Handler untuk setiap request:
 * - Meneruskan request ke target dengan header yang sudah difilter.
 * - Jika respons bertipe HTML, lakukan transformasi untuk peningkatan SEO.
 */
async function handler(req: Request): Promise<Response> {
  // Buat URL permintaan lengkap dengan base dari header host (fallback ke localhost).
  const host = req.headers.get("host") || `localhost:${port}`;
  const requestUrl = new URL(req.url, `http://${host}`);

  // Tangani preflight CORS (OPTIONS).
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Bentuk URL target berdasarkan path dan query dari request.
  const targetUrl = new URL(target + requestUrl.pathname + requestUrl.search);

  try {
    // Filter header request agar tidak mengirim header sensitif.
    const filteredHeaders = filterRequestHeaders(req.headers);
    const targetResponse = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: filteredHeaders,
      body: req.body,
    });
    const contentType = targetResponse.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const htmlContent = await targetResponse.text();
      // Gunakan URL permintaan (requestUrl.href) sebagai canonical URL.
      const modifiedHtml = transformHTML(htmlContent, requestUrl.href);
      const responseHeaders = new Headers(corsHeaders);
      responseHeaders.set("Content-Type", "text/html; charset=utf-8");
      return new Response(modifiedHtml, {
        status: targetResponse.status,
        statusText: targetResponse.statusText,
        headers: responseHeaders,
      });
    } else {
      // Untuk respons non-HTML, teruskan body sebagai stream.
      const responseHeaders = new Headers(corsHeaders);
      for (const [key, value] of targetResponse.headers) {
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

console.log(`Server proxy dengan peningkatan SEO berjalan di port ${port}`);
serve(handler, { port });
