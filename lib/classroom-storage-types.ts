import type { GroupRecord, Measurements } from '@/lib/classroom-types';
import type { RoutePlan } from '@/lib/route-design';

export type SessionRow = {
  code: string;
  teacher_token_hash: string;
  group_count: number;
  scene: number;
  answer_revealed: boolean;
  engineering_revealed: boolean;
  submissions_paused: boolean;
  started_at: string;
  expires_at: string;
  updated_at: string;
};

export type GroupRow = {
  session_code: string;
  group_number: number;
  device_token_hash: string | null;
  joined_at: string | null;
  last_seen_at: string | null;
  prediction: string | null;
  measurements: Measurements | null;
  conclusion: string | null;
  route_type: string | null;
  route_reason: string | null;
  route_plan: RoutePlan | null;
  status: GroupRecord['status'];
  measurement_status: GroupRecord['measurementStatus'];
  route_status: GroupRecord['routeStatus'];
};

export type CreateClassroomInput = {
  code: string;
  teacherTokenHash: string;
  groupCount: number;
  startedAt: string;
  expiresAt: string;
};
