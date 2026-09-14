import {
  bearer,
  groupForToken,
  isTeacher,
  jsonError,
  readClassroom,
  updateGroupRecord,
} from '@/lib/classroom-db';
import { validateMeasurements } from '@/lib/classroom-types';
import {
  calculateRouteMetrics,
  isRoutePlan,
  legacyRoutePlan,
  normalizeRoutePlan,
  type RoutePlan,
} from '@/lib/route-design';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.kind !== 'string') return jsonError('提交内容无效');
  const classroom = await readClassroom(code);
  if (!classroom) return jsonError('课堂码不存在或已过期', 404);

  const teacher = await isTeacher(request, code);
  const claimedGroup = teacher
    ? typeof body.groupNumber === 'number'
      ? body.groupNumber
      : null
    : (await groupForToken(request, code))?.groupNumber;
  if (!claimedGroup || claimedGroup < 1 || claimedGroup > classroom.groupCount) {
    return jsonError(bearer(request) ? '小组身份无效' : '请先加入小组', 401);
  }
  if (classroom.submissionsPaused && !teacher) return jsonError('教师已暂停提交', 423);

  const now = new Date().toISOString();
  if (body.kind === 'prediction') {
    const allowed = ['直接搬', '找人帮忙', '使用斜面'];
    if (typeof body.value !== 'string' || !allowed.includes(body.value)) {
      return jsonError('请选择一种搬运方案');
    }
    await updateGroupRecord(code, claimedGroup, {
      prediction: body.value,
      status: 'submitted',
      last_seen_at: now,
    });
  } else if (body.kind === 'measurements') {
    if (!validateMeasurements(body.measurements)) {
      return jsonError('每种情况需要填写 3 次 0–20 N 的有效拉力');
    }
    const conclusion = typeof body.conclusion === 'string' ? body.conclusion.trim().slice(0, 120) : '';
    await updateGroupRecord(code, claimedGroup, {
      measurements: body.measurements,
      conclusion: conclusion || null,
      measurement_status: 'submitted',
      status: 'submitted',
      last_seen_at: now,
    });
  } else if (body.kind === 'route') {
    const allowed = ['直上路线', '折线路线', '盘绕路线'];
    let routePlan: RoutePlan;
    if (isRoutePlan(body.routePlan)) {
      routePlan = normalizeRoutePlan(body.routePlan);
    } else if (
      typeof body.routeType === 'string' &&
      allowed.includes(body.routeType) &&
      typeof body.reason === 'string' &&
      body.reason.trim().length >= 4
    ) {
      routePlan = legacyRoutePlan(body.routeType, body.reason.trim().slice(0, 120));
    } else {
      return jsonError('请完成路线设计、选择证据并说明理由');
    }
    const metrics = calculateRouteMetrics(routePlan);
    await updateGroupRecord(code, claimedGroup, {
      route_type: metrics.routeType,
      route_reason: routePlan.reason,
      route_plan: routePlan,
      route_status: 'submitted',
      status: 'submitted',
      last_seen_at: now,
    });
  } else {
    return jsonError('未知的提交类型');
  }
  return Response.json({ ok: true, groupNumber: claimedGroup });
}
