import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  CreateClassroomInput,
  GroupRow,
  SessionRow,
} from '@/lib/classroom-storage-types';

type LocalClassroomStore = {
  sessions: SessionRow[];
  groups: GroupRow[];
};

const EMPTY_STORE: LocalClassroomStore = { sessions: [], groups: [] };
const configuredDataFile = process.env.CLASSROOM_DATA_FILE;
const dataFile = configuredDataFile
  ? path.resolve(/* turbopackIgnore: true */ configuredDataFile)
  : path.join(process.cwd(), 'data', 'local-classrooms.json');

let storePromise: Promise<LocalClassroomStore> | null = null;
let mutationQueue: Promise<void> = Promise.resolve();

async function loadStore() {
  try {
    const parsed = JSON.parse(
      await readFile(/* turbopackIgnore: true */ dataFile, 'utf8'),
    ) as unknown;
    if (!parsed || typeof parsed !== 'object') return structuredClone(EMPTY_STORE);
    const candidate = parsed as Partial<LocalClassroomStore>;
    return {
      sessions: Array.isArray(candidate.sessions) ? candidate.sessions : [],
      groups: Array.isArray(candidate.groups) ? candidate.groups : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return structuredClone(EMPTY_STORE);
    throw error;
  }
}

function store() {
  storePromise ??= loadStore();
  return storePromise;
}

async function persist(current: LocalClassroomStore) {
  await mkdir(path.dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
}

async function mutate<T>(change: (current: LocalClassroomStore) => T | Promise<T>) {
  let result!: T;
  const operation = mutationQueue.then(async () => {
    const current = await store();
    result = await change(current);
    await persist(current);
  });
  mutationQueue = operation.catch(() => undefined);
  await operation;
  return result;
}

export async function sessionByCode(code: string) {
  const current = await store();
  return current.sessions.find((session) => session.code === code) || null;
}

export async function groupByNumber(code: string, groupNumber: number) {
  const current = await store();
  return (
    current.groups.find(
      (group) => group.session_code === code && group.group_number === groupNumber,
    ) || null
  );
}

export async function groupsForSession(code: string) {
  const current = await store();
  return current.groups
    .filter((group) => group.session_code === code)
    .sort((left, right) => left.group_number - right.group_number);
}

export async function deleteExpiredClassrooms(now: string) {
  await mutate((current) => {
    const expiredCodes = new Set(
      current.sessions.filter((session) => session.expires_at <= now).map((session) => session.code),
    );
    current.sessions = current.sessions.filter((session) => !expiredCodes.has(session.code));
    current.groups = current.groups.filter((group) => !expiredCodes.has(group.session_code));
  });
}

export async function createClassroomRecords({
  code,
  teacherTokenHash,
  groupCount,
  startedAt,
  expiresAt,
}: CreateClassroomInput) {
  await mutate((current) => {
    if (current.sessions.some((session) => session.code === code)) {
      throw new Error('课堂码已经存在');
    }

    current.sessions.push({
      code,
      teacher_token_hash: teacherTokenHash,
      group_count: groupCount,
      scene: 4,
      answer_revealed: false,
      engineering_revealed: false,
      submissions_paused: false,
      started_at: startedAt,
      expires_at: expiresAt,
      updated_at: startedAt,
    });
    current.groups.push(
      ...Array.from({ length: groupCount }, (_, index): GroupRow => ({
        session_code: code,
        group_number: index + 1,
        device_token_hash: null,
        joined_at: null,
        last_seen_at: null,
        prediction: null,
        measurements: null,
        conclusion: null,
        route_type: null,
        route_reason: null,
        route_plan: null,
        status: 'waiting',
        measurement_status: 'waiting',
        route_status: 'waiting',
      })),
    );
  });
}

export async function updateSessionRecord(code: string, updates: Partial<SessionRow>) {
  await mutate((current) => {
    const index = current.sessions.findIndex((session) => session.code === code);
    if (index >= 0) current.sessions[index] = { ...current.sessions[index], ...updates };
  });
}

export async function updateGroupRecord(
  code: string,
  groupNumber: number,
  updates: Partial<GroupRow>,
) {
  await mutate((current) => {
    const index = current.groups.findIndex(
      (group) => group.session_code === code && group.group_number === groupNumber,
    );
    if (index >= 0) current.groups[index] = { ...current.groups[index], ...updates };
  });
}

export async function updateAllGroups(code: string, updates: Partial<GroupRow>) {
  await mutate((current) => {
    current.groups = current.groups.map((group) =>
      group.session_code === code ? { ...group, ...updates } : group,
    );
  });
}

export async function claimGroup(code: string, groupNumber: number, deviceTokenHash: string) {
  return mutate((current) => {
    const group = current.groups.find(
      (candidate) => candidate.session_code === code && candidate.group_number === groupNumber,
    );
    if (!group) return false;
    if (group.device_token_hash) return group.device_token_hash === deviceTokenHash;
    const now = new Date().toISOString();
    group.device_token_hash = deviceTokenHash;
    group.joined_at = now;
    group.last_seen_at = now;
    return true;
  });
}

export async function touchGroupByToken(code: string, tokenHash: string) {
  const current = await store();
  if (
    !current.groups.some(
      (candidate) =>
        candidate.session_code === code && candidate.device_token_hash === tokenHash,
    )
  ) {
    return;
  }

  await mutate((current) => {
    const group = current.groups.find(
      (candidate) =>
        candidate.session_code === code && candidate.device_token_hash === tokenHash,
    );
    if (group) group.last_seen_at = new Date().toISOString();
  });
}

export async function groupForTokenHash(code: string, tokenHash: string) {
  const current = await store();
  const group = current.groups.find(
    (candidate) => candidate.session_code === code && candidate.device_token_hash === tokenHash,
  );
  return group ? { group_number: group.group_number } : null;
}
