'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CircleDot,
  Eye,
  Flag,
  Redo2,
  Rotate3D,
  Trash2,
  Undo2,
} from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { Button } from '@/components/ui/button';
import {
  calculateMountainMetrics,
  clamp,
  EMPTY_MOUNTAIN_ROAD,
  legacyMountainRoad,
  MAX_ROAD_NODES,
  MIN_ROAD_NODES,
  MOUNTAIN_RADIUS,
  mountainHeight,
  mountainPoint,
  normalizeAngleNear,
  projectMountainRoad,
  sampleMountainRoad,
  type MountainNode,
  type MountainRoad,
} from '@/lib/mountain-route';
import type { RoutePlan } from '@/lib/route-design';

export type MountainCameraView = {
  position: [number, number, number];
  target: [number, number, number];
};

type LabMode = 'build' | 'edit' | 'observe';

type SceneRuntime = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  mountain: THREE.Mesh;
  roadLayer: THREE.Group;
  truckLayer: THREE.Group;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  roadCurve: THREE.CatmullRomCurve3 | null;
  animationStartedAt: number | null;
  animationKey: number;
};

const DEFAULT_CAMERA: MountainCameraView = {
  position: [8.2, 7.1, 9.2],
  target: [0, 1.65, 0],
};

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry?.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material?.dispose());
    }
  });
}

function createMountainGeometry() {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const rings = 28;
  const slices = 72;
  const low = new THREE.Color('#397b48');
  const high = new THREE.Color('#c7d8a1');
  for (let ring = 0; ring <= rings; ring += 1) {
    const radius = ring / rings;
    for (let slice = 0; slice <= slices; slice += 1) {
      const angle = (slice / slices) * Math.PI * 2;
      const ridge = radius > 0.08 ? Math.sin(angle * 5 + radius * 9) * 0.05 * radius : 0;
      positions.push(
        Math.cos(angle) * radius * MOUNTAIN_RADIUS,
        mountainHeight(radius) + ridge,
        Math.sin(angle) * radius * MOUNTAIN_RADIUS,
      );
      const color = low.clone().lerp(high, 1 - radius);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let ring = 0; ring < rings; ring += 1) {
    for (let slice = 0; slice < slices; slice += 1) {
      const a = ring * (slices + 1) + slice;
      const b = a + slices + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addWorld(scene: THREE.Scene) {
  const mountain = new THREE.Mesh(
    createMountainGeometry(),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }),
  );
  mountain.receiveShadow = true;
  scene.add(mountain);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(MOUNTAIN_RADIUS + 0.35, MOUNTAIN_RADIUS + 0.5, 0.35, 72),
    new THREE.MeshStandardMaterial({ color: '#b6d6a5', roughness: 1 }),
  );
  base.position.y = -0.22;
  base.receiveShadow = true;
  scene.add(base);

  for (let index = 1; index <= 5; index += 1) {
    const radius = index / 6;
    const points: THREE.Vector3[] = [];
    for (let slice = 0; slice <= 96; slice += 1) {
      const angle = (slice / 96) * Math.PI * 2;
      points.push(new THREE.Vector3(
        Math.cos(angle) * radius * MOUNTAIN_RADIUS,
        mountainHeight(radius) + 0.035,
        Math.sin(angle) * radius * MOUNTAIN_RADIUS,
      ));
    }
    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: '#ecf4dc', transparent: true, opacity: 0.72 }),
    ));
  }

  const summit = mountainPoint({ radius: 0, angle: 0 }, 0.1);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.05, 10), new THREE.MeshStandardMaterial({ color: '#334155' }));
  pole.position.set(summit.x, summit.y + 0.52, summit.z);
  const flagShape = new THREE.Shape();
  flagShape.moveTo(0, 0); flagShape.lineTo(0.72, -0.18); flagShape.lineTo(0, -0.42); flagShape.closePath();
  const flag = new THREE.Mesh(new THREE.ShapeGeometry(flagShape), new THREE.MeshBasicMaterial({ color: '#f97316', side: THREE.DoubleSide }));
  flag.position.set(0.04, summit.y + 1.0, 0);
  flag.rotation.y = -0.35;
  scene.add(pole, flag);

  const start = mountainPoint({ radius: 1, angle: Math.PI / 2 }, 0.08);
  const startRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.23, 0.07, 10, 28),
    new THREE.MeshBasicMaterial({ color: '#0ea5e9' }),
  );
  startRing.rotation.x = Math.PI / 2;
  startRing.position.set(start.x, start.y, start.z);
  scene.add(startRing);
  return mountain;
}

function createTruck(color: string) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.22), new THREE.MeshStandardMaterial({ color, roughness: 0.55 }));
  body.position.y = 0.15;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.25, 0.22), new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.45 }));
  cab.position.set(0.25, 0.16, 0);
  const wheels = [-0.16, 0.22].flatMap((x) => [-0.13, 0.13].map((z) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 12), new THREE.MeshStandardMaterial({ color: '#1e293b' }));
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, 0.02, z);
    return wheel;
  }));
  group.add(body, cab, ...wheels);
  return group;
}

function createRoadLayer(road: MountainRoad, color: string, selectedNode: number | null, showNodes: boolean) {
  const layer = new THREE.Group();
  const samples = sampleMountainRoad(road, 16);
  const vectors = samples.map((point) => new THREE.Vector3(point.x, point.y, point.z));
  const curve = vectors.length >= 2 ? new THREE.CatmullRomCurve3(vectors, false, 'centripetal', 0.25) : null;
  if (curve) {
    const bed = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(64, samples.length * 2), 0.14, 8, false), new THREE.MeshStandardMaterial({ color: '#fff7ed', roughness: 0.8 }));
    const roadMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(64, samples.length * 2), 0.095, 8, false), new THREE.MeshBasicMaterial({ color }));
    bed.castShadow = true; roadMesh.castShadow = true;
    layer.add(bed, roadMesh);
    if (road.complete) {
      const metrics = calculateMountainMetrics(road);
      const start = clamp(metrics.steepestSegment / Math.max(1, road.nodes.length - 1), 0, 0.94);
      const end = clamp((metrics.steepestSegment + 1) / Math.max(1, road.nodes.length - 1), 0.06, 1);
      const warningCurve = new THREE.CatmullRomCurve3([curve.getPoint(start), curve.getPoint((start + end) / 2), curve.getPoint(end)]);
      layer.add(new THREE.Mesh(new THREE.TubeGeometry(warningCurve, 20, 0.105, 8, false), new THREE.MeshBasicMaterial({ color: '#ef4444' })));
    }
  }
  if (showNodes) {
    road.nodes.forEach((node, index) => {
      const point = mountainPoint(node, 0.21);
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(index === selectedNode ? 0.19 : 0.14, 18, 12),
        new THREE.MeshStandardMaterial({ color: index === selectedNode ? '#facc15' : index === 0 ? '#0ea5e9' : node.radius === 0 ? '#22c55e' : '#ffffff', roughness: 0.4 }),
      );
      marker.name = `route-node-${index}`;
      marker.position.set(point.x, point.y, point.z);
      marker.castShadow = true;
      layer.add(marker);
    });
  }
  return { layer, curve };
}

function MountainFallback({ road, color }: { road: MountainRoad; color: string }) {
  return <MountainRouteThumbnail road={road} color={color} className="h-full w-full" />;
}

export function MountainRoadLab({
  plan,
  editable = false,
  disabled = false,
  color = '#f47c20',
  groupNumber,
  animateKey = 0,
  compact = false,
  className = '',
  cameraView,
  onCameraChange,
  onChange,
}: {
  plan: RoutePlan;
  editable?: boolean;
  disabled?: boolean;
  color?: string;
  groupNumber?: number;
  animateKey?: number;
  compact?: boolean;
  className?: string;
  cameraView?: MountainCameraView;
  onCameraChange?: (view: MountainCameraView) => void;
  onChange?: (plan: RoutePlan) => void;
}) {
  const initialRoad = useMemo(() => plan.mountain || (editable ? EMPTY_MOUNTAIN_ROAD : legacyMountainRoad(plan.waypointXs)), [editable, plan.mountain, plan.waypointXs]);
  const road = plan.mountain || initialRoad;
  const canvasRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<SceneRuntime | null>(null);
  const roadRef = useRef(road);
  const planRef = useRef(plan);
  const modeRef = useRef<LabMode>(editable ? 'build' : 'observe');
  const selectedRef = useRef<number | null>(null);
  const pointerDownRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const historyRef = useRef<MountainRoad[]>([]);
  const futureRef = useRef<MountainRoad[]>([]);
  const disabledRef = useRef(disabled);
  const cameraChangeRef = useRef(onCameraChange);
  const [mode, setMode] = useState<LabMode>(editable && !road.complete ? 'build' : 'observe');
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [hint, setHint] = useState(editable && !road.complete ? '点按山体，逐段铺设向上的道路' : '单指旋转山体，双指缩放');

  useEffect(() => {
    planRef.current = plan;
    roadRef.current = road;
    modeRef.current = mode;
    selectedRef.current = selectedNode;
    disabledRef.current = disabled;
    cameraChangeRef.current = onCameraChange;
  }, [disabled, mode, onCameraChange, plan, road, selectedNode]);

  function emitRoad(next: MountainRoad, remember = true) {
    if (!onChange || disabled) return;
    if (remember) {
      historyRef.current.push(roadRef.current);
      if (historyRef.current.length > 30) historyRef.current.shift();
      futureRef.current = [];
    }
    const nextPlan = { ...planRef.current, mountain: next, waypointXs: projectMountainRoad(next) };
    roadRef.current = next;
    onChange(nextPlan);
  }

  useEffect(() => {
    const host = canvasRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      queueMicrotask(() => setWebglFailed(true));
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setClearColor('#dff3fb', 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#dff3fb', 13, 22);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
    const startingView = DEFAULT_CAMERA;
    camera.position.set(...startingView.position);
    scene.add(new THREE.HemisphereLight('#f8fdff', '#507a43', 2.3));
    const sun = new THREE.DirectionalLight('#fff4d6', 3.3);
    sun.position.set(6, 11, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    const mountain = addWorld(scene);
    const roadLayer = new THREE.Group();
    const truckLayer = new THREE.Group();
    scene.add(roadLayer, truckLayer);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...startingView.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = 7;
    controls.maxDistance = 17;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.update();

    const runtime: SceneRuntime = {
      scene, camera, renderer, controls, mountain, roadLayer, truckLayer,
      raycaster: new THREE.Raycaster(), pointer: new THREE.Vector2(), roadCurve: null,
      animationStartedAt: null, animationKey: 0,
    };
    runtimeRef.current = runtime;

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let frame = 0;
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      controls.enabled = !disabledRef.current && modeRef.current === 'observe';
      controls.update();
      if (runtime.animationStartedAt !== null && runtime.roadCurve) {
        const progress = Math.min(1, (time - runtime.animationStartedAt) / 4300);
        const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        const truck = runtime.truckLayer.children[0];
        if (truck) {
          const point = runtime.roadCurve.getPoint(eased);
          const tangent = runtime.roadCurve.getTangent(eased);
          truck.position.copy(point).add(new THREE.Vector3(0, 0.16, 0));
          truck.rotation.y = Math.atan2(tangent.z, tangent.x) * -1;
        }
        if (progress >= 1) runtime.animationStartedAt = null;
      }
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(draw);

    const reportCamera = () => cameraChangeRef.current?.({
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
    });
    controls.addEventListener('end', reportCamera);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.removeEventListener('end', reportCamera);
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    disposeObject(runtime.roadLayer);
    runtime.roadLayer.clear();
    const created = createRoadLayer(road, color, selectedNode, editable);
    runtime.roadLayer.add(...created.layer.children);
    runtime.roadCurve = created.curve;
    disposeObject(runtime.truckLayer);
    runtime.truckLayer.clear();
    if (created.curve && road.complete) {
      const truck = createTruck(color);
      const start = created.curve.getPoint(0);
      truck.position.copy(start).add(new THREE.Vector3(0, 0.16, 0));
      runtime.truckLayer.add(truck);
    }
  }, [color, editable, road, selectedNode]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || animateKey === runtime.animationKey) return;
    runtime.animationKey = animateKey;
    if (runtime.roadCurve && road.complete) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const truck = runtime.truckLayer.children[0];
        if (truck) truck.position.copy(runtime.roadCurve.getPoint(1)).add(new THREE.Vector3(0, 0.16, 0));
      } else {
        runtime.animationStartedAt = performance.now();
      }
    }
  }, [animateKey, road.complete]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !cameraView) return;
    const distance = runtime.camera.position.distanceTo(new THREE.Vector3(...cameraView.position));
    if (distance > 0.03) runtime.camera.position.set(...cameraView.position);
    runtime.controls.target.set(...cameraView.target);
    runtime.controls.update();
  }, [cameraView]);

  function pickMountain(clientX: number, clientY: number) {
    const runtime = runtimeRef.current;
    if (!runtime) return null;
    const rectangle = runtime.renderer.domElement.getBoundingClientRect();
    runtime.pointer.set(((clientX - rectangle.left) / rectangle.width) * 2 - 1, -((clientY - rectangle.top) / rectangle.height) * 2 + 1);
    runtime.raycaster.setFromCamera(runtime.pointer, runtime.camera);
    return runtime.raycaster.intersectObject(runtime.mountain, false)[0]?.point || null;
  }

  function nodeFromPoint(point: THREE.Vector3, reference: MountainNode) {
    const radius = clamp(Math.hypot(point.x, point.z) / MOUNTAIN_RADIUS, 0.06, 0.94);
    const angle = normalizeAngleNear(Math.atan2(point.z, point.x), reference.angle);
    return { radius, angle };
  }

  function addPoint(clientX: number, clientY: number) {
    if (disabled || modeRef.current !== 'build' || roadRef.current.complete) return;
    const point = pickMountain(clientX, clientY);
    if (!point) return;
    const current = roadRef.current;
    const previous = current.nodes[current.nodes.length - 1];
    const next = nodeFromPoint(point, previous);
    if (next.radius >= previous.radius - 0.08) {
      setHint('请点得更靠近山顶一些，道路要逐段上升');
      return;
    }
    if (current.nodes.length >= MAX_ROAD_NODES - 1) {
      setHint('已达到 12 个节点，请连接山顶');
      return;
    }
    emitRoad({ ...current, nodes: [...current.nodes, next] });
    setSelectedNode(current.nodes.length);
    setHint(`已铺设第 ${current.nodes.length} 段，可继续点按山体`);
  }

  function moveSelected(clientX: number, clientY: number) {
    const index = selectedRef.current;
    if (disabled || modeRef.current !== 'edit' || index === null || index === 0 || index === roadRef.current.nodes.length - 1 && roadRef.current.complete) return;
    const point = pickMountain(clientX, clientY);
    if (!point) return;
    const current = roadRef.current;
    const previous = current.nodes[index - 1];
    const next = current.nodes[index + 1];
    const moved = nodeFromPoint(point, previous);
    moved.radius = clamp(moved.radius, next ? next.radius + 0.035 : 0.06, previous.radius - 0.035);
    const nodes = current.nodes.map((node, nodeIndex) => nodeIndex === index ? moved : node);
    emitRoad({ ...current, nodes }, false);
  }

  function selectNearestNode(clientX: number, clientY: number) {
    const runtime = runtimeRef.current;
    if (!runtime) return null;
    const rectangle = runtime.renderer.domElement.getBoundingClientRect();
    runtime.pointer.set(((clientX - rectangle.left) / rectangle.width) * 2 - 1, -((clientY - rectangle.top) / rectangle.height) * 2 + 1);
    runtime.raycaster.setFromCamera(runtime.pointer, runtime.camera);
    const matches = runtime.raycaster.intersectObjects(runtime.roadLayer.children, true).filter((match) => match.object.name.startsWith('route-node-'));
    if (!matches.length) return null;
    return Number(matches[0].object.name.replace('route-node-', ''));
  }

  function completeRoad() {
    const current = roadRef.current;
    if (current.complete) return;
    if (current.nodes.length < MIN_ROAD_NODES - 1) {
      setHint(`还需至少 ${MIN_ROAD_NODES - 1 - current.nodes.length} 个中间节点`);
      return;
    }
    const previous = current.nodes[current.nodes.length - 1];
    emitRoad({ ...current, complete: true, nodes: [...current.nodes, { radius: 0, angle: previous.angle }] });
    setMode('observe');
    setSelectedNode(null);
    setHint('道路已接到山顶，可以旋转观察并试跑货车');
  }

  function clearRoad() {
    emitRoad({ ...EMPTY_MOUNTAIN_ROAD, nodes: [...EMPTY_MOUNTAIN_ROAD.nodes] });
    historyRef.current = [];
    futureRef.current = [];
    setSelectedNode(null);
    setMode('build');
    setHint('重新开始：点按山体铺设第一段道路');
  }

  function undo() {
    const previous = historyRef.current.pop();
    if (!previous) return;
    futureRef.current.push(roadRef.current);
    emitRoad(previous, false);
  }

  function redo() {
    const next = futureRef.current.pop();
    if (!next) return;
    historyRef.current.push(roadRef.current);
    emitRoad(next, false);
  }

  function deleteSelected() {
    const index = selectedRef.current;
    const current = roadRef.current;
    if (index === null || index === 0 || index === current.nodes.length - 1 && current.complete) return;
    emitRoad({ ...current, nodes: current.nodes.filter((_, nodeIndex) => nodeIndex !== index) });
    setSelectedNode(null);
  }

  function nudgeSelected(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (disabled || (index === 0 || index === road.nodes.length - 1 && road.complete)) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const current = roadRef.current;
    const previous = current.nodes[index - 1];
    const next = current.nodes[index + 1];
    const node = { ...current.nodes[index] };
    if (event.key === 'ArrowLeft') node.angle -= 0.1;
    if (event.key === 'ArrowRight') node.angle += 0.1;
    if (event.key === 'ArrowUp') node.radius = clamp(node.radius - 0.025, next ? next.radius + 0.035 : 0.06, previous.radius - 0.035);
    if (event.key === 'ArrowDown') node.radius = clamp(node.radius + 0.025, next ? next.radius + 0.035 : 0.06, previous.radius - 0.035);
    emitRoad({ ...current, nodes: current.nodes.map((item, nodeIndex) => nodeIndex === index ? node : item) });
  }

  const modes: { value: LabMode; label: string; icon: typeof CircleDot; disabled?: boolean }[] = [
    { value: 'build', label: '修路', icon: CircleDot, disabled: road.complete },
    { value: 'edit', label: '调整', icon: Rotate3D, disabled: road.nodes.length < 2 },
    { value: 'observe', label: '观察', icon: Eye },
  ];

  return (
    <div className={`overflow-hidden rounded-[1.4rem] border border-emerald-200 bg-[#dff3fb] ${className}`}>
      <div className={`relative ${compact ? 'h-[330px]' : 'h-[clamp(340px,48vw,560px)]'}`}>
        {webglFailed ? <MountainFallback road={road} color={color} /> : <div
          ref={canvasRef}
          aria-label="可旋转的三维山地道路设计沙盘"
          className="absolute inset-0"
          onPointerDown={(event) => {
            pointerDownRef.current = { x: event.clientX, y: event.clientY, moved: false };
            if (modeRef.current === 'edit') {
              const index = selectNearestNode(event.clientX, event.clientY);
              if (index !== null) setSelectedNode(index);
            }
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const pointer = pointerDownRef.current;
            if (!pointer) return;
            if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 4) pointer.moved = true;
            if (modeRef.current === 'edit' && selectedRef.current !== null) moveSelected(event.clientX, event.clientY);
          }}
          onPointerUp={(event) => {
            const pointer = pointerDownRef.current;
            if (pointer && !pointer.moved) {
              if (modeRef.current === 'build') addPoint(event.clientX, event.clientY);
              if (modeRef.current === 'edit') setSelectedNode(selectNearestNode(event.clientX, event.clientY));
            }
            pointerDownRef.current = null;
          }}
          onPointerCancel={() => { pointerDownRef.current = null; }}
        />}

        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
          {groupNumber && <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-black text-slate-700 shadow">第 {groupNumber} 组</span>}
          <span className="rounded-full bg-slate-900/75 px-3 py-1.5 text-xs font-black text-white shadow">3D 山地工程沙盘</span>
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex justify-center">
          <p className="rounded-full bg-white/90 px-4 py-2 text-center text-xs font-black text-slate-600 shadow-lg">{hint}</p>
        </div>
      </div>

      {editable && (
        <div className="border-t border-emerald-200 bg-white/95 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {modes.map(({ value, label, icon: Icon, disabled: modeDisabled }) => <button key={value} type="button" disabled={disabled || modeDisabled} onClick={() => { setMode(value); setSelectedNode(null); setHint(value === 'build' ? '点按山体继续铺路' : value === 'edit' ? '点选白色节点并拖动调整' : '单指旋转，双指缩放'); }} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-black transition disabled:opacity-35 ${mode === value ? 'bg-primary text-white shadow' : 'text-slate-500'}`}><Icon className="size-4" />{label}</button>)}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={undo}><Undo2 className="size-3.5" />撤销</Button>
              <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={redo}><Redo2 className="size-3.5" />重做</Button>
              {selectedNode !== null && selectedNode > 0 && !(road.complete && selectedNode === road.nodes.length - 1) && <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={deleteSelected}><Trash2 className="size-3.5" />删除节点</Button>}
              {!road.complete ? <Button type="button" size="sm" disabled={disabled || road.nodes.length < MIN_ROAD_NODES - 1} onClick={completeRoad} className="bg-emerald-600 text-white hover:bg-emerald-700"><Flag className="size-3.5" />连接山顶</Button> : <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={clearRoad}><Trash2 className="size-3.5" />重新设计</Button>}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1" aria-label="道路节点键盘调整">
            {road.nodes.map((node, index) => <button key={`${index}-${node.radius}`} type="button" disabled={disabled || index === 0 || road.complete && index === road.nodes.length - 1} onClick={() => { setMode('edit'); setSelectedNode(index); }} onKeyDown={(event) => nudgeSelected(event, index)} className={`shrink-0 rounded-full border-2 px-2.5 py-1 text-xs font-black ${selectedNode === index ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-500'}`} aria-label={`节点${index + 1}，方向键可调整`}>{index === 0 ? '山脚' : road.complete && index === road.nodes.length - 1 ? '山顶' : `节点 ${index}`}</button>)}
            <span className="ml-auto shrink-0 text-xs font-black text-slate-400">{road.nodes.length}/{MAX_ROAD_NODES} 个节点</span>
          </div>
        </div>
      )}
      {!editable && <div className="flex items-center justify-center gap-2 border-t border-emerald-200 bg-white/90 px-3 py-2 text-xs font-black text-slate-500"><Camera className="size-4" />拖动旋转 · 滚轮或双指缩放</div>}
    </div>
  );
}

export function MountainRouteThumbnail({ road, color = '#f47c20', className = '' }: { road: MountainRoad; color?: string; className?: string }) {
  const points = sampleMountainRoad(road, 5).map((point) => ({ x: 110 + point.x * 19, y: 104 + point.z * 13 }));
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  return <svg viewBox="0 0 220 165" aria-label="山路俯视缩略图" className={className}>
    <title>山路俯视缩略图</title>
    <defs><radialGradient id="mountain-top" cx="50%" cy="48%"><stop offset="0" stopColor="#dce9b9" /><stop offset="1" stopColor="#5b965b" /></radialGradient></defs>
    <ellipse cx="110" cy="105" rx="86" ry="55" fill="url(#mountain-top)" />
    {[18, 34, 50, 66].map((radius) => <ellipse key={radius} cx="110" cy="104" rx={radius} ry={radius * 0.64} fill="none" stroke="#eff7df" strokeWidth="1.5" />)}
    {path && <><path d={path} fill="none" stroke="#fff7ed" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" /><path d={path} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></>}
    <circle cx={points[0]?.x || 110} cy={points[0]?.y || 159} r="6" fill="#0ea5e9" stroke="white" strokeWidth="2" />
    {road.complete && <g transform="translate(110 98)"><circle r="7" fill="#22c55e" stroke="white" strokeWidth="2" /><path d="M0 -7v-16l13 4-13 5" fill="#f97316" stroke="#334155" strokeWidth="1.3" /></g>}
  </svg>;
}
