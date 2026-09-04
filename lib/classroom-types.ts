export const CONDITIONS = [
  { key: 'lift', label: '直接提起', shortLabel: '直接' },
  { key: 'steep', label: '短木板（陡峭）', shortLabel: '陡峭' },
  { key: 'medium', label: '中木板（中等）', shortLabel: '中等' },
  { key: 'gentle', label: '长木板（平缓）', shortLabel: '平缓' },
] as const;

export type ConditionKey = (typeof CONDITIONS)[number]['key'];
export type Measurements = Record<ConditionKey, [number, number, number]>;

export type GroupRecord = {
  groupNumber: number;
  joined: boolean;
  lastSeenAt: string | null;
  prediction: string | null;
  measurements: Measurements | null;
  conclusion: string | null;
  routeType: string | null;
  routeReason: string | null;
  status: 'waiting' | 'submitted' | 'needs_changes' | 'locked';
};

export type ClassroomState = {
  code: string;
  groupCount: number;
  scene: number;
  answerRevealed: boolean;
  submissionsPaused: boolean;
  startedAt: string;
  expiresAt: string;
  updatedAt: string;
  groups: GroupRecord[];
};

export const EMPTY_MEASUREMENTS: Measurements = {
  lift: [0, 0, 0],
  steep: [0, 0, 0],
  medium: [0, 0, 0],
  gentle: [0, 0, 0],
};

export function average(values: number[]) {
  if (!values.length || values.some((value) => !Number.isFinite(value))) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

export function validateMeasurements(value: unknown): value is Measurements {
  if (!value || typeof value !== 'object') return false;
  return CONDITIONS.every(({ key }) => {
    const trials = (value as Record<string, unknown>)[key];
    return (
      Array.isArray(trials) &&
      trials.length === 3 &&
      trials.every(
        (trial) => typeof trial === 'number' && Number.isFinite(trial) && trial > 0 && trial <= 20,
      )
    );
  });
}
