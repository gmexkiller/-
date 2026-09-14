import cloudbase from '@cloudbase/node-sdk';
import type { IMySqlClient } from '@cloudbase/wx-cloud-client-sdk';

import type { ClassroomState, GroupRecord, Measurements } from '@/lib/classroom-types';
import {
  calculateRouteMetrics,
  isRoutePlan,
  legacyRoutePlan,
  normalizeRoutePlan,
  type RoutePlan,
} from '@/lib/route-design';

const SESSIONS = 'classroom_sessions';
const GROUPS = 'classroom_groups';

type SessionRow = {
  code: string;
  teacher_token_hash: string;
  group_count: number;
  scene: number;
  answer_revealed: boolean;
  engineering_revealed: boolean;
  submissions_paused: boolean;
  started_at: string;
  expires_at: string;
  updated_at: string;
};

type GroupRow = {
  session_code: string;
  group_number: number;
  device_token_hash: string | null;
  joined_at: string | null;
  last_seen_at: string | null;
  prediction: string | null;
  measurements: Measurements | null;
  conclusion: string | null;
  route_type: string | null;
  route_reason: string | null;
  route_plan: RoutePlan | null;
  status: GroupRecord['status'];
  measurement_status: GroupRecord['measurementStatus'];
  route_status: GroupRecord['routeStatus'];
};

type PgResult<T> = { data: T | null; error: { message?: string } | null };

let cloudbaseApp: ReturnType<typeof cloudbase.init> | null = null;
type CloudBaseWithRdb = ReturnType<typeof cloudbase.init> & { rdb: IMySqlClient };

function relationalDatabase() {
  if (!cloudbaseApp) {
    cloudbaseApp = cloudbase.init({
      env: process.env.CLOUDBASE_ENV_ID || cloudbase.SYMBOL_DEFAULT_ENV,
      accessKey: process.env.CLOUDBASE_APIKEY,
    });
  }
  return (cloudbaseApp as CloudBaseWithRdb).rdb({ database: 'public' });
}

function dataOrThrow<T>(result: PgResult<T>, operation: string): T {
  if (result.error) {
    throw new Error(`${operation}失败：${result.error.message || '数据库请求失败'}`);
  }
  return result.data as T;
}

export async function sessionByCode(code: string) {
  const result = (await relationalDatabase()
    .from(SESSIONS)
    .select('*')
    .eq('code', code)
    .maybeSingle()) as PgResult<SessionRow | null>;
  return dataOrThrow(result, '读取课堂');
}

export async function groupByNumber(code: string, groupNumber: number) {
  const result = (await relationalDatabase()
    .from(GROUPS)
    .select('*')
    .eq('session_code', code)
    .eq('group_number', groupNumber)
    .maybeSingle()) as PgResult<GroupRow | null>;
  return dataOrThrow(result, '读取小组');
}

export async function groupsForSession(code: string): Promise<GroupRow[]> {
  const result = (await relationalDatabase()
    .from(GROUPS)
    .select('*')
    .eq('session_code', code)
    .order('group_number', { ascending: true })) as PgResult<GroupRow[]>;
  return dataOrThrow(result, '读取小组列表') || [];
}

export async function deleteExpiredClassrooms(now: string) {
  const result = (await relationalDatabase()
    .from(SESSIONS)
    .delete()
    .lte('expires_at', now)) as PgResult<unknown>;
  dataOrThrow(result, '清理过期课堂');
}

export async function createClassroomRecords({
  code,
  teacherTokenHash,
  groupCount,
  startedAt,
  expiresAt,
}: {
  code: string;
  teacherTokenHash: string;
  groupCount: number;
  startedAt: string;
  expiresAt: string;
}) {
  const session: SessionRow = {
    code,
    teacher_token_hash: teacherTokenHash,
    group_count: groupCount,
    scene: 4,
    answer_revealed: false,
    engineering_revealed: false,
    submissions_paused: false,
    started_at: startedAt,
    expires_at: expiresAt,
    updated_at: startedAt,
  };
  const groups: GroupRow[] = Array.from({ length: groupCount }, (_, index) => ({
    session_code: code,
    group_number: index + 1,
    device_token_hash: null,
    joined_at: null,
    last_seen_at: null,
    prediction: null,
    measurements: null,
    conclusion: null,
    route_type: null,
    route_reason: null,
    route_plan: null,
    status: 'waiting',
    measurement_status: 'waiting',
    route_status: 'waiting',
  }));

  const sessionResult = (await relationalDatabase()
    .from(SESSIONS)
    .insert(session)) as PgResult<unknown>;
  dataOrThrow(sessionResult, '创建课堂');
  const groupResult = (await relationalDatabase().from(GROUPS).insert(groups)) as PgResult<unknown>;
  if (groupResult.error) {
    await relationalDatabase().from(SESSIONS).delete().eq('code', code);
    dataOrThrow(groupResult, '创建小组');
  }
}

export async function updateSessionRecord(code: string, updates: Partial<SessionRow>) {
  const result = (await relationalDatabase()
    .from(SESSIONS)
    .update(updates)
    .eq('code', code)) as PgResult<unknown>;
  dataOrThrow(result, '更新课堂');
}

export async function updateGroupRecord(
  code: string,
  groupNumber: number,
  updates: Partial<GroupRow>,
) {
  const result = (await relationalDatabase()
    .from(GROUPS)
    .update(updates)
    .eq('session_code', code)
    .eq('group_number', groupNumber)) as PgResult<unknown>;
  dataOrThrow(result, '更新小组');
}

export async function updateAllGroups(code: string, updates: Partial<GroupRow>) {
  const result = (await relationalDatabase()
    .from(GROUPS)
    .update(updates)
    .eq('session_code', code)) as PgResult<unknown>;
  dataOrThrow(result, '批量更新小组');
}

export async function claimGroup(code: string, groupNumber: number, deviceTokenHash: string) {
  const now = new Date().toISOString();
  const result = (await relationalDatabase()
    .from(GROUPS)
    .update({ device_token_hash: deviceTokenHash, joined_at: now, last_seen_at: now })
    .eq('session_code', code)
    .eq('group_number', groupNumber)
    .is('device_token_hash', null)
    .select('group_number')) as PgResult<Array<{ group_number: number }>>;
  const updated = dataOrThrow(result, '认领小组') || [];
  if (updated.length > 0) return true;
  const group = await groupByNumber(code, groupNumber);
  return group?.device_token_hash === deviceTokenHash;
}

export async function touchGroupByToken(code: string, tokenHash: string) {
  const result = (await relationalDatabase()
    .from(GROUPS)
    .update({ last_seen_at: new Date().toISOString() })
    .eq('session_code', code)
    .eq('device_token_hash', tokenHash)) as PgResult<unknown>;
  dataOrThrow(result, '更新在线状态');
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
  const session = await sessionByCode(code);
  return Boolean(session && session.teacher_token_hash === (await hashToken(token)));
}

export async function groupForToken(request: Request, code: string) {
  const token = bearer(request);
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const result = (await relationalDatabase()
    .from(GROUPS)
    .select('group_number')
    .eq('session_code', code)
    .eq('device_token_hash', tokenHash)
    .maybeSingle()) as PgResult<{ group_number: number } | null>;
  const group = dataOrThrow(result, '验证小组身份');
  return group ? { groupNumber: group.group_number } : null;
}

export async function readClassroom(code: string): Promise<ClassroomState | null> {
  const session = await sessionByCode(code);
  if (!session || session.expires_at <= new Date().toISOString()) return null;
  const groups = await groupsForSession(code);

  function planFor(group: GroupRow): RoutePlan | null {
    if (isRoutePlan(group.route_plan)) return normalizeRoutePlan(group.route_plan);
    return group.route_type ? legacyRoutePlan(group.route_type, group.route_reason || '') : null;
  }

  return {
    code: session.code,
    groupCount: session.group_count,
    scene: session.scene,
    answerRevealed: session.answer_revealed,
    engineeringRevealed: session.engineering_revealed,
    submissionsPaused: session.submissions_paused,
    startedAt: session.started_at,
    expiresAt: session.expires_at,
    updatedAt: session.updated_at,
    groups: groups.map((group) => {
      const routePlan = planFor(group);
      return {
        groupNumber: group.group_number,
        joined: Boolean(group.device_token_hash),
        lastSeenAt: group.last_seen_at,
        prediction: group.prediction,
        measurements: group.measurements,
        conclusion: group.conclusion,
        routeType: routePlan ? calculateRouteMetrics(routePlan).routeType : group.route_type,
        routeReason: routePlan?.reason || group.route_reason,
        routePlan,
        routeMetrics: routePlan ? calculateRouteMetrics(routePlan) : null,
        status: group.status,
        measurementStatus: group.measurement_status || (group.measurements ? group.status : 'waiting'),
        routeStatus: group.route_status || (routePlan ? group.status : 'waiting'),
      };
    }),
  };
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
