'use client';

/* oxlint-disable jsx-a11y/prefer-tag-over-role -- SVG map and SVG handles require these ARIA roles. */

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

import {
  clampRouteX,
  routePath,
  routePoints,
  ROUTE_X_MAX,
  ROUTE_X_MIN,
  type RoutePlan,
} from '@/lib/route-design';

export const GROUP_ROUTE_COLORS = [
  '#1769aa',
  '#f47c20',
  '#1f9d71',
  '#7c3aed',
  '#db2777',
  '#0f766e',
  '#b45309',
  '#475569',
];

type RouteMapProps = {
  plan: RoutePlan;
  color?: string;
  groupNumber?: number;
  editable?: boolean;
  compact?: boolean;
  animateKey?: number;
  onChange?: (plan: RoutePlan) => void;
  className?: string;
};

function MapBackdrop({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-land`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e5f4dc" />
          <stop offset="1" stopColor="#9dcc82" />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#123a5a" floodOpacity="0.2" />
        </filter>
      </defs>
      <rect width="400" height="300" rx="24" fill={`url(#${id}-land)`} />
      {[44, 82, 122, 164, 207, 250].map((y, index) => (
        <path
          key={y}
          d={`M ${28 + index * 7} ${y} C 98 ${y - 18}, 302 ${y + 18}, ${372 - index * 7} ${y}`}
          fill="none"
          stroke="#4f8c55"
          strokeOpacity="0.26"
          strokeWidth="2"
        />
      ))}
      <path d="M 0 278 C 92 250, 302 270, 400 246 L 400 300 L 0 300 Z" fill="#7eb36c" />
      <circle cx="200" cy="30" r="18" fill="#fff4d9" stroke="#f47c20" strokeWidth="4" />
      <path d="M 191 30 L 198 37 L 211 22" fill="none" stroke="#f47c20" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="160" y="268" width="80" height="22" rx="11" fill="#123a5a" />
      <text x="200" y="283" textAnchor="middle" fontSize="13" fontWeight="800" fill="white">山脚起点</text>
      <text x="200" y="12" textAnchor="middle" fontSize="12" fontWeight="800" fill="#166534">山顶目标</text>
    </>
  );
}

function RouteTruck({ path, color, animateKey }: { path: string; color: string; animateKey: number }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  if (!animateKey || reduceMotion) return null;
  return (
    <g key={animateKey} aria-hidden="true" filter="url(#route-truck-shadow)">
      <rect x="-13" y="-8" width="18" height="13" rx="3" fill={color} />
      <path d="M 5 -5 H 11 L 15 1 V 5 H 5 Z" fill="#f59e0b" />
      <circle cx="-8" cy="7" r="3" fill="#1f2937" />
      <circle cx="10" cy="7" r="3" fill="#1f2937" />
      <animateMotion dur="3.8s" fill="freeze" path={path} rotate="auto" />
    </g>
  );
}

export function RouteMap({
  plan,
  color = '#f47c20',
  groupNumber,
  editable = false,
  compact = false,
  animateKey = 0,
  onChange,
  className = '',
}: RouteMapProps) {
  const id = useId().replaceAll(':', '');
  const svgRef = useRef<SVGSVGElement>(null);
  const activeNodeRef = useRef<number | null>(null);
  const [activeNode, setActiveNode] = useState<number | null>(null);
  const path = routePath(plan);
  const points = routePoints(plan).map((point) => ({ x: point.x * 400, y: point.y * 300 }));

  function updateNode(index: number, value: number) {
    if (!onChange) return;
    const waypointXs = [...plan.waypointXs] as [number, number, number];
    waypointXs[index] = clampRouteX(value);
    onChange({ ...plan, waypointXs });
  }

  function moveFromPointer(event: PointerEvent<SVGGElement>, index: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    updateNode(index, (event.clientX - rect.left) / rect.width);
  }

  function handleKey(event: KeyboardEvent<SVGGElement>, index: number) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    updateNode(index, plan.waypointXs[index] + (event.key === 'ArrowRight' ? 0.03 : -0.03));
  }

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 400 300"
      role="img"
      aria-label={editable ? '可编辑的上山路线图，拖动三个编号节点设计路线' : `${groupNumber ? `第${groupNumber}组` : ''}上山路线图`}
      className={`block w-full select-none rounded-[1.25rem] ${editable ? 'touch-none' : ''} ${className}`}
    >
      <MapBackdrop id={id} />
      <path d={path} fill="none" stroke="white" strokeWidth={compact ? 15 : 20} strokeLinecap="round" strokeLinejoin="round" opacity="0.96" />
      <path d={path} fill="none" stroke={color} strokeWidth={compact ? 5 : 7} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={compact ? undefined : '1 13'} />
      {editable &&
        points.slice(1, 4).map((point, index) => (
          <g
            key={index}
            role="slider"
            tabIndex={0}
            aria-label={`第${index + 1}个路线节点`}
            aria-valuemin={Math.round(ROUTE_X_MIN * 100)}
            aria-valuemax={Math.round(ROUTE_X_MAX * 100)}
            aria-valuenow={Math.round(plan.waypointXs[index] * 100)}
            aria-valuetext={`位于地图横向${Math.round(plan.waypointXs[index] * 100)}%`}
            onKeyDown={(event) => handleKey(event, index)}
            onPointerDown={(event) => {
              activeNodeRef.current = index;
              setActiveNode(index);
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                // Some assistive and synthetic pointer events do not expose a capturable pointer.
              }
              moveFromPointer(event, index);
            }}
            onPointerMove={(event) => {
              if (activeNodeRef.current === index) {
                moveFromPointer(event, index);
              }
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              activeNodeRef.current = null;
              setActiveNode(null);
            }}
            onPointerCancel={() => {
              activeNodeRef.current = null;
              setActiveNode(null);
            }}
            className="cursor-ew-resize outline-none focus-visible:[&>circle:first-of-type]:stroke-white focus-visible:[&>circle:first-of-type]:stroke-[5]"
          >
            <circle cx={point.x} cy={point.y} r={activeNode === index ? 19 : 17} fill={color} stroke="#123a5a" strokeWidth="3" filter={`url(#${id}-shadow)`} />
            <text x={point.x} y={point.y + 5} textAnchor="middle" fontSize="14" fontWeight="900" fill="white">{index + 1}</text>
            <path d={`M ${point.x - 31} ${point.y} H ${point.x - 23} M ${point.x + 23} ${point.y} H ${point.x + 31}`} stroke="#123a5a" strokeWidth="3" strokeLinecap="round" />
          </g>
        ))}
      {groupNumber && (
        <g aria-hidden="true">
          <circle cx="366" cy="28" r="18" fill={color} />
          <text x="366" y="34" textAnchor="middle" fontSize="17" fontWeight="900" fill="white">{groupNumber}</text>
        </g>
      )}
      <defs>
        <filter id="route-truck-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#123a5a" floodOpacity="0.28" />
        </filter>
      </defs>
      <RouteTruck path={path} color={color} animateKey={animateKey} />
    </svg>
  );
}

export function RouteOverlayMap({
  routes,
  animateKey = 0,
  className = '',
}: {
  routes: Array<{ plan: RoutePlan; color: string; groupNumber: number }>;
  animateKey?: number;
  className?: string;
}) {
  const id = useId().replaceAll(':', '');
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return (
    <svg viewBox="0 0 400 300" role="img" aria-label="全班上山路线叠加比较图" className={`block w-full rounded-[1.5rem] ${className}`}>
      <MapBackdrop id={id} />
      {routes.map((route) => {
        const path = routePath(route.plan);
        return (
          <g key={route.groupNumber}>
            <path d={path} fill="none" stroke="white" strokeWidth="12" strokeLinecap="round" opacity="0.82" />
            <path d={path} fill="none" stroke={route.color} strokeWidth="5" strokeLinecap="round" opacity="0.96" />
            <circle cx={route.plan.waypointXs[1] * 400} cy={150} r="12" fill={route.color} stroke="white" strokeWidth="2" />
            <text x={route.plan.waypointXs[1] * 400} y={155} textAnchor="middle" fontSize="12" fontWeight="900" fill="white">{route.groupNumber}</text>
            {animateKey > 0 && !reduceMotion && (
              <circle key={`${animateKey}-${route.groupNumber}`} r="7" fill={route.color} stroke="white" strokeWidth="3">
                <animateMotion dur="3.8s" fill="freeze" path={path} />
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}
