import {
  claimGroup,
  groupByNumber,
  hashToken,
  jsonError,
  sessionByCode,
  updateGroupRecord,
} from '@/lib/classroom-db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body = (await request.json().catch(() => null)) as {
    groupNumber?: number;
    deviceToken?: string;
  } | null;
  const groupNumber = body?.groupNumber;
  if (!Number.isInteger(groupNumber) || !groupNumber) return jsonError('请选择小组');

  const session = await sessionByCode(code);
  if (!session || session.expires_at <= new Date().toISOString()) {
    return jsonError('课堂码不存在或已过期', 404);
  }
  if (groupNumber < 1 || groupNumber > session.group_count) return jsonError('小组编号无效');

  const current = await groupByNumber(code, groupNumber);
  const suppliedToken = body?.deviceToken;
  if (current?.device_token_hash) {
    if (!suppliedToken || current.device_token_hash !== (await hashToken(suppliedToken))) {
      return jsonError('这个小组已经加入，请选择其他小组', 409);
    }
    await updateGroupRecord(code, groupNumber, { last_seen_at: new Date().toISOString() });
    return Response.json({ groupNumber, deviceToken: suppliedToken, reconnected: true });
  }

  const deviceToken = crypto.randomUUID() + crypto.randomUUID();
  if (!(await claimGroup(code, groupNumber, await hashToken(deviceToken)))) {
    return jsonError('这个小组刚刚被认领，请选择其他小组', 409);
  }
  return Response.json({ groupNumber, deviceToken, reconnected: false });
}
