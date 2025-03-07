import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const target = "https://ww1.anoboy.app";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Origin, X-Requested-With, Content-Type, Accept",
};

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
    if (contentType.includes("text/html") && targetResponse.body) {
      // Gunakan HTMLRewriter untuk memproses stream HTML
      const transformedStream = new HTMLRewriter()
        // Hapus elemen <style> yang kosong
        .on("style", {
          element(el) {
            if (el.textContent.trim() === "") {
              el.remove();
            }
          },
        })
        // Ubah atribut href pada semua <a> sehingga menghapus base URL target
        .on("a", {
          element(el) {
            const href = el.getAttribute("href");
            if (href) {
              el.setAttribute("href", href.replace(target, ""));
            }
          },
        })
        // Hapus elemen yang tidak diinginkan (misalnya iklan)
        .on(".ads, .advertisement, .banner, .ad-container, .iklan, .sidebar-iklan, #ad_box, #ad_bawah, #judi, .widget_text, #judi2", {
          element(el) {
            el.remove();
          },
        })
        .transform(targetResponse.body);

      return new Response(transformedStream, {
        status: targetResponse.status,
        statusText: targetResponse.statusText,
        headers: new Headers({
          ...corsHeaders,
          "Content-Type": "text/html",
        }),
      });
    } else {
      // Jika bukan HTML, teruskan responsnya tanpa perubahan
      const headers = new Headers({
        ...corsHeaders,
      });
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
