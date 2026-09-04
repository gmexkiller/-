import { TeacherApp } from '@/components/classroom/teacher-app';

export default async function TeacherPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <TeacherApp code={code} />;
}
