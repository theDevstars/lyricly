export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== "GET") return response;

    const url = new URL(request.url);
    if (/\.[a-z0-9]+$/i.test(url.pathname)) return response;

    const notFound = await env.ASSETS.fetch(
      new Request(new URL("/404.html", url), {
        method: "GET",
        headers: request.headers,
      }),
    );
    if (!notFound.ok) return response;

    return new Response(notFound.body, {
      status: 404,
      headers: notFound.headers,
    });
  },
};
