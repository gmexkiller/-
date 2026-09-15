export const dynamic = 'force-dynamic';

export async function GET() {
  const local = process.env.CLASSROOM_STORAGE === 'local';
  return Response.json({
    mode: local ? 'lan' : 'cloud',
    joinOrigin: local ? process.env.CLASSROOM_LAN_ORIGIN || null : null,
  });
}
