import { StudentApp } from '@/components/classroom/student-app';

export default async function StudentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <StudentApp code={code} />;
}
