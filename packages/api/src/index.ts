import { Hono } from "hono";
import { sessionsRouter } from "./routes/sessions";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/sessions", sessionsRouter);

export default {
  port: Bun.env.PORT ? Number(Bun.env.PORT) : 3000,
  fetch: app.fetch,
};
