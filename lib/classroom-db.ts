import { env } from 'cloudflare:workers';

import type { ClassroomState, GroupRecord, Measurements } from '@/lib/classroom-types';

export function database() {
  if (!env.DB) throw new Error('课堂数据库暂不可用');
  return env.DB;
}

export async function hashToken(token: string) {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function bearer(request: Request) {
  const header = request.headers.get('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

export async function isTeacher(request: Request, code: string) {
  const token = bearer(request);
  if (!token) return false;
  const row = await database()
    .prepare('SELECT teacher_token_hash AS tokenHash FROM classroom_sessions WHERE code = ?')
    .bind(code)
    .first<{ tokenHash: string }>();
  return Boolean(row && row.tokenHash === (await hashToken(token)));
}

export async function groupForToken(request: Request, code: string) {
  const token = bearer(request);
  if (!token) return null;
  return database()
    .prepare(
      'SELECT group_number AS groupNumber FROM classroom_groups WHERE session_code = ? AND device_token_hash = ?',
    )
    .bind(code, await hashToken(token))
    .first<{ groupNumber: number }>();
}

type SessionRow = {
  code: string;
  groupCount: number;
  scene: number;
  answerRevealed: number;
  submissionsPaused: number;
  startedAt: string;
  expiresAt: string;
  updatedAt: string;
};

type GroupRow = {
  groupNumber: number;
  deviceTokenHash: string | null;
  lastSeenAt: string | null;
  prediction: string | null;
  measurementsJson: string | null;
  conclusion: string | null;
  routeType: string | null;
  routeReason: string | null;
  status: GroupRecord['status'];
};

export async function readClassroom(code: string): Promise<ClassroomState | null> {
  const db = database();
  const session = await db
    .prepare(
      `SELECT code, group_count AS groupCount, scene, answer_revealed AS answerRevealed,
       submissions_paused AS submissionsPaused, started_at AS startedAt,
       expires_at AS expiresAt, updated_at AS updatedAt
       FROM classroom_sessions WHERE code = ? AND expires_at > ?`,
    )
    .bind(code, new Date().toISOString())
    .first<SessionRow>();
  if (!session) return null;

  const result = await db
    .prepare(
      `SELECT group_number AS groupNumber, device_token_hash AS deviceTokenHash,
       last_seen_at AS lastSeenAt, prediction, measurements_json AS measurementsJson,
       conclusion, route_type AS routeType, route_reason AS routeReason, status
       FROM classroom_groups WHERE session_code = ? ORDER BY group_number`,
    )
    .bind(code)
    .all<GroupRow>();

  return {
    code: session.code,
    groupCount: session.groupCount,
    scene: session.scene,
    answerRevealed: Boolean(session.answerRevealed),
    submissionsPaused: Boolean(session.submissionsPaused),
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    updatedAt: session.updatedAt,
    groups: result.results.map((group) => ({
      groupNumber: group.groupNumber,
      joined: Boolean(group.deviceTokenHash),
      lastSeenAt: group.lastSeenAt,
      prediction: group.prediction,
      measurements: group.measurementsJson
        ? (JSON.parse(group.measurementsJson) as Measurements)
        : null,
      conclusion: group.conclusion,
      routeType: group.routeType,
      routeReason: group.routeReason,
      status: group.status,
    })),
  };
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
