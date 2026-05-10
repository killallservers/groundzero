import { db } from "@groundzero/core/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),
  plugins: [organization()],
  emailAndPassword: { enabled: true },
  secret: Bun.env.BETTER_AUTH_SECRET,
  baseURL: Bun.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  trustedOrigins: [Bun.env.WEB_URL ?? "http://localhost:5173"],
});
