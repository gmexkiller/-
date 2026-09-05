export const ROUTE_STRATEGIES = ['省力优先', '路程优先', '综合平衡'] as const;
export const ROUTE_EVIDENCE = ['坡度更缓', '路程更短', '转弯适中', '行驶更稳定'] as const;

export type RouteStrategy = (typeof ROUTE_STRATEGIES)[number];
export type RouteEvidence = (typeof ROUTE_EVIDENCE)[number];
export type RouteType = '直上路线' | '折线路线' | '盘绕路线';

export type RoutePlan = {
  waypointXs: [number, number, number];
  strategy: RouteStrategy;
  evidenceTags: RouteEvidence[];
  reason: string;
};

export type RouteMetrics = {
  lengthRatio: number;
  lengthLabel: '短' | '中' | '长';
  steepnessScore: number;
  steepnessLabel: '较陡' | '中等' | '较缓';
  turnCount: number;
  routeType: RouteType;
};

export const ROUTE_X_MIN = 0.12;
export const ROUTE_X_MAX = 0.88;
export const ROUTE_Y_LEVELS = [0.9, 0.7, 0.5, 0.3, 0.1] as const;

export const DEFAULT_ROUTE_PLAN: RoutePlan = {
  waypointXs: [0.35, 0.65, 0.35],
  strategy: '综合平衡',
  evidenceTags: ['坡度更缓', '行驶更稳定'],
  reason: '',
};

export function clampRouteX(value: number) {
  return Math.min(ROUTE_X_MAX, Math.max(ROUTE_X_MIN, Math.round(value * 100) / 100));
}

export function routePoints(plan: Pick<RoutePlan, 'waypointXs'>) {
  return [
    { x: 0.5, y: ROUTE_Y_LEVELS[0] },
    ...plan.waypointXs.map((x, index) => ({ x, y: ROUTE_Y_LEVELS[index + 1] })),
    { x: 0.5, y: ROUTE_Y_LEVELS[4] },
  ];
}

export function calculateRouteMetrics(plan: Pick<RoutePlan, 'waypointXs'>): RouteMetrics {
  const points = routePoints(plan);
  const segmentLengths = points.slice(1).map((point, index) => {
    const previous = points[index];
    const dx = (point.x - previous.x) * (4 / 3);
    const dy = previous.y - point.y;
    return Math.sqrt(dx * dx + dy * dy);
  });
  const total = segmentLengths.reduce((sum, value) => sum + value, 0);
  const lengthRatio = Math.round((total / 0.8) * 100) / 100;
  const steepnessScore = Math.round(
    Math.max(...segmentLengths.map((length) => 0.2 / length)) * 100,
  ) / 100;
  const directions = points
    .slice(1)
    .map((point, index) => Math.sign(point.x - points[index].x))
    .filter((direction) => direction !== 0);
  const turnCount = directions.slice(1).filter((direction, index) => direction !== directions[index]).length;

  return {
    lengthRatio,
    lengthLabel: lengthRatio <= 1.15 ? '短' : lengthRatio <= 1.9 ? '中' : '长',
    steepnessScore,
    steepnessLabel: steepnessScore > 0.88 ? '较陡' : steepnessScore > 0.62 ? '中等' : '较缓',
    turnCount,
    routeType: lengthRatio <= 1.15 ? '直上路线' : lengthRatio <= 2.1 ? '折线路线' : '盘绕路线',
  };
}

export function isRoutePlan(value: unknown): value is RoutePlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Record<string, unknown>;
  const waypointXs = plan.waypointXs;
  const evidenceTags = plan.evidenceTags;
  return (
    Array.isArray(waypointXs) &&
    waypointXs.length === 3 &&
    waypointXs.every(
      (point) =>
        typeof point === 'number' &&
        Number.isFinite(point) &&
        point >= ROUTE_X_MIN &&
        point <= ROUTE_X_MAX,
    ) &&
    typeof plan.strategy === 'string' &&
    ROUTE_STRATEGIES.includes(plan.strategy as RouteStrategy) &&
    Array.isArray(evidenceTags) &&
    evidenceTags.length >= 1 &&
    evidenceTags.length <= ROUTE_EVIDENCE.length &&
    new Set(evidenceTags).size === evidenceTags.length &&
    evidenceTags.every(
      (tag) => typeof tag === 'string' && ROUTE_EVIDENCE.includes(tag as RouteEvidence),
    ) &&
    typeof plan.reason === 'string' &&
    plan.reason.trim().length >= 4 &&
    plan.reason.trim().length <= 120
  );
}

export function normalizeRoutePlan(plan: RoutePlan): RoutePlan {
  return {
    waypointXs: plan.waypointXs.map(clampRouteX) as [number, number, number],
    strategy: plan.strategy,
    evidenceTags: [...new Set(plan.evidenceTags)] as RouteEvidence[],
    reason: plan.reason.trim().slice(0, 120),
  };
}

export function legacyRoutePlan(routeType: string, reason = ''): RoutePlan {
  const waypointXs: [number, number, number] =
    routeType === '直上路线'
      ? [0.5, 0.5, 0.5]
      : routeType === '盘绕路线'
        ? [0.14, 0.86, 0.14]
        : [0.34, 0.66, 0.34];
  return {
    waypointXs,
    strategy: routeType === '直上路线' ? '路程优先' : routeType === '盘绕路线' ? '省力优先' : '综合平衡',
    evidenceTags:
      routeType === '直上路线'
        ? ['路程更短']
        : routeType === '盘绕路线'
          ? ['坡度更缓', '行驶更稳定']
          : ['转弯适中', '行驶更稳定'],
    reason,
  };
}

export function routePath(plan: Pick<RoutePlan, 'waypointXs'>, width = 400, height = 300) {
  const points = routePoints(plan).map((point) => ({ x: point.x * width, y: point.y * height }));
  if (points.length < 2) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const previous = points[index - 1] || current;
    const following = points[index + 2] || next;
    const control1 = {
      x: current.x + (next.x - previous.x) / 6,
      y: current.y + (next.y - previous.y) / 6,
    };
    const control2 = {
      x: next.x - (following.x - current.x) / 6,
      y: next.y - (following.y - current.y) / 6,
    };
    path += ` C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${next.x} ${next.y}`;
  }
  return path;
}
