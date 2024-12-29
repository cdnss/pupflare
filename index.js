
import { load } from "cheerio";

// eslint-disable-next-line no-restricted-globals
addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Modify the referer header to match the allowed localhost IP
  let modifiedHeaders = new Headers(request.headers);
  let requestURL = new URL(request.url);

  console.log("Incoming request URL:", requestURL);
  modifiedHeaders.set("Host", "doujindesu.tv");
  modifiedHeaders.set("Referer", "https://doujindesu.tv/"); // Set a realistic Referer
  modifiedHeaders.set("Access-Control-Allow-Origin", "*");
  modifiedHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  modifiedHeaders.set("Access-Control-Allow-Headers", "Content-Type");
  modifiedHeaders.set("Access-Control-Allow-Credentials", "true"); // Allow credentials for POST requests
  modifiedHeaders.set(
    "User-Agent", 
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" // Use a popular browser's User-Agent
  );

  const baseUrl = requestURL.origin;
  var proxyUrl =
  "https://doujindesu.tv" + requestURL.pathname + requestURL.search;
  if( proxyUrl.includes(".webp")){
     proxyUrl =
  "https://desu.photos" + requestURL.pathname + requestURL.search;
  }
  console.log("Proxy URL:", proxyUrl);

  const defaultResponse = createDefaultResponse(baseUrl);

  if (proxyUrl && proxyUrl !== baseUrl + "/") {
    try {
      const url = new URL(proxyUrl);

      console.log("Fetching URL:", url.href);

      // Proxy the request to the specified URL
      let modifiedRequest = new Request(url.href, {
        method: request.method,
        headers: modifiedHeaders,
        body: request.body,
        redirect: "manual", // Prevent following redirects
      });    

      // Set content type and add empty body for POST requests to /themes/ajax/ch.php
      if (request.method === "POST" && requestURL.pathname === "/themes/ajax/ch.php") {
        modifiedHeaders.set("Content-Type", "application/x-www-form-urlencoded");
        if (!modifiedRequest.body) {
          modifiedRequest = new Request(modifiedRequest, { body: "" }); 
        }
      }

    let response = await fetch(modifiedRequest);

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

    // Add necessary CORS headers
    newResponseHeaders.set("Access-Control-Allow-Origin", "*");
    newResponseHeaders.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE"
    );
    newResponseHeaders.set("Access-Control-Allow-Headers", "Content-Type");
    newResponseHeaders.set("Access-Control-Allow-Credentials", "true"); // Allow credentials for POST requests

    // Modify the response body if it's HTML
    if (response.headers.get("content-type")?.includes("text/html")) {
      const responseBody = await response.text();
      const $ = load(responseBody);
      $("script:contains('mydomain'), script[src^=//], script:contains('disqus')").remove();    
      $("img").each(function () {
        var src = $(this).attr("src").replace("https://doujindesu.tv", "");
        $(this).attr("src", src)
      });
      $("body").append(`
        <script>
         $(document).ready( function(){

        $("#anu > img").each( function(){
        var src = $(this).attr("src").replace("https://desu.photos", "")
        $(this).attr("src", src)
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

    if (request.method === "OPTIONS") {
      console.log("Returning OPTIONS response");
      const optionsResponse = new Response(null, {
        headers: newResponseHeaders,
      });
      return optionsResponse;
    }

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
