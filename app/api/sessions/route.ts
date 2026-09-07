import {
  createClassroomRecords,
  deleteExpiredClassrooms,
  hashToken,
  jsonError,
  sessionByCode,
} from '@/lib/classroom-db';

function randomCode() {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { groupCount?: number } | null;
  const groupCount = body?.groupCount;
  if (!Number.isInteger(groupCount) || !groupCount || groupCount < 4 || groupCount > 8) {
    return jsonError('小组数量必须在 4 到 8 之间');
  }

  const teacherToken = crypto.randomUUID() + crypto.randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  let code = '';

  await deleteExpiredClassrooms(now.toISOString());

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = randomCode();
    if (!(await sessionByCode(candidate))) {
      code = candidate;
      break;
    }
  }
  if (!code) return jsonError('课堂码生成失败，请重试', 503);

  await createClassroomRecords({
    code,
    teacherTokenHash: await hashToken(teacherToken),
    groupCount,
    startedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  });

  return Response.json({ code, teacherToken, expiresAt: expires.toISOString() }, { status: 201 });
}
