export default function middleware(request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") || "";

  if (host === "hov.rettilomma.com" && (url.pathname === "/" || url.pathname === "")) {
    url.pathname = "/hovslager/index.html";
    return Response.redirect(url, 307);
  }

  if (host === "demo.hovslager.rettilomma.com" && (url.pathname === "/" || url.pathname === "")) {
    url.pathname = "/demo/index.html";
    return Response.redirect(url, 307);
  }

  return new Response(null, { status: 204 });
}

export const config = {
  matcher: ["/"]
};
