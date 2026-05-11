import index from "./index.html";

const server = Bun.serve({
  routes: {
    "/": index,
    "/api/*": async (req: Request) => {
      const url = new URL(req.url);
      url.hostname = "localhost";
      url.port = Bun.env.API_PORT ?? "5001";
      return fetch(new Request(url, req));
    },
  },
  development: Bun.env.NODE_ENV !== "production",
  port: Bun.env.PORT ? Number(Bun.env.PORT) : 5000,
});

console.log(`Web UI → http://localhost:${server.port}`);
