'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  Expand,
  FlaskConical,
  House,
  LockKeyhole,
  Mountain,
  Pause,
  Play,
  QrCode,
  RefreshCcw,
  RotateCcw,
  Route,
  Ruler,
  Sparkles,
  Truck,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';

import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  average,
  ClassroomState,
  CONDITIONS,
  EMPTY_MEASUREMENTS,
  Measurements,
} from '@/lib/classroom-types';

const SCENES = [
  '项目会议',
  '方案预测',
  '提出问题',
  '实验设计',
  '测量汇总',
  '证据结论',
  '路线设计',
  '工程比较',
  '生活拓展',
];

const PREDICTION_COLORS: Record<string, string> = {
  直接搬: '#64748b',
  找人帮忙: '#f58a2c',
  使用斜面: '#1769aa',
};

function formatTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function classAverages(state: ClassroomState) {
  return CONDITIONS.map((condition) => {
    const values = state.groups
      .map((group) => group.measurements && average(group.measurements[condition.key]))
      .filter((value): value is number => Boolean(value));
    return { name: condition.shortLabel, value: values.length ? average(values) : 0 };
  });
}

export function TeacherApp({ code }: { code: string }) {
  const [state, setState] = useState<ClassroomState | null>(null);
  const [teacherToken, setTeacherToken] = useState('');
  const [offline, setOffline] = useState(false);
  const [pendingSync, setPendingSync] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);
  const [joinUrl, setJoinUrl] = useState('');

  useEffect(() => {
    setTeacherToken(localStorage.getItem(`incline:teacher:${code}`) || '');
    setJoinUrl(`${location.origin}/join/${code}`);
    const cached = localStorage.getItem(`incline:state:${code}`);
    if (cached) {
      try {
        setState(JSON.parse(cached) as ClassroomState);
      } catch {
        localStorage.removeItem(`incline:state:${code}`);
      }
    }
  }, [code]);

  const fetchState = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${code}/state`, {
        headers: teacherToken ? { Authorization: `Bearer ${teacherToken}` } : undefined,
        cache: 'no-store',
      });
      const data = (await response.json()) as ClassroomState & { error?: string };
      if (!response.ok) throw new Error(data.error || '课堂读取失败');
      if (pendingSync) {
        setOffline(false);
        return;
      }
      setState(data);
      localStorage.setItem(`incline:state:${code}`, JSON.stringify(data));
      setOffline(false);
      setError('');
    } catch (caught) {
      setOffline(true);
      if (!state) setError(caught instanceof Error ? caught.message : '课堂读取失败');
    }
  }, [code, pendingSync, state, teacherToken]);

  useEffect(() => {
    if (!teacherToken) return;
    void fetchState();
    const interval = window.setInterval(fetchState, 2000);
    return () => window.clearInterval(interval);
  }, [fetchState, teacherToken]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning]);

  const updateState = useCallback(
    async (patch: Partial<Pick<ClassroomState, 'scene' | 'answerRevealed' | 'submissionsPaused'>>) => {
      if (!state) return;
      const optimistic = { ...state, ...patch, updatedAt: new Date().toISOString() };
      setState(optimistic);
      localStorage.setItem(`incline:state:${code}`, JSON.stringify(optimistic));
      if (!teacherToken || offline) {
        setPendingSync(true);
        return;
      }
      try {
        const response = await fetch(`/api/sessions/${code}/state`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${teacherToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!response.ok) throw new Error();
        setPendingSync(false);
      } catch {
        setOffline(true);
        setPendingSync(true);
      }
    },
    [code, offline, state, teacherToken],
  );

  const restoreSync = useCallback(async () => {
    if (!state || !teacherToken) return;
    try {
      const resetWasQueued = localStorage.getItem(`incline:pending-reset:${code}`) === '1';
      const response = await fetch(`/api/sessions/${code}/state`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${teacherToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(
          resetWasQueued
            ? { resetAll: true }
            : {
                scene: state.scene,
                answerRevealed: state.answerRevealed,
                submissionsPaused: state.submissionsPaused,
              },
        ),
      });
      if (!response.ok) throw new Error();
      const synced = (await response.json()) as ClassroomState;
      localStorage.removeItem(`incline:pending-reset:${code}`);
      setOffline(false);
      setPendingSync(false);
      setState(synced);
      localStorage.setItem(`incline:state:${code}`, JSON.stringify(synced));
    } catch {
      setError('网络仍未恢复，教师端可以继续本地授课。');
    }
  }, [code, fetchState, state, teacherToken]);

  const resetClassroom = useCallback(async () => {
    if (!state) return;
    if (offline) {
      const cleared = {
        ...state,
        scene: 0,
        answerRevealed: false,
        submissionsPaused: false,
        groups: state.groups.map((group) => ({
          ...group,
          prediction: null,
          measurements: null,
          conclusion: null,
          routeType: null,
          routeReason: null,
          status: 'waiting' as const,
        })),
      };
      setState(cleared);
      localStorage.setItem(`incline:state:${code}`, JSON.stringify(cleared));
      localStorage.setItem(`incline:pending-reset:${code}`, '1');
      setPendingSync(true);
      setElapsed(0);
      return;
    }
    const response = await fetch(`/api/sessions/${code}/state`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${teacherToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetAll: true }),
    });
    if (response.ok) {
      setElapsed(0);
      await fetchState();
    }
  }, [code, fetchState, offline, state, teacherToken]);

  function exportCsv() {
    if (!state) return;
    const header = ['小组', ...CONDITIONS.flatMap((item) => [`${item.label}1`, `${item.label}2`, `${item.label}3`, `${item.label}平均`]), '小组发现', '路线', '理由'];
    const rows = state.groups.map((group) => [
      `第${group.groupNumber}组`,
      ...CONDITIONS.flatMap(({ key }) => {
        const trials = group.measurements?.[key] || ['', '', ''];
        return [...trials, group.measurements ? average(group.measurements[key]) : ''];
      }),
      group.conclusion || '',
      group.routeType || '',
      group.routeReason || '',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `斜面实验-${code}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!teacherToken) {
    return (
      <CenteredNotice title="没有找到教师凭证" text="请从本机首页重新创建课堂，或回到最近创建的课堂。" />
    );
  }
  if (!state) {
    return <CenteredNotice title={error || '正在连接课堂…'} text="如果网络暂时中断，刷新前访问过的课堂仍可从本机恢复。" />;
  }

  const joined = state.groups.filter((group) => group.joined).length;

  return (
    <main className="flex min-h-screen flex-col bg-[#edf5f7] text-slate-900">
      <header className="flex min-h-16 items-center gap-4 border-b border-slate-200 bg-white px-4 py-3 shadow-sm md:px-6">
        <a href="/" aria-label="返回首页" className="grid size-10 place-items-center rounded-xl bg-primary text-white">
          <FlaskConical className="size-5" />
        </a>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-primary">3.2 斜面 · 胡拉拉搬家公司</p>
          <p className="truncate text-xs font-bold text-slate-500">{SCENES[state.scene]} · 第 {state.scene + 1}/9 环节</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black md:flex ${offline ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {offline ? <WifiOff className="size-3.5" /> : <Wifi className="size-3.5" />}
            {offline ? '离线授课中' : '实时同步'}
          </span>
          <button
            type="button"
            onClick={() => setTimerRunning((value) => !value)}
            className="flex h-10 items-center gap-2 rounded-xl bg-slate-100 px-3 font-mono text-sm font-black tabular-nums"
          >
            {timerRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
            {formatTime(elapsed)}
          </button>
          <Button variant="outline" size="icon-lg" aria-label="全屏" onClick={() => void document.documentElement.requestFullscreen?.()}>
            <Expand className="size-5" />
          </Button>
        </div>
      </header>

      {(offline || pendingSync) && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-orange-100 px-4 py-2 text-sm font-bold text-orange-800">
          <WifiOff className="size-4" /> 小组端暂停同步，教师端仍可继续全部课堂环节。
          <Button size="sm" variant="outline" onClick={() => void restoreSync()} className="border-orange-300 bg-white">
            <RefreshCcw className="size-3.5" /> 恢复同步
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col xl:grid xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="relative min-h-[calc(100vh-170px)] overflow-hidden p-3 md:p-5">
          <div className="mx-auto flex aspect-video max-h-[calc(100vh-190px)] min-h-[620px] w-full max-w-[1320px] flex-col overflow-hidden rounded-[1.75rem] border border-white bg-white shadow-[0_25px_80px_rgba(27,73,102,0.12)]">
            <SceneContent state={state} joinUrl={joinUrl} teacherToken={teacherToken} updateState={updateState} />
          </div>
        </section>

        <aside className="border-l border-slate-200 bg-white p-5 xl:block">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black tracking-[0.15em] text-slate-400">课堂码</p>
              <p className="mt-1 font-mono text-3xl font-black tracking-[0.16em] text-primary">{code}</p>
            </div>
            <div className="rounded-xl bg-sky-50 p-2.5 text-primary"><QrCode className="size-6" /></div>
          </div>
          <div className="mt-4 grid place-items-center rounded-2xl border border-slate-200 bg-white p-3">
            {joinUrl && <QRCodeSVG value={joinUrl} size={160} level="M" marginSize={1} fgColor="#123a5a" />}
          </div>
          <p className="mt-3 text-center text-xs font-bold text-slate-500">小组扫码或输入课堂码加入</p>

          <div className="mt-6 flex items-center justify-between">
            <p className="flex items-center gap-2 font-black"><Users className="size-4 text-primary" /> 项目组</p>
            <span className="text-sm font-black text-emerald-600">{joined}/{state.groupCount} 已加入</span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 xl:grid-cols-2">
            {state.groups.map((group) => {
              const online = group.lastSeenAt && Date.now() - new Date(group.lastSeenAt).getTime() < 10_000;
              return (
                <div key={group.groupNumber} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 text-sm font-black">
                  <span className={`size-2 rounded-full ${online ? 'bg-emerald-500' : group.joined ? 'bg-amber-400' : 'bg-slate-250'}`} />
                  第{group.groupNumber}组
                </div>
              );
            })}
          </div>

          <div className="mt-6 space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => void updateState({ submissionsPaused: !state.submissionsPaused })}>
              {state.submissionsPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
              {state.submissionsPaused ? '恢复小组提交' : '暂停小组提交'}
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={exportCsv}>
              <Download className="size-4" /> 导出实验数据
            </Button>
            <Button variant="destructive" className="w-full justify-start" onClick={() => { if (window.confirm('确定清空本节课的提交数据并回到第一环节吗？')) void resetClassroom(); }}>
              <RotateCcw className="size-4" /> 重置课堂数据
            </Button>
          </div>
        </aside>
      </div>

      <footer className="sticky bottom-0 z-20 flex items-center gap-3 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.06)] md:px-6">
        <Button variant="outline" size="lg" disabled={state.scene === 0} onClick={() => void updateState({ scene: state.scene - 1 })}>
          <ChevronLeft className="size-5" /> 上一环节
        </Button>
        <div className="hidden flex-1 items-center justify-center gap-2 md:flex">
          {SCENES.map((scene, index) => (
            <button
              key={scene}
              type="button"
              aria-label={`前往${scene}`}
              onClick={() => void updateState({ scene: index })}
              className={`h-2.5 rounded-full transition-all ${index === state.scene ? 'w-10 bg-orange-500' : index < state.scene ? 'w-5 bg-primary' : 'w-5 bg-slate-200'}`}
            />
          ))}
        </div>
        <span className="flex-1 text-center text-sm font-black text-slate-500 md:hidden">{state.scene + 1} / 9</span>
        <Button size="lg" disabled={state.scene === 8} onClick={() => void updateState({ scene: state.scene + 1 })} className="bg-orange-500 text-white hover:bg-orange-600">
          下一环节 <ChevronRight className="size-5" />
        </Button>
      </footer>
    </main>
  );
}

function CenteredNotice({ title, text }: { title: string; text: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-sky-50 p-6">
      <section className="max-w-lg rounded-3xl bg-white p-8 text-center shadow-xl">
        <CircleAlert className="mx-auto size-10 text-orange-500" />
        <h1 className="mt-4 text-2xl font-black">{title}</h1>
        <p className="mt-3 leading-7 text-slate-600">{text}</p>
        <a href="/teach/new" className="mt-6 inline-flex items-center gap-2 font-black text-primary"><ArrowLeft className="size-4" /> 创建新课堂</a>
      </section>
    </main>
  );
}

function SceneContent({
  state,
  joinUrl,
  teacherToken,
  updateState,
}: {
  state: ClassroomState;
  joinUrl: string;
  teacherToken: string;
  updateState: (patch: Partial<ClassroomState>) => Promise<void>;
}) {
  switch (state.scene) {
    case 0:
      return <OpeningScene state={state} joinUrl={joinUrl} />;
    case 1:
      return <PredictionScene state={state} />;
    case 2:
      return <QuestionScene />;
    case 3:
      return <ExperimentDesignScene />;
    case 4:
      return <DataScene state={state} teacherToken={teacherToken} />;
    case 5:
      return <ConclusionScene state={state} updateState={updateState} />;
    case 6:
      return <RouteDesignScene state={state} />;
    case 7:
      return <RouteCompareScene state={state} />;
    default:
      return <TransferScene />;
  }
}

function SceneLabel({ icon: Icon, children, tone = 'blue' }: { icon: typeof FlaskConical; children: React.ReactNode; tone?: 'blue' | 'orange' | 'green' }) {
  const tones = { blue: 'bg-sky-100 text-primary', orange: 'bg-orange-100 text-orange-700', green: 'bg-emerald-100 text-emerald-700' };
  return <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black ${tones[tone]}`}><Icon className="size-4" />{children}</div>;
}

function OpeningScene({ state, joinUrl }: { state: ClassroomState; joinUrl: string }) {
  return (
    <div className="relative flex h-full flex-1 overflow-hidden">
      <img src="/hero-incline.png" alt="胡拉拉搬家公司货车和斜面" className="absolute inset-0 h-full w-full object-cover object-[68%_center]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(245,250,252,0.98),rgba(245,250,252,0.89)_43%,rgba(245,250,252,0.08)_76%)]" />
      <div className="relative z-10 flex w-[56%] flex-col justify-center p-[clamp(2rem,5vw,5rem)]">
        <SceneLabel icon={Clock3} tone="orange">胡拉拉搬家公司 · 项目会议</SceneLabel>
        <h1 className="mt-6 text-[clamp(3.8rem,7vw,7rem)] font-black leading-none tracking-[-0.07em]">斜面</h1>
        <p className="mt-5 text-[clamp(1.3rem,2vw,2rem)] font-black leading-tight text-primary">如何把重物轻松地搬上货车？</p>
        <div className="mt-8 flex items-center gap-5 rounded-2xl border border-white bg-white/82 p-5 shadow-lg backdrop-blur">
          <QRCodeSVG value={joinUrl} size={112} level="M" />
          <div><p className="text-sm font-black text-slate-500">课堂码</p><p className="font-mono text-4xl font-black tracking-[0.16em] text-primary">{state.code}</p><p className="mt-1 text-sm font-bold text-slate-500">已有 {state.groups.filter((group) => group.joined).length}/{state.groupCount} 组加入</p></div>
        </div>
      </div>
    </div>
  );
}

function PredictionScene({ state }: { state: ClassroomState }) {
  const choices = ['直接搬', '找人帮忙', '使用斜面'];
  const data = choices.map((choice) => ({ name: choice, value: state.groups.filter((group) => group.prediction === choice).length }));
  const submitted = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="flex h-full flex-col p-[clamp(2rem,4vw,4rem)]">
      <SceneLabel icon={Users} tone="orange">聚焦 · 搬运专家选择方案</SceneLabel>
      <div className="mt-5 flex items-end justify-between gap-8"><div><h2 className="text-[clamp(2.4rem,4vw,4.5rem)] font-black leading-tight">怎样把重物运上货车？</h2><p className="mt-3 text-xl font-bold text-slate-500">先独立预测，再听听不同项目组的理由。</p></div><p className="shrink-0 text-2xl font-black text-primary">{submitted}/{state.groupCount} 组已选择</p></div>
      <div className="mt-8 grid flex-1 grid-cols-3 gap-5">
        {data.map((item, index) => (
          <div key={item.name} className="relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50 p-7">
            <span className="text-6xl">{['💪', '🤝', '📐'][index]}</span>
            <div><p className="text-2xl font-black">{item.name}</p><div className="mt-5 h-4 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full transition-all" style={{ width: `${submitted ? (item.value / submitted) * 100 : 0}%`, background: PREDICTION_COLORS[item.name] }} /></div><p className="mt-4 text-5xl font-black tabular-nums" style={{ color: PREDICTION_COLORS[item.name] }}>{item.value}<span className="ml-2 text-base text-slate-400">组</span></p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionScene() {
  const [angle, setAngle] = useState(28);
  return (
    <div className="flex h-full flex-col p-[clamp(2rem,4vw,4rem)]">
      <SceneLabel icon={FlaskConical}>探索 · 提出研究问题</SceneLabel>
      <div className="mt-4 grid flex-1 grid-cols-[1fr_0.9fr] items-center gap-12">
        <div><p className="text-xl font-black text-orange-600">我们已经发现一种工具</p><h2 className="mt-3 text-[clamp(3.2rem,5vw,5.5rem)] font-black leading-tight">斜面能省力吗？</h2><p className="mt-5 text-2xl font-bold leading-relaxed text-primary">什么样的斜面更省力？</p><div className="mt-9 rounded-2xl bg-sky-50 p-5 text-lg font-bold text-slate-600">拖动右侧滑杆，只观察斜面的倾斜程度。先不急着判断答案，用实验数据来证明。</div></div>
        <div className="rounded-[2rem] border border-slate-200 bg-[#f8fbfc] p-8 shadow-inner">
          <div className="relative h-72 overflow-hidden rounded-2xl bg-[linear-gradient(#dff3fb_0_68%,#e7dbc5_68%)]">
            <div className="absolute bottom-[32%] left-[12%] h-4 origin-left rounded-full bg-amber-700 shadow-lg" style={{ width: '74%', transform: `rotate(-${angle}deg)` }} />
            <div className="absolute bottom-[32%] right-[10%] w-24 bg-slate-300" style={{ height: `${Math.tan((angle * Math.PI) / 180) * 310}px` }} />
            <Truck className="absolute bottom-[34%] left-[22%] size-14 text-orange-500" />
          </div>
          <label className="mt-6 flex items-center gap-4 text-lg font-black"><Ruler className="size-5 text-primary" /> 倾斜角度 {angle}°</label>
          <input aria-label="调整斜面倾斜角度" type="range" min="12" max="45" value={angle} onChange={(event) => setAngle(Number(event.target.value))} className="mt-4 w-full accent-orange-500" />
        </div>
      </div>
    </div>
  );
}

function ExperimentDesignScene() {
  const steps = ['测：直接提起', '搭：同一高度', '拉：缓慢匀速', '记：重复三次', '算：比较平均值'];
  const controls = ['同一个货物', '同一块接触面', '相同的货车高度', '沿斜面方向拉动'];
  return (
    <div className="flex h-full flex-col p-[clamp(2rem,4vw,4rem)]">
      <SceneLabel icon={FlaskConical}>探索 · 搬家测试 1</SceneLabel>
      <h2 className="mt-4 text-[clamp(2.5rem,4vw,4rem)] font-black">怎样公平地比较三种斜面？</h2>
      <div className="mt-7 grid flex-1 grid-cols-[1.1fr_0.9fr] gap-7">
        <div className="rounded-[2rem] bg-primary p-7 text-white"><p className="text-lg font-black text-sky-200">实验步骤</p><div className="mt-5 space-y-3">{steps.map((step, index) => <div key={step} className="flex items-center gap-4 rounded-2xl bg-white/10 p-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white font-black text-primary">{index + 1}</span><span className="text-xl font-black">{step}</span></div>)}</div></div>
        <div className="rounded-[2rem] border border-orange-200 bg-orange-50 p-7"><p className="text-lg font-black text-orange-700">控制变量检查</p><div className="mt-5 grid gap-3">{controls.map((control) => <div key={control} className="flex items-center gap-3 rounded-2xl bg-white p-4 text-lg font-black shadow-sm"><CheckCircle2 className="size-6 text-emerald-500" />{control}</div>)}</div><div className="mt-5 rounded-2xl bg-orange-500 p-4 text-center text-lg font-black text-white">沿斜面缓慢、匀速地拉动！</div></div>
      </div>
    </div>
  );
}

function DataScene({ state, teacherToken }: { state: ClassroomState; teacherToken: string }) {
  const data = classAverages(state);
  const completed = state.groups.filter((group) => group.measurements).length;
  async function markGroup(groupNumber: number, status: 'locked' | 'needs_changes') {
    await fetch(`/api/sessions/${state.code}/state`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${teacherToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupNumber, status }),
    });
  }
  return (
    <div className="flex h-full flex-col p-[clamp(1.5rem,3vw,3rem)]">
      <div className="flex items-center justify-between"><SceneLabel icon={BarChart3}>研讨 · 全班数据汇总</SceneLabel><TeacherManualEntry state={state} teacherToken={teacherToken} /></div>
      <div className="mt-4 grid flex-1 grid-cols-[1fr_1.05fr] gap-6 overflow-hidden">
        <div className="overflow-auto rounded-[1.5rem] border border-slate-200"><table className="w-full border-collapse text-center"><thead className="sticky top-0 bg-primary text-white"><tr><th className="p-3 text-left">项目组</th>{CONDITIONS.map((item) => <th key={item.key} className="p-3">{item.shortLabel}<span className="block text-xs text-sky-200">平均拉力/N</span></th>)}<th className="p-3">反馈</th></tr></thead><tbody>{state.groups.map((group) => <tr key={group.groupNumber} className="border-b border-slate-100"><th className="p-3 text-left font-black">第{group.groupNumber}组</th>{CONDITIONS.map(({ key }) => <td key={key} className="p-3 text-lg font-black tabular-nums">{group.measurements ? average(group.measurements[key]) : <span className="text-sm text-slate-300">等待</span>}</td>)}<td className="p-2"><div className="flex justify-center gap-1"><Button size="xs" variant={group.status === 'locked' ? 'default' : 'outline'} disabled={!group.measurements} onClick={() => void markGroup(group.groupNumber, 'locked')}>锁定</Button><Button size="xs" variant={group.status === 'needs_changes' ? 'destructive' : 'outline'} disabled={!group.measurements} onClick={() => void markGroup(group.groupNumber, 'needs_changes')}>修改</Button></div></td></tr>)}</tbody></table></div>
        <div className="flex flex-col rounded-[1.5rem] bg-slate-50 p-5"><div className="flex items-center justify-between"><div><p className="text-lg font-black">全班平均拉力</p><p className="text-sm font-bold text-slate-500">数据随小组提交实时更新</p></div><span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-700">{completed}/{state.groupCount} 组完成</span></div><ChartContainer config={{ value: { label: '平均拉力', color: '#1769aa' } }} className="mt-3 min-h-0 flex-1"><BarChart data={data} accessibilityLayer><CartesianGrid vertical={false} /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis domain={[0, 'auto']} unit="N" /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="value" radius={[12, 12, 0, 0]}>{data.map((item, index) => <Cell key={item.name} fill={['#64748b', '#f58a2c', '#3b82b6', '#1f9d71'][index]} />)}</Bar></BarChart></ChartContainer></div>
      </div>
    </div>
  );
}

function TeacherManualEntry({ state, teacherToken }: { state: ClassroomState; teacherToken: string }) {
  const [open, setOpen] = useState(false);
  const [groupNumber, setGroupNumber] = useState(1);
  const [measurements, setMeasurements] = useState<Measurements>(EMPTY_MEASUREMENTS);
  const [conclusion, setConclusion] = useState('斜面越平缓，需要的拉力越小。');
  const [message, setMessage] = useState('');
  async function submit() {
    const response = await fetch(`/api/sessions/${state.code}/submissions`, { method: 'POST', headers: { Authorization: `Bearer ${teacherToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'measurements', groupNumber, measurements, conclusion }) });
    const data = (await response.json()) as { error?: string };
    setMessage(response.ok ? '代录成功' : data.error || '代录失败');
    if (response.ok) setTimeout(() => setOpen(false), 600);
  }
  return <div className="relative"><Button variant="outline" onClick={() => setOpen((value) => !value)}><Users className="size-4" /> 为掉线小组代录</Button>{open && <div className="absolute right-0 top-12 z-30 w-[min(720px,82vw)] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-lg font-black">教师代录实验数据</h3><select value={groupNumber} onChange={(event) => setGroupNumber(Number(event.target.value))} className="rounded-xl border border-slate-200 px-3 py-2 font-black">{state.groups.map((group) => <option key={group.groupNumber} value={group.groupNumber}>第{group.groupNumber}组</option>)}</select></div><MeasurementGrid measurements={measurements} setMeasurements={setMeasurements} compact /><Textarea value={conclusion} onChange={(event) => setConclusion(event.target.value)} className="mt-4" /><div className="mt-4 flex items-center justify-between"><span className="text-sm font-bold text-emerald-600">{message}</span><Button onClick={() => void submit()}>保存代录数据</Button></div></div>}</div>;
}

function MeasurementGrid({ measurements, setMeasurements, compact = false }: { measurements: Measurements; setMeasurements: (value: Measurements) => void; compact?: boolean }) {
  return <div className={`mt-4 grid gap-2 ${compact ? 'text-sm' : ''}`}>{CONDITIONS.map(({ key, label }) => <div key={key} className="grid grid-cols-[minmax(110px,1fr)_repeat(3,80px)_70px] items-center gap-2"><span className="font-black">{label}</span>{measurements[key].map((value, index) => <Input key={index} aria-label={`${label}第${index + 1}次拉力`} type="number" min="0.1" max="20" step="0.1" value={value || ''} onChange={(event) => { const next = { ...measurements, [key]: [...measurements[key]] } as Measurements; next[key][index] = Number(event.target.value); setMeasurements(next); }} className="text-center" />)}<span className="text-center font-black text-primary">{average(measurements[key]) || '—'} N</span></div>)}</div>;
}

function ConclusionScene({ state, updateState }: { state: ClassroomState; updateState: (patch: Partial<ClassroomState>) => Promise<void> }) {
  const data = classAverages(state);
  return <div className="flex h-full flex-col p-[clamp(1.5rem,3vw,3rem)]"><div className="flex items-center justify-between"><SceneLabel icon={Sparkles} tone="green">研讨 · 用证据形成结论</SceneLabel><Button onClick={() => void updateState({ answerRevealed: !state.answerRevealed })} className={state.answerRevealed ? 'bg-emerald-600 text-white' : 'bg-orange-500 text-white hover:bg-orange-600'}>{state.answerRevealed ? <RotateCcw className="size-4" /> : <LockKeyhole className="size-4" />}{state.answerRevealed ? '重新隐藏' : '揭示科学结论'}</Button></div><div className="mt-5 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(330px,0.62fr)] gap-6"><ChartContainer config={{ value: { label: '平均拉力', color: '#1769aa' } }} className="min-h-0 rounded-[2rem] bg-slate-50 p-4"><BarChart data={data} accessibilityLayer><CartesianGrid vertical={false} /><XAxis dataKey="name" /><YAxis unit="N" /><Bar dataKey="value" fill="#1769aa" radius={[12, 12, 0, 0]} /></BarChart></ChartContainer><div className="flex min-h-0 flex-col justify-center overflow-auto rounded-[2rem] border-2 border-dashed border-emerald-200 bg-emerald-50 p-7"><p className="text-base font-black text-emerald-700">我的发现</p>{state.answerRevealed ? <div className="mt-4 space-y-4 text-[clamp(1.4rem,2vw,2.25rem)] font-black leading-tight"><p>使用斜面可以<span className="text-orange-600">省力</span>。</p><p>斜面越<span className="text-primary">平缓</span>，需要的拉力越<span className="text-primary">小</span>。</p><p>同时，移动的距离会更<span className="text-orange-600">长</span>。</p></div> : <div className="mt-4 space-y-4 text-[clamp(1.4rem,2vw,2.25rem)] font-black leading-tight text-slate-400"><p>使用斜面可以 ______。</p><p>斜面越 ______，需要的拉力越 ______。</p><p>同时，移动的距离会更 ______。</p></div>}<p className="mt-5 text-sm font-bold leading-6 text-slate-500">请先让项目组根据实验数据发言，再揭示并完善科学表达。</p></div></div></div>;
}

function RouteDesignScene({ state }: { state: ClassroomState }) {
  const submitted = state.groups.filter((group) => group.routeType).length;
  return <div className="relative flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#dff3fa_0_58%,#d9e9c4_58%)] p-[clamp(1.7rem,3vw,3rem)]"><SceneLabel icon={Mountain} tone="orange">应用 · 搬家测试 2</SceneLabel><div className="relative z-10 mt-4 max-w-3xl"><h2 className="text-[clamp(2.6rem,4vw,4.3rem)] font-black leading-tight">货车怎样平稳上山？</h2><p className="mt-3 text-xl font-bold text-slate-600">设计路线，测试并改进。比较坡度、路程和稳定性。</p></div><div className="relative z-10 mt-auto grid grid-cols-4 gap-3">{state.groups.map((group) => <div key={group.groupNumber} className="min-h-28 rounded-2xl border border-white bg-white/88 p-4 shadow-lg backdrop-blur"><div className="flex items-center justify-between"><p className="font-black text-primary">第{group.groupNumber}组</p>{group.routeType && <Route className="size-5 text-orange-500" />}</div><p className="mt-2 text-lg font-black">{group.routeType || '等待方案'}</p><p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-slate-500">{group.routeReason || '完成赛道测试后提交路线与理由'}</p></div>)}</div><div className="absolute bottom-0 right-0 h-[76%] w-[52%] rounded-tl-[70%] bg-[linear-gradient(140deg,#7eb45d,#3f8b4b)] opacity-55" /><Truck className="absolute bottom-[22%] right-[42%] size-16 text-orange-500" /><span className="absolute right-8 top-8 rounded-full bg-white/85 px-4 py-2 text-sm font-black text-primary">{submitted}/{state.groupCount} 组已提交</span></div>;
}

function RouteCompareScene({ state }: { state: ClassroomState }) {
  const [route, setRoute] = useState<'直上路线' | '折线路线' | '盘绕路线'>('盘绕路线');
  const info = { 直上路线: ['坡度大', '路程短', '较费力'], 折线路线: ['坡度中等', '路程中等', '较稳定'], 盘绕路线: ['坡度平缓', '路程长', '更省力'] }[route];
  return <div className="flex h-full flex-col p-[clamp(2rem,4vw,4rem)]"><SceneLabel icon={Route} tone="green">工程 · 比较路线方案</SceneLabel><div className="mt-5 grid flex-1 grid-cols-[1.2fr_0.8fr] gap-8"><div className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(#dff3fb_0_48%,#dcebc7_48%)]"><div className="absolute bottom-0 right-0 h-[78%] w-[78%] rounded-tl-[100%] bg-[linear-gradient(145deg,#7fbb62,#3d8b4f)]" /><svg viewBox="0 0 600 420" className="absolute inset-0 h-full w-full" aria-label={`${route}示意`}><path d={route === '直上路线' ? 'M70 350 L510 75' : route === '折线路线' ? 'M70 350 L280 300 L185 215 L400 170 L510 75' : 'M70 350 C260 375 375 320 275 270 C180 215 340 180 470 190 C545 195 560 125 510 75'} fill="none" stroke="white" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" /><path d={route === '直上路线' ? 'M70 350 L510 75' : route === '折线路线' ? 'M70 350 L280 300 L185 215 L400 170 L510 75' : 'M70 350 C260 375 375 320 275 270 C180 215 340 180 470 190 C545 195 560 125 510 75'} fill="none" stroke="#f58a2c" strokeWidth="5" strokeDasharray="12 12" /></svg><Truck className="absolute bottom-[12%] left-[10%] size-16 text-orange-500" /><House className="absolute right-[8%] top-[7%] size-16 text-white" /></div><div className="flex flex-col justify-center"><h2 className="text-4xl font-black">同样到达山顶，路线有什么不同？</h2><div className="mt-6 grid gap-3">{(['直上路线', '折线路线', '盘绕路线'] as const).map((item) => <button key={item} type="button" onClick={() => setRoute(item)} className={`rounded-2xl border-2 p-4 text-left text-xl font-black transition ${route === item ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white'}`}>{item}<span className="ml-3 text-sm opacity-70">{state.groups.filter((group) => group.routeType === item).length} 组选择</span></button>)}</div><div className="mt-6 grid grid-cols-3 gap-2">{info.map((item) => <span key={item} className="rounded-xl bg-emerald-100 p-3 text-center text-sm font-black text-emerald-800">{item}</span>)}</div></div></div></div>;
}

function TransferScene() {
  const examples = [
    ['刀刃', '把较小的力集中在薄刃上'], ['斧头', '劈开木材更省力'], ['螺丝钉', '把斜面绕在圆柱上'], ['水渠', '让水沿缓坡流动'], ['楼梯', '分段升高更轻松'], ['盘山公路', '延长路程减小坡度'],
  ];
  const [open, setOpen] = useState<string[]>([]);
  return <div className="flex h-full flex-col p-[clamp(2rem,4vw,4rem)]"><SceneLabel icon={Sparkles} tone="green">拓展 · 生活中的斜面</SceneLabel><div className="mt-4 flex items-end justify-between"><div><h2 className="text-[clamp(2.4rem,4vw,4rem)] font-black">找一找：斜面藏在哪里？</h2><p className="mt-2 text-lg font-bold text-slate-500">点击实例，说一说它给生活带来了什么便利。</p></div><span className="text-lg font-black text-primary">已发现 {open.length}/6</span></div><div className="mt-6 grid flex-1 grid-cols-3 gap-4">{examples.map(([name, benefit], index) => { const active = open.includes(name); return <button key={name} type="button" onClick={() => setOpen((items) => items.includes(name) ? items.filter((item) => item !== name) : [...items, name])} className={`relative overflow-hidden rounded-[1.5rem] border-2 p-5 text-left transition ${active ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-primary/40'}`}><span className="text-5xl">{['🔪', '🪓', '🔩', '💧', '🪜', '🛣️'][index]}</span><p className="mt-3 text-2xl font-black">{name}</p><p className={`mt-2 text-base font-bold leading-6 ${active ? 'text-emerald-700' : 'text-transparent'}`}>{active ? benefit : '点击发现用途'}</p>{active && <CheckCircle2 className="absolute right-4 top-4 size-7 text-emerald-500" />}</button>; })}</div><div className="mt-5 flex items-center justify-between rounded-2xl bg-primary px-6 py-4 text-white"><p className="text-xl font-black">科学让劳动更轻松，也让设计更合理。</p><span className="font-black text-sky-200">项目会议完成</span></div></div>;
}
