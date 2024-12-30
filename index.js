import { serve } from "https://deno.land/std/http/server.ts";
import { cheerio } from "https://deno.land/x/cheerio@1.0.7/mod.ts";


const config = {
  target: "https://doujindesu.tv",
  ignoreList: [
    "content-length",
    /^cf\-/,
    /^x\-forwarded\-/,
    "x-real-ip",
  ],
  timeout: 5000, // Timeout in milliseconds
};

const challengeMatch = Deno.env.get("CHALLENGE_MATCH");
if (challengeMatch) {
  console.log(`Using CHALLENGE_MATCH: ${challengeMatch}`);
};


function options(): Promise<Response> {
  const headers = {
    "Access-Control-Allow-Origin": config.target,
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers":
      "Date, Etag, Content-Length, Accept-Ranges, Content-Range, Server, Location",
    "Access-Control-Max-Age": "2073600",
  };
  const response = new Response(null, {
    headers,
    status: 204,
  });
  return Promise.resolve(response);
}

function error(code: number): Promise<Response> {
  const response = new Response(null, {
    status: code,
  });
  return Promise.resolve(response);
}

async function proxy(request: Request) :Promise<Response>{
  const { href, origin } = new URL(request.url);
  const url = new URL(href.replace(origin, ""), config.target).toString();



  async function getProxyRequest(req: Request): Promise<Request> {
    const { host } = new URL(url)
   const init = {
      body: req.body,
      cache: req.cache,
      headers: getRequestHeaders(req),
      keepalive: req.keepalive,
      method: req.method,
      redirect: "follow" as RequestRedirect,
    };
    if (req.method == "POST") {
      init.method = "POST";
    }
    return new Request(url, init);

    function getRequestHeaders(_req: Request) {
      const headers: Record<string, string> = {};
      [..._req.headers.entries()].forEach((kv) => {
        if (kv[0].toLowerCase() === "host") {
          return (headers["host"] = host);
        } else if (isIgnore(kv[0])) {
          return;
        } else {
          return (headers[kv[0]] = kv[1]);
        }
      });
      headers["referer"] = config.target;
      headers["user-agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
      return headers;

      function isIgnore(name: string) {
        for (const i of config.ignoreList) {
          if (typeof i === "string") {
            if (i === name.toLocaleLowerCase()) {
              return true;
            }
          }
          if (i instanceof RegExp) {
            if (i.test(name)) {
              return true;
            }
          }
        }
        return false;
      }
    }
  }

  async function getProxyResponse(req: Request): Promise<Response> {
    let resp: Response;
    try {
      resp = await fetch(req, { signal: AbortSignal.timeout(config.timeout) });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw err;
    }

    const headers = getResponseHeaders(resp);
    const status = resp.status;
    const body = resp.body;
    return new Response(body, {
      headers,
      status,
    });
    return response;

   function getResponseHeaders(_resp: Response): HeadersInit {
      const _headers = _resp.headers;
      const corsHeaders = {
        "Access-Control-Allow-Origin": config.target,
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Expose-Headers": [..._headers.keys()].join(", "),
        "Access-Control-Max-Age": "2073600",
      };

      const headers: Record<string, string> = {};
      [..._headers.entries()].forEach(
        (kv) => (headers[kv[0].toLocaleLowerCase()] = kv[1])
      );
      Object.entries(corsHeaders).forEach(
        (kv) => (headers[kv[0].toLocaleLowerCase()] = kv[1])
      );
      return headers;
    }

  }

  if (challengeMatch && proxyRequest.url.includes("cdn-cgi/challenge-platform/h/g/orchestrate/jsch/v1")) {
    try {
      const challengeResponse = await fetch(proxyRequest);
      const challengeText = await challengeResponse.text();
      const match = challengeText.match(new RegExp(challengeMatch));
      if (match) {
        return new Response(match[1], { headers: { "content-type": "text/plain" } });
      }
    } catch (err) {}
  }

  const proxyRequest = await getProxyRequest(request);
  const proxyResponse = await getProxyResponse(proxyRequest);
  const body = await proxyResponse.text();
  var $ = "";
  if (body.includes("html>")) {
    $ = cheerio.load(body);
  } else {
    $ = cheerio.load(body, null, false);
  }
  
   $("script:contains('mydomain'), script[src^=//], script:contains('disqus')").remove();    
   
  
  return new Response($.html(), {
    headers: proxyResponse.headers,
    status: proxyResponse.status,
  });

}

function logError(request: Request, error: Error, url: string = "", proxyRequest?: Request, proxyResponse?: Response) {
  const logObj = {
    time: new Date().toISOString(),
    type: "error",
    url,
    request: {
      url: request.url,
      method: request.method,
      headers: [...request.headers.entries()],
    },
    proxyRequest,
    proxyResponse,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
  };
  console.log(JSON.stringify(logObj));
}

async function handler(request: Request): Promise<Response> {
  let response;
  if (request.method === "OPTIONS") {
    response = await options();
  } else {
    try {
      response = await proxy(request);
    } catch (err) {
      logError(request, err, request.url);
      response = await error(500);
    }
  }

  return response;
}

serve(handler);
