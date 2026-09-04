import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const classroomSessions = sqliteTable(
  'classroom_sessions',
  {
    code: text('code').primaryKey(),
    teacherTokenHash: text('teacher_token_hash').notNull(),
    groupCount: integer('group_count').notNull(),
    scene: integer('scene').notNull().default(0),
    answerRevealed: integer('answer_revealed', { mode: 'boolean' }).notNull().default(false),
    submissionsPaused: integer('submissions_paused', { mode: 'boolean' }).notNull().default(false),
    startedAt: text('started_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('idx_classroom_sessions_expires_at').on(table.expiresAt)],
);

export const classroomGroups = sqliteTable(
  'classroom_groups',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionCode: text('session_code')
      .notNull()
      .references(() => classroomSessions.code, { onDelete: 'cascade' }),
    groupNumber: integer('group_number').notNull(),
    deviceTokenHash: text('device_token_hash'),
    joinedAt: text('joined_at'),
    lastSeenAt: text('last_seen_at'),
    prediction: text('prediction'),
    measurementsJson: text('measurements_json'),
    conclusion: text('conclusion'),
    routeType: text('route_type'),
    routeReason: text('route_reason'),
    status: text('status').notNull().default('waiting'),
  },
  (table) => [
    uniqueIndex('idx_classroom_groups_session_number').on(table.sessionCode, table.groupNumber),
    index('idx_classroom_groups_session').on(table.sessionCode),
  ],
);
