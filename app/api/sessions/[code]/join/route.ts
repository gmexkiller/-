import { database, hashToken, jsonError } from '@/lib/classroom-db';

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

  const db = database();
  const session = await db
    .prepare('SELECT group_count AS groupCount, submissions_paused AS paused FROM classroom_sessions WHERE code = ? AND expires_at > ?')
    .bind(code, new Date().toISOString())
    .first<{ groupCount: number; paused: number }>();
  if (!session) return jsonError('课堂码不存在或已过期', 404);
  if (groupNumber < 1 || groupNumber > session.groupCount) return jsonError('小组编号无效');

  const current = await db
    .prepare('SELECT device_token_hash AS tokenHash FROM classroom_groups WHERE session_code = ? AND group_number = ?')
    .bind(code, groupNumber)
    .first<{ tokenHash: string | null }>();
  const suppliedToken = body?.deviceToken;
  if (current?.tokenHash) {
    if (!suppliedToken || current.tokenHash !== (await hashToken(suppliedToken))) {
      return jsonError('这个小组已经加入，请选择其他小组', 409);
    }
    await db
      .prepare('UPDATE classroom_groups SET last_seen_at = ? WHERE session_code = ? AND group_number = ?')
      .bind(new Date().toISOString(), code, groupNumber)
      .run();
    return Response.json({ groupNumber, deviceToken: suppliedToken, reconnected: true });
  }

  const deviceToken = crypto.randomUUID() + crypto.randomUUID();
  const now = new Date().toISOString();
  const claim = await db
    .prepare(
      `UPDATE classroom_groups SET device_token_hash = ?, joined_at = ?, last_seen_at = ?
       WHERE session_code = ? AND group_number = ? AND device_token_hash IS NULL`,
    )
    .bind(await hashToken(deviceToken), now, now, code, groupNumber)
    .run();
  if (!claim.meta.changes) return jsonError('这个小组刚刚被认领，请选择其他小组', 409);
  return Response.json({ groupNumber, deviceToken, reconnected: false });
}
