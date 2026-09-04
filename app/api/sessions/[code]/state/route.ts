import { bearer, database, isTeacher, jsonError, readClassroom } from '@/lib/classroom-db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const classroom = await readClassroom(code);
  if (!classroom) return jsonError('课堂码不存在或已过期', 404);

  if (bearer(request)) {
    const now = new Date().toISOString();
    await database()
      .prepare('UPDATE classroom_groups SET last_seen_at = ? WHERE session_code = ? AND device_token_hash = ?')
      .bind(now, code, await (async () => {
        const token = bearer(request)!;
        const data = new TextEncoder().encode(token);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
      })())
      .run();
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
  const db = database();
  const now = new Date().toISOString();

  if (body.resetAll === true) {
    await db.batch([
      db
        .prepare(
          'UPDATE classroom_sessions SET scene = 0, answer_revealed = 0, submissions_paused = 0, updated_at = ? WHERE code = ?',
        )
        .bind(now, code),
      db
        .prepare(
          `UPDATE classroom_groups SET prediction = NULL, measurements_json = NULL, conclusion = NULL,
           route_type = NULL, route_reason = NULL, status = 'waiting' WHERE session_code = ?`,
        )
        .bind(code),
    ]);
  } else if (typeof body.resetGroup === 'number') {
    await db
      .prepare(
        `UPDATE classroom_groups SET device_token_hash = NULL, joined_at = NULL, last_seen_at = NULL,
         prediction = NULL, measurements_json = NULL, conclusion = NULL, route_type = NULL,
         route_reason = NULL, status = 'waiting' WHERE session_code = ? AND group_number = ?`,
      )
      .bind(code, body.resetGroup)
      .run();
  } else if (typeof body.groupNumber === 'number' && typeof body.status === 'string') {
    const allowed = ['waiting', 'submitted', 'needs_changes', 'locked'];
    if (!allowed.includes(body.status)) return jsonError('小组状态无效');
    await db
      .prepare('UPDATE classroom_groups SET status = ? WHERE session_code = ? AND group_number = ?')
      .bind(body.status, code, body.groupNumber)
      .run();
  } else {
    const updates: string[] = [];
    const values: unknown[] = [];
    if (typeof body.scene === 'number') {
      updates.push('scene = ?');
      values.push(Math.max(0, Math.min(8, Math.round(body.scene))));
    }
    if (typeof body.answerRevealed === 'boolean') {
      updates.push('answer_revealed = ?');
      values.push(body.answerRevealed ? 1 : 0);
    }
    if (typeof body.submissionsPaused === 'boolean') {
      updates.push('submissions_paused = ?');
      values.push(body.submissionsPaused ? 1 : 0);
    }
    if (!updates.length) return jsonError('没有可更新的课堂状态');
    updates.push('updated_at = ?');
    values.push(now, code);
    await db
      .prepare(`UPDATE classroom_sessions SET ${updates.join(', ')} WHERE code = ?`)
      .bind(...values)
      .run();
  }

  const classroom = await readClassroom(code);
  return Response.json(classroom);
}
