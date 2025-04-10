const handler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  let pathname = url.pathname;

  // Default to index.html
  if (pathname === "/") {
    pathname = "/src/index.html";
  } else if (pathname.startsWith("/dist/")) {
    pathname = pathname;
  } else if (pathname.startsWith("/src/")) {
    pathname = pathname;
  } else if (pathname === "/style.css") {
    pathname = "/src/style.css";
  } else {
    // fallback to index.html for unknown paths
    pathname = "/src/index.html";
  }

  try {
    const file = await Deno.readFile(`.${pathname}`);
    const contentType = getContentType(pathname);
    return new Response(file, {
      status: 200,
      headers: { "content-type": contentType },
    });
  } catch {
    return new Response("404 Not Found", { status: 404 });
  }
};

function getContentType(path: string): string {
  if (path.endsWith(".html")) return "text/html";
  if (path.endsWith(".js")) return "application/javascript";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

const server = Deno.listen({ port: 0 });
console.log("Server running on:", `http://localhost:${(server.addr as Deno.NetAddr).port}`);

for await (const conn of server) {
  handleConn(conn);
}

async function handleConn(conn: Deno.Conn) {
  const httpConn = Deno.serveHttp(conn);
  for await (const requestEvent of httpConn) {
    requestEvent.respondWith(handler(requestEvent.request));
  }
}
