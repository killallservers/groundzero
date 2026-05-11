import { db } from "@groundzero/core/db";
import { sessions } from "@groundzero/core/db/schema";
import { clarify } from "@groundzero/core/pipeline/clarify";
import { draft } from "@groundzero/core/pipeline/draft";
import { extract } from "@groundzero/core/pipeline/extract";
import { generate } from "@groundzero/core/pipeline/generate";
import { resolve } from "@groundzero/core/pipeline/resolve";
import type {
	PipelineEvent,
	PipelineState,
} from "@groundzero/core/pipeline/types";
import { buildZip } from "@groundzero/core/pipeline/zip";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AuthVariables } from "../middleware/session";

export const sessionsRouter = new Hono<{ Variables: AuthVariables }>();

sessionsRouter.post("/", async (c) => {
	const user = c.var.user;
	if (!user) return c.json({ error: "unauthorized" }, 401);

	const { idea } = await c.req.json<{ idea: string }>();
	if (!idea?.trim()) return c.json({ error: "idea is required" }, 400);

	const id = crypto.randomUUID();
	const now = new Date();
	const state: PipelineState = { idea };

	await db.insert(sessions).values({
		id,
		userId: user.id,
		stage: "extract",
		idea,
		state,
		createdAt: now,
		updatedAt: now,
	});

	return c.json({ sessionId: id }, 201);
});

sessionsRouter.get("/:id/stream", (c) => {
	const user = c.var.user;
	const id = c.req.param("id");

	return streamSSE(c, async (stream) => {
		const emit = async (event: PipelineEvent) => {
			await stream.writeSSE({ data: JSON.stringify(event) });
		};

		if (!user) {
			await emit({ type: "error", message: "unauthorized" });
			return;
		}

		const session = await db.query.sessions.findFirst({
			where: and(eq(sessions.id, id), eq(sessions.userId, user.id)),
		});
		if (!session) {
			await emit({ type: "error", message: "session not found" });
			return;
		}

		const state = session.state;

		try {
			await emit({ type: "stage", stage: "extract" });
			const extracted = await extract(state.idea);
			if (!extracted) throw new Error("extract returned no result");
			state.extracted = extracted;
			await emit({
				type: "extract:done",
				present: extracted.present,
				gaps: extracted.gaps,
			});

			await emit({ type: "stage", stage: "clarify" });
			const question = await clarify(state.idea, extracted.gaps);
			if (question) {
				await db
					.update(sessions)
					.set({ stage: "clarify", state, updatedAt: new Date() })
					.where(and(eq(sessions.id, id), eq(sessions.userId, user.id)));
				await emit({ type: "clarify:question", question });
			} else {
				await db
					.update(sessions)
					.set({ stage: "resolve", state, updatedAt: new Date() })
					.where(and(eq(sessions.id, id), eq(sessions.userId, user.id)));
				await emit({ type: "clarify:done" });
			}

			// Stream pauses here — client submits answers via POST /:id/answer or calls /run directly
		} catch (err) {
			await emit({
				type: "error",
				message: err instanceof Error ? err.message : "pipeline error",
			});
		}
	});
});

sessionsRouter.post("/:id/answer", async (c) => {
	const user = c.var.user;
	if (!user) return c.json({ error: "unauthorized" }, 401);

	const id = c.req.param("id");
	const { question, answer } = await c.req.json<{
		question: string;
		answer: string;
	}>();

	const session = await db.query.sessions.findFirst({
		where: and(eq(sessions.id, id), eq(sessions.userId, user.id)),
	});
	if (!session) return c.json({ error: "session not found" }, 404);

	const state = { ...session.state };
	const answers = { ...(state.answers ?? {}), [question]: answer };
	state.answers = answers;

	const nextQuestion = await clarify(
		state.idea,
		state.extracted?.gaps ?? [],
		answers,
	);

	await db
		.update(sessions)
		.set({
			stage: nextQuestion ? "clarify" : "resolve",
			state,
			updatedAt: new Date(),
		})
		.where(and(eq(sessions.id, id), eq(sessions.userId, user.id)));

	return c.json({ nextQuestion });
});

sessionsRouter.get("/:id/run", (c) => {
	const user = c.var.user;
	const id = c.req.param("id");

	return streamSSE(c, async (stream) => {
		const emit = async (event: PipelineEvent) => {
			await stream.writeSSE({ data: JSON.stringify(event) });
		};

		if (!user) {
			await emit({ type: "error", message: "unauthorized" });
			return;
		}

		const session = await db.query.sessions.findFirst({
			where: and(eq(sessions.id, id), eq(sessions.userId, user.id)),
		});
		if (!session || session.stage !== "resolve") {
			await emit({
				type: "error",
				message: "session not ready — submit answers first",
			});
			return;
		}

		const state = session.state;

		try {
			await emit({ type: "stage", stage: "resolve" });
			const resolved = await resolve(state.answers ?? {});
			state.resolved = resolved;
			await emit({ type: "resolve:done", packages: resolved });

			await emit({ type: "stage", stage: "draft" });
			const spec = await draft(state);
			state.spec = spec;
			await db
				.update(sessions)
				.set({ stage: "review", state, updatedAt: new Date() })
				.where(and(eq(sessions.id, id), eq(sessions.userId, user.id)));
			await emit({ type: "draft:done", spec });
			await emit({ type: "review:ready" });
		} catch (err) {
			await emit({
				type: "error",
				message: err instanceof Error ? err.message : "pipeline error",
			});
		}
	});
});

sessionsRouter.post("/:id/review", async (c) => {
	const user = c.var.user;
	if (!user) return c.json({ error: "unauthorized" }, 401);

	const id = c.req.param("id");
	const { action, spec } = await c.req.json<{
		action: "confirm" | "edit";
		spec?: string;
	}>();

	const session = await db.query.sessions.findFirst({
		where: and(eq(sessions.id, id), eq(sessions.userId, user.id)),
	});
	if (!session) return c.json({ error: "session not found" }, 404);

	const state = { ...session.state, ...(spec ? { spec } : {}) };
	await db
		.update(sessions)
		.set({
			stage: action === "confirm" ? "generate" : "draft",
			state,
			updatedAt: new Date(),
		})
		.where(and(eq(sessions.id, id), eq(sessions.userId, user.id)));

	return c.json({ ok: true });
});

sessionsRouter.get("/:id/generate", (c) => {
	const user = c.var.user;
	const id = c.req.param("id");

	return streamSSE(c, async (stream) => {
		const emit = async (event: PipelineEvent) => {
			await stream.writeSSE({ data: JSON.stringify(event) });
		};

		if (!user) {
			await emit({ type: "error", message: "unauthorized" });
			return;
		}

		const session = await db.query.sessions.findFirst({
			where: and(eq(sessions.id, id), eq(sessions.userId, user.id)),
		});
		if (!session || session.stage !== "generate") {
			await emit({
				type: "error",
				message: "session not ready — confirm review first",
			});
			return;
		}

		const state = session.state;

		try {
			await emit({ type: "stage", stage: "generate" });
			const files = await generate(state);
			state.files = files;
			await db
				.update(sessions)
				.set({ stage: "zip", state, updatedAt: new Date() })
				.where(and(eq(sessions.id, id), eq(sessions.userId, user.id)));
			await emit({ type: "generate:done", files });
			await db
				.update(sessions)
				.set({ stage: "done", state, updatedAt: new Date() })
				.where(and(eq(sessions.id, id), eq(sessions.userId, user.id)));
			await emit({ type: "zip:ready", sessionId: id });
		} catch (err) {
			await emit({
				type: "error",
				message: err instanceof Error ? err.message : "pipeline error",
			});
		}
	});
});

sessionsRouter.get("/:id/download", async (c) => {
	const user = c.var.user;
	if (!user) return c.json({ error: "unauthorized" }, 401);

	const id = c.req.param("id");

	const session = await db.query.sessions.findFirst({
		where: and(eq(sessions.id, id), eq(sessions.userId, user.id)),
	});
	if (!session) return c.json({ error: "session not found" }, 404);
	if (session.stage !== "done")
		return c.json({ error: "workspace not ready yet" }, 409);

	const files = session.state.files;
	if (!files || Object.keys(files).length === 0) {
		return c.json({ error: "no files generated" }, 500);
	}

	const zip = await buildZip(files);

	return new Response(zip, {
		headers: {
			"Content-Type": "application/zip",
			"Content-Disposition": `attachment; filename="groundzero-${id.slice(0, 8)}.zip"`,
		},
	});
});
