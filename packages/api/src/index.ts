import { Hono } from "hono";
import { auth } from "./lib/auth";
import { sessionMiddleware } from "./middleware/session";
import { sessionsRouter } from "./routes/sessions";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

app.on(["GET", "POST"], "/auth/**", (c) => auth.handler(c.req.raw));

app.use("/sessions/*", sessionMiddleware);
app.route("/sessions", sessionsRouter);

export default {
  port: Bun.env.PORT ? Number(Bun.env.PORT) : 5001,
  fetch: app.fetch,
};
