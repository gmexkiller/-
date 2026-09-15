export type MountainNode = {
  radius: number;
  angle: number;
};

export type MountainRoad = {
  version: 1;
  nodes: MountainNode[];
  complete: boolean;
};

export type MountainPoint = MountainNode & {
  x: number;
  y: number;
  z: number;
};

export const MOUNTAIN_RADIUS = 4;
export const MOUNTAIN_HEIGHT = 4.2;
export const MIN_ROAD_NODES = 4;
export const MAX_ROAD_NODES = 12;

export const EMPTY_MOUNTAIN_ROAD: MountainRoad = {
  version: 1,
  nodes: [{ radius: 1, angle: Math.PI / 2 }],
  complete: false,
};

export const DEFAULT_MOUNTAIN_ROAD: MountainRoad = {
  version: 1,
  nodes: [
    { radius: 1, angle: Math.PI / 2 },
    { radius: 0.78, angle: 2.65 },
    { radius: 0.55, angle: 0.7 },
    { radius: 0.32, angle: 2.5 },
    { radius: 0.12, angle: 1.1 },
    { radius: 0, angle: 1.1 },
  ],
  complete: true,
};

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeAngleNear(angle: number, reference: number) {
  let result = angle;
  while (result - reference > Math.PI) result -= Math.PI * 2;
  while (result - reference < -Math.PI) result += Math.PI * 2;
  return result;
}

export function mountainHeight(radius: number) {
  const normalized = clamp(radius, 0, 1);
  return MOUNTAIN_HEIGHT * (1 - normalized * normalized);
}

export function mountainPoint(node: MountainNode, clearance = 0.12): MountainPoint {
  const radius = clamp(node.radius, 0, 1);
  return {
    ...node,
    radius,
    x: MOUNTAIN_RADIUS * radius * Math.cos(node.angle),
    y: mountainHeight(radius) + clearance,
    z: MOUNTAIN_RADIUS * radius * Math.sin(node.angle),
  };
}

export function normalizeMountainRoad(road: MountainRoad): MountainRoad {
  const nodes = road.nodes.slice(0, MAX_ROAD_NODES).map((node, index, source) => {
    if (index === 0) return { radius: 1, angle: Math.round(node.angle * 1000) / 1000 };
    if (road.complete && index === source.length - 1) {
      return { radius: 0, angle: Math.round(node.angle * 1000) / 1000 };
    }
    return {
      radius: Math.round(clamp(node.radius, 0.08, 0.94) * 1000) / 1000,
      angle: Math.round(node.angle * 1000) / 1000,
    };
  });
  return { version: 1, nodes, complete: Boolean(road.complete) };
}

export function validateMountainRoad(road: unknown, requireComplete = false) {
  if (!road || typeof road !== 'object') return '缺少山地路线';
  const value = road as Record<string, unknown>;
  if (value.version !== 1 || !Array.isArray(value.nodes)) return '山地路线格式不正确';
  const nodes = value.nodes as unknown[];
  if (nodes.length < 1 || nodes.length > MAX_ROAD_NODES) return '道路节点数量不正确';
  if (requireComplete && (value.complete !== true || nodes.length < MIN_ROAD_NODES)) return `请至少设置 ${MIN_ROAD_NODES} 个节点并连接山顶`;
  for (const [index, node] of nodes.entries()) {
    if (!node || typeof node !== 'object') return '道路节点格式不正确';
    const point = node as Record<string, unknown>;
    if (typeof point.radius !== 'number' || !Number.isFinite(point.radius) || point.radius < 0 || point.radius > 1) return '道路节点超出山体';
    if (typeof point.angle !== 'number' || !Number.isFinite(point.angle) || Math.abs(point.angle) > 100) return '道路节点方向不正确';
    if (index > 0) {
      const previous = nodes[index - 1] as MountainNode;
      if (point.radius >= previous.radius - 0.015) return '道路必须逐段向山顶上升';
      if (Math.abs((point.angle as number) - previous.angle) > Math.PI + 0.02) return '单段道路绕行角度过大';
    }
  }
  const first = nodes[0] as MountainNode;
  if (Math.abs(first.radius - 1) > 0.01) return '路线必须从山脚出发';
  if (value.complete === true) {
    const last = nodes[nodes.length - 1] as MountainNode;
    if (last.radius > 0.015) return '完成的路线必须连接山顶';
  }
  return null;
}

export function sampleMountainRoad(road: MountainRoad, samplesPerSegment = 12) {
  const sampled: MountainPoint[] = [];
  for (let segment = 0; segment < road.nodes.length - 1; segment += 1) {
    const start = road.nodes[segment];
    const end = road.nodes[segment + 1];
    for (let step = 0; step < samplesPerSegment; step += 1) {
      const progress = step / samplesPerSegment;
      const smooth = progress * progress * (3 - 2 * progress);
      sampled.push(mountainPoint({
        radius: start.radius + (end.radius - start.radius) * progress,
        angle: start.angle + (end.angle - start.angle) * smooth,
      }));
    }
  }
  if (road.nodes.length) sampled.push(mountainPoint(road.nodes[road.nodes.length - 1]));
  return sampled;
}

export function calculateMountainMetrics(road: MountainRoad) {
  const nodes = road.nodes.map((node) => mountainPoint(node));
  const segments = nodes.slice(1).map((point, index) => {
    const previous = nodes[index];
    const horizontal = Math.hypot(point.x - previous.x, point.z - previous.z);
    const vertical = Math.abs(point.y - previous.y);
    return {
      length: Math.hypot(horizontal, vertical),
      steepness: vertical / Math.max(horizontal, 0.08),
      angleChange: index === 0 ? 0 : Math.abs(road.nodes[index + 1].angle - road.nodes[index].angle),
    };
  });
  const directLength = Math.hypot(MOUNTAIN_RADIUS, MOUNTAIN_HEIGHT);
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  const steepest = segments.reduce((best, segment, index) => segment.steepness > best.value ? { value: segment.steepness, index } : best, { value: 0, index: 0 });
  const lengthRatio = Math.round((total / directLength) * 100) / 100;
  const turnAngles = nodes.slice(1, -1).map((point, index) => {
    const before = nodes[index];
    const after = nodes[index + 2];
    const first = { x: point.x - before.x, y: point.z - before.z };
    const second = { x: after.x - point.x, y: after.z - point.z };
    const denominator = Math.max(0.001, Math.hypot(first.x, first.y) * Math.hypot(second.x, second.y));
    return Math.acos(clamp((first.x * second.x + first.y * second.y) / denominator, -1, 1));
  });
  const turnCount = turnAngles.filter((angle) => angle > 0.18).length;
  const sharpTurns = turnAngles.filter((angle) => angle > 1.15).length;
  const steepnessScore = Math.round(steepest.value * 100) / 100;
  return {
    lengthRatio,
    lengthLabel: (lengthRatio <= 1.16 ? '短' : lengthRatio <= 1.65 ? '中' : '长') as '短' | '中' | '长',
    steepnessScore,
    steepnessLabel: (steepnessScore > 0.9 ? '较陡' : steepnessScore > 0.55 ? '中等' : '较缓') as '较陡' | '中等' | '较缓',
    turnCount,
    sharpTurns,
    steepestSegment: steepest.index,
    routeType: (lengthRatio <= 1.16 ? '直上路线' : lengthRatio <= 1.7 ? '折线路线' : '盘绕路线') as '直上路线' | '折线路线' | '盘绕路线',
  };
}

export function legacyMountainRoad(waypointXs: [number, number, number]): MountainRoad {
  const radii = [1, 0.76, 0.52, 0.28, 0];
  const xs = [0.5, ...waypointXs, 0.5];
  const angles: number[] = [Math.PI / 2];
  for (let index = 1; index < xs.length; index += 1) {
    const target = Math.PI / 2 + (xs[index] - 0.5) * Math.PI * 2.2;
    angles.push(normalizeAngleNear(target, angles[index - 1]));
  }
  return {
    version: 1,
    complete: true,
    nodes: radii.map((radius, index) => ({ radius, angle: angles[index] })),
  };
}

export function projectMountainRoad(road: MountainRoad): [number, number, number] {
  const interior = road.nodes.filter((node) => node.radius > 0.02 && node.radius < 0.98);
  if (!interior.length) return [0.5, 0.5, 0.5];
  return [0.25, 0.5, 0.75].map((fraction) => {
    const node = interior[Math.min(interior.length - 1, Math.round((interior.length - 1) * fraction))];
    return Math.round(clamp(0.5 + Math.cos(node.angle) * 0.36, 0.12, 0.88) * 100) / 100;
  }) as [number, number, number];
}
