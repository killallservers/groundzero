import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export type PipelineStage =
  | 'extract'
  | 'clarify'
  | 'resolve'
  | 'draft'
  | 'review'
  | 'generate'
  | 'zip'
  | 'done'

export type PipelineState = {
  idea: string
  extracted?: {
    present: string[]
    gaps: string[]
  }
  questions?: string[]
  answers?: Record<string, string>
  resolved?: {
    packages: Array<{ name: string; version: string; llmsTxt?: string }>
  }
  spec?: string
  files?: Record<string, string>
}

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  stage: text('stage').$type<PipelineStage>().notNull().default('extract'),
  idea: text('idea').notNull(),
  state: text('state', { mode: 'json' }).$type<PipelineState>().notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})
