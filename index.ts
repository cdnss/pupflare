import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

const target = "https://ww1.anoboy.app";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Origin, X-Requested-With, Content-Type, Accept",
};

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

const combinedHeaders = { ...corsHeaders, ...securityHeaders };

async function handler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    // Validasi sederhana: pastikan path diawali dengan "/"
    if (!url.pathname.startsWith("/")) {
      return new Response("Bad Request", { status: 400, headers: combinedHeaders });
    }

    // Bangun URL target dari base URL dan path serta query string
    const targetUrl = new URL(target + url.pathname + url.search);

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: combinedHeaders });
    }

    const targetResponse = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });

    // Jika respons bertipe HTML, lakukan modifikasi menggunakan Cheerio
    if (targetResponse.headers.get("Content-Type")?.includes("text/html")) {
      const html = await targetResponse.text();
      const $ = cheerio.load(html);

      // Satu array untuk semua selektor yang akan dihapus
      const selectorsToRemove = [
        ".ads",
        ".advertisement",
        ".banner",
        ".ad-container",
        ".iklan",
        ".sidebar-iklan",
        "#ad_box",
        "#ad_bawah",
        "#judi",
        ".widget_text",
        "#judi2",
      ];

      // Hapus tag <style> kosong
      $("style").each((_, el) => {
        if ($(el).html().trim() === "") {
          $(el).remove();
        }
      });

      // Hapus elemen yang tidak diinginkan
      selectorsToRemove.forEach(selector => {
        $(selector).remove();
      });

      // Modifikasi tautan: jika href diawali dengan target, ubah menjadi tautan relatif
      $("a").each((_, el) => {
        const element = $(el);
        let href = element.attr("href");
        if (href && href.startsWith(target)) {
          href = href.replace(target, "");
          element.attr("href", href);
        }
      });

      const modifiedHtml = $.html();
      const headers = new Headers({
        ...combinedHeaders,
        "Content-Type": "text/html",
      });

      return new Response(modifiedHtml, {
        status: targetResponse.status,
        statusText: targetResponse.statusText,
        headers,
      });
    } else {
      // Untuk respons non-HTML, teruskan body dengan header gabungan
      const headers = new Headers(combinedHeaders);
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
    console.error("Error in handler:", error);
    return new Response("Internal Server Error", { status: 500, headers: combinedHeaders });
  }
}

console.log("CORS-enabled web server listening on port 8000");
serve(handler, { port: 8000 });
