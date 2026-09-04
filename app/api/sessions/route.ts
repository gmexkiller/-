import { database, hashToken, jsonError } from '@/lib/classroom-db';

function randomCode() {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { groupCount?: number } | null;
  const groupCount = body?.groupCount;
  if (!Number.isInteger(groupCount) || !groupCount || groupCount < 4 || groupCount > 8) {
    return jsonError('小组数量必须在 4 到 8 之间');
  }

  const db = database();
  const teacherToken = crypto.randomUUID() + crypto.randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  let code = '';

  await db.prepare('DELETE FROM classroom_sessions WHERE expires_at <= ?').bind(now.toISOString()).run();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = randomCode();
    const existing = await db
      .prepare('SELECT code FROM classroom_sessions WHERE code = ? AND expires_at > ?')
      .bind(candidate, now.toISOString())
      .first();
    if (!existing) {
      code = candidate;
      break;
    }
  }
  if (!code) return jsonError('课堂码生成失败，请重试', 503);

  const sessionInsert = db
    .prepare(
      `INSERT INTO classroom_sessions
       (code, teacher_token_hash, group_count, scene, answer_revealed, submissions_paused, started_at, expires_at, updated_at)
       VALUES (?, ?, ?, 0, 0, 0, ?, ?, ?)`,
    )
    .bind(
      code,
      await hashToken(teacherToken),
      groupCount,
      now.toISOString(),
      expires.toISOString(),
      now.toISOString(),
    );
  const groupInserts = Array.from({ length: groupCount }, (_, index) =>
    db
      .prepare(
        'INSERT INTO classroom_groups (session_code, group_number, status) VALUES (?, ?, ?)',
      )
      .bind(code, index + 1, 'waiting'),
  );
  await db.batch([sessionInsert, ...groupInserts]);

  return Response.json({ code, teacherToken, expiresAt: expires.toISOString() }, { status: 201 });
}
