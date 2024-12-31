

import cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

import { serve } from "https://deno.land/std@0.188.0/http/server.ts";

serve(handleRequest);

async function handleRequest(request) {
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15",
  ];
  
  function generateRandomIP(): { ip: string; header: string } {
    const ip = Array.from({ length: 4 }, () =>
      Math.floor(Math.random() * 256)
    ).join(".");
    const header = `X-Forwarded-For: ${ip}`; // Or any other header you prefer
    return { ip, header };
  }  

  let modifiedHeaders = new Headers(request.headers);
  let requestURL = new URL(request.url);

  let { ip, header } = generateRandomIP(); // Generate initial IP

  console.log("Incoming request URL:", requestURL);
  modifiedHeaders.set("Host", "doujindesu.tv");
  modifiedHeaders.set("Referer", "https://doujindesu.tv/"); // Set a realistic Referer
  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  modifiedHeaders.set("User-Agent", randomUserAgent);
  modifiedHeaders.set("Connection", "keep-alive");

  const baseUrl = requestURL.origin;
  const proxyUrl =
    "https://doujindesu.tv" +
    requestURL.pathname +
    requestURL.search;

  console.log("Proxy URL:", proxyUrl);

  const defaultResponse = createDefaultResponse(baseUrl);

  if (proxyUrl && proxyUrl !== baseUrl + "/") {
    try {
      let url = new URL(proxyUrl);

      if (url.pathname.endsWith(".webp")) {
        url.href = `https://desu.photos${url.pathname}${url.search}`;
      }
      await new Promise(resolve => setTimeout(resolve, Math.random() * 4000 + 1000)); // Delay between 1 and 5 seconds
      console.log("Fetching URL:", url.href);    

      // Proxy the request to the specified URL
      let modifiedRequest = new Request(url.href, {
        method: request.method,
        headers: modifiedHeaders,
        body: request.body,
        redirect: "manual", // Prevent following redirects
      });    
      
      let response;
      let retryCount = 0;
      
      while (retryCount < 3 && (!response || response.status >= 400)) {
        try {
          // Regenerate IP for each retry
          const ipData = generateRandomIP();
          ip = ipData.ip;
          // Use Deno.connect with remoteAddr
          const conn = await Deno.connectTls({
            hostname: url.hostname,
            port: url.port 
              ? parseInt(url.port) 
              : url.protocol === 'https:' ? 443 : 80,
            transport: "tcp",
            remoteAddr: { hostname: ip, port: 0 }, // Use random IP for remoteAddr
          });
          response = await fetch(modifiedRequest, {
            createConnection: () => conn,
          });
          break;
        } catch (error) {
          console.error(`Error fetching (attempt ${retryCount + 1}):`, error);
          const delay = Math.floor(Math.random() * 2000) + 1000; // Random delay between 1 and 3 seconds
          await new Promise((resolve) => setTimeout(resolve, delay)); 
          retryCount++;
        }
      }

      if (!response) {
        console.error("Failed to fetch after multiple retries");
        return defaultResponse;
      }

    console.log("Response status:", response.status);

    // Support for redirected response
    if ([301, 302].includes(response.status)) {
      const redirectedUrl = response.headers.get("location");
      if (redirectedUrl) {
        console.log("Redirecting to:", redirectedUrl);
        const newModifiedRequest = new Request(
          new URL(redirectedUrl, baseUrl).href, {
          method: request.method,
          headers: modifiedHeaders,
          body: request.body,
          redirect: "manual", // Prevent following redirects
        });
        return handleRequest(newModifiedRequest);
      }
    }

    const newResponseHeaders = new Headers(response.headers);

    // Modify the response body if it's HTML
    if (response.headers.get("content-type")?.includes("text/html")) {
      const responseBody = await response.text();
      const $ = cheerio.load(responseBody);
      $("a[href*=kantong], script:contains('mydomain'), script[src^=//], script:contains('disqus')").remove();    

      $("a").each(function (_i, el) {
        const src = $(el).attr("href")?.replace("https://doujindesu.tv", "") ?? "";
        $(el).attr("href", src);
      });
      $("body").append(`
        <script>
         $(document).ready(function(){
          $("#anu > img").each(function(){
            var src = $(this).attr("src").replace("https://desu.photos", "");
            $(this).attr("src", src);
      })

         })
        </script>
      `)
      
      const modifiedBody = $.html();
      
      console.log("Returning modified HTML response");

      const htmlResponse = new Response(modifiedBody, {
        status: response.status,
        statusText: response.statusText,
        headers: newResponseHeaders,
      });
      return htmlResponse;
    }

    let newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newResponseHeaders,
    });

    console.log("Returning proxied response");
    return newResponse;
  } catch (error) {
    console.error("Error fetching or processing request:", error);
    return defaultResponse;
  }
  } else {
    return defaultResponse;
  }
}

function createDefaultResponse(baseUrl) {
  let htmlResponse = `<!DOCTYPE html>...`; // Your HTML response content
  return new Response(htmlResponse, {
    status: 200,
    statusText: "OK",
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
  }
