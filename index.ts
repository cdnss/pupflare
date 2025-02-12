import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

const target = "https://ww1.anoboy.app";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Origin, X-Requested-With, Content-Type, Accept",
};

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const targetUrl = new URL(target + url.pathname + url.search);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        ...corsHeaders,
      },
    });
  }

  try {
    const targetResponse = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });

    if (targetResponse.headers.get("Content-Type")?.includes("text/html")) {
      const html = await targetResponse.text();
      const $ = cheerio.load(html);


        const selectorToRemove = [
      ".ads",
      ".advertisement",
      ".banner",
      ".ad-container",
      ".iklan",
      ".sidebar-iklan",
      "#ad_box",
      "#ad_bawah",
      "#judi",
      
      "#coloma",
      "#colomb",
      ".widget_text",
      "#judi2",
    ];

        $('style').each((_, el) => {
            if ($(el).html() === ''){
                $(el).remove();
            }
        });


      // Remove elements with specific classes or IDs related to ads
      const selectorsToRemove = [".ads", ".advertisement", ".banner", ".ad-container", ".iklan", ".sidebar-iklan"];
      selectorToRemove.forEach(selector => {
        $(selector).remove();
      });


      // Modify anchor tag hrefs
      $("a").each((_, el) => {
        const element = $(el);
        let href = element.attr("href");
        if (href) {
          href = href.replace(target, "");
          $(el).attr("href", href);
        }
      });

      const modifiedHtml = $.html();

      const headers = new Headers({
        ...corsHeaders,

        "Content-Type": "text/html",
      });

      return new Response(modifiedHtml, {
        status: targetResponse.status,
        statusText: targetResponse.statusText,
        headers,
      });
    } else {
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
