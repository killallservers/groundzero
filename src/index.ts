import { Hono } from 'hono'
import { sessionsRouter } from './routes/sessions'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok' }))
app.route('/sessions', sessionsRouter)

export default {
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
  fetch: app.fetch,
}
