import { env } from 'cloudflare:workers';

import type { ClassroomState, GroupRecord, Measurements } from '@/lib/classroom-types';
import {
  calculateRouteMetrics,
  isRoutePlan,
  legacyRoutePlan,
  normalizeRoutePlan,
  type RoutePlan,
} from '@/lib/route-design';

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
  engineeringRevealed: number;
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
  routePlanJson: string | null;
  status: GroupRecord['status'];
};

export async function readClassroom(code: string): Promise<ClassroomState | null> {
  const db = database();
  const session = await db
    .prepare(
      `SELECT code, group_count AS groupCount, scene, answer_revealed AS answerRevealed,
       engineering_revealed AS engineeringRevealed,
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
       conclusion, route_type AS routeType, route_reason AS routeReason,
       route_plan_json AS routePlanJson, status
       FROM classroom_groups WHERE session_code = ? ORDER BY group_number`,
    )
    .bind(code)
    .all<GroupRow>();

  function planFor(group: GroupRow): RoutePlan | null {
    if (group.routePlanJson) {
      try {
        const parsed = JSON.parse(group.routePlanJson) as unknown;
        if (isRoutePlan(parsed)) return normalizeRoutePlan(parsed);
      } catch {
        // Fall back to the legacy route fields below.
      }
    }
    return group.routeType ? legacyRoutePlan(group.routeType, group.routeReason || '') : null;
  }

  return {
    code: session.code,
    groupCount: session.groupCount,
    scene: session.scene,
    answerRevealed: Boolean(session.answerRevealed),
    engineeringRevealed: Boolean(session.engineeringRevealed),
    submissionsPaused: Boolean(session.submissionsPaused),
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    updatedAt: session.updatedAt,
    groups: result.results.map((group) => {
      const routePlan = planFor(group);
      return {
        groupNumber: group.groupNumber,
        joined: Boolean(group.deviceTokenHash),
        lastSeenAt: group.lastSeenAt,
        prediction: group.prediction,
        measurements: group.measurementsJson
          ? (JSON.parse(group.measurementsJson) as Measurements)
          : null,
        conclusion: group.conclusion,
        routeType: routePlan ? calculateRouteMetrics(routePlan).routeType : group.routeType,
        routeReason: routePlan?.reason || group.routeReason,
        routePlan,
        routeMetrics: routePlan ? calculateRouteMetrics(routePlan) : null,
        status: group.status,
      };
    }),
  };
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
