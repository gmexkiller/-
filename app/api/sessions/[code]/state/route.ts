import {
  bearer,
  hashToken,
  isTeacher,
  jsonError,
  readClassroom,
  touchGroupByToken,
  updateAllGroups,
  updateGroupRecord,
  updateSessionRecord,
} from '@/lib/classroom-db';
import type { GroupRecord } from '@/lib/classroom-types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const classroom = await readClassroom(code);
  if (!classroom) return jsonError('课堂码不存在或已过期', 404);

  if (bearer(request)) {
    await touchGroupByToken(code, await hashToken(bearer(request)!));
  }
  return Response.json(classroom, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!(await isTeacher(request, code))) return jsonError('教师凭证无效', 401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError('请求内容无效');
  const now = new Date().toISOString();

  if (body.resetAll === true) {
    await updateSessionRecord(code, {
      scene: 4,
      answer_revealed: false,
      engineering_revealed: false,
      submissions_paused: false,
      updated_at: now,
    });
    await updateAllGroups(code, {
      prediction: null,
      measurements: null,
      conclusion: null,
      route_type: null,
      route_reason: null,
      route_plan: null,
      measurement_status: 'waiting',
      route_status: 'waiting',
      status: 'waiting',
    });
  } else if (typeof body.resetGroup === 'number') {
    await updateGroupRecord(code, body.resetGroup, {
      device_token_hash: null,
      joined_at: null,
      last_seen_at: null,
      prediction: null,
      measurements: null,
      conclusion: null,
      route_type: null,
      route_reason: null,
      route_plan: null,
      measurement_status: 'waiting',
      route_status: 'waiting',
      status: 'waiting',
    });
  } else if (typeof body.groupNumber === 'number' && typeof body.status === 'string') {
    const allowed = ['waiting', 'submitted', 'needs_changes', 'locked'];
    if (!allowed.includes(body.status)) return jsonError('小组状态无效');
    const task = body.task === 'route' ? 'route_status' : body.task === 'measurement' ? 'measurement_status' : null;
    await updateGroupRecord(code, body.groupNumber, task ? { [task]: body.status as GroupRecord['status'] } : { status: body.status as GroupRecord['status'], measurement_status: body.status as GroupRecord['measurementStatus'], route_status: body.status as GroupRecord['routeStatus'] });
  } else {
    const updates: {
      scene?: number;
      answer_revealed?: boolean;
      engineering_revealed?: boolean;
      submissions_paused?: boolean;
      updated_at: string;
    } = { updated_at: now };
    if (typeof body.scene === 'number') {
      updates.scene = Math.max(0, Math.min(8, Math.round(body.scene)));
    }
    if (typeof body.answerRevealed === 'boolean') {
      updates.answer_revealed = body.answerRevealed;
    }
    if (typeof body.engineeringRevealed === 'boolean') {
      updates.engineering_revealed = body.engineeringRevealed;
    }
    if (typeof body.submissionsPaused === 'boolean') {
      updates.submissions_paused = body.submissionsPaused;
    }
    if (Object.keys(updates).length === 1) return jsonError('没有可更新的课堂状态');
    await updateSessionRecord(code, updates);
  }

  const classroom = await readClassroom(code);
  return Response.json(classroom);
}
