'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  FlaskConical,
  LoaderCircle,
  LockKeyhole,
  Radio,
  RefreshCcw,
  Send,
  Users,
  WifiOff,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RoutePlanner } from '@/components/classroom/route-planner';
import type { RoutePlan } from '@/lib/route-design';
import {
  average,
  ClassroomState,
  CONDITIONS,
  EMPTY_MEASUREMENTS,
  Measurements,
  validateMeasurements,
} from '@/lib/classroom-types';

const SCENE_HELP = [
  '全班数据汇总 · 录入三次拉力',
  '上山路线设计 · 提交路线作品',
];

function panelIndex(scene: number) {
  return scene >= 6 ? 1 : 0;
}

type SavedIdentity = { groupNumber: number; deviceToken: string };

export function StudentApp({ code }: { code: string }) {
  const [state, setState] = useState<ClassroomState | null>(null);
  const [identity, setIdentity] = useState<SavedIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [joining, setJoining] = useState<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(`incline:group:${code}`);
    if (saved) {
      try {
        setIdentity(JSON.parse(saved) as SavedIdentity);
      } catch {
        localStorage.removeItem(`incline:group:${code}`);
      }
    }
  }, [code]);

  const fetchState = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${code}/state`, {
        headers: identity ? { Authorization: `Bearer ${identity.deviceToken}` } : undefined,
        cache: 'no-store',
      });
      const data = (await response.json()) as ClassroomState & { error?: string };
      if (!response.ok) throw new Error(data.error || '课堂读取失败');
      setState(data);
      setOffline(false);
      setError('');
    } catch (caught) {
      setOffline(true);
      setError(caught instanceof Error ? caught.message : '暂时无法连接课堂');
    } finally {
      setLoading(false);
    }
  }, [code, identity]);

  useEffect(() => {
    void fetchState();
    const interval = window.setInterval(fetchState, 2000);
    return () => window.clearInterval(interval);
  }, [fetchState]);

  async function join(groupNumber: number) {
    setJoining(groupNumber);
    setError('');
    try {
      const saved = localStorage.getItem(`incline:group:${code}`);
      const previous = saved ? (JSON.parse(saved) as SavedIdentity) : null;
      const response = await fetch(`/api/sessions/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupNumber,
          deviceToken: previous?.groupNumber === groupNumber ? previous.deviceToken : undefined,
        }),
      });
      const data = (await response.json()) as SavedIdentity & { error?: string };
      if (!response.ok || !data.deviceToken) throw new Error(data.error || '加入失败');
      const next = { groupNumber: data.groupNumber, deviceToken: data.deviceToken };
      localStorage.setItem(`incline:group:${code}`, JSON.stringify(next));
      setIdentity(next);
      await fetchState();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '加入失败');
    } finally {
      setJoining(null);
    }
  }

  async function submit(payload: Record<string, unknown>) {
    if (!identity) throw new Error('请先加入小组');
    const response = await fetch(`/api/sessions/${code}/submissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${identity.deviceToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(data.error || '提交失败');
    await fetchState();
  }

  if (loading) return <MobileNotice icon={LoaderCircle} title="正在进入项目会议…" spinning />;
  if (!state) return <MobileNotice icon={CircleAlert} title={error || '课堂不存在'} action={<Button onClick={() => void fetchState()}><RefreshCcw className="size-4" />重试</Button>} />;

  if (!identity) {
    return (
      <main className="min-h-screen bg-[linear-gradient(160deg,#eaf7fb,#fff8ec)] px-4 py-6">
        <section className="mx-auto max-w-lg">
          <a href="/join" className="inline-flex items-center gap-2 text-sm font-black text-slate-500"><ArrowLeft className="size-4" /> 更换课堂码</a>
          <div className="mt-5 rounded-[1.75rem] bg-white p-6 shadow-[0_20px_60px_rgba(30,64,95,0.14)]">
            <div className="flex items-center justify-between"><div><p className="text-sm font-black text-primary">课堂 {code}</p><h1 className="mt-1 text-3xl font-black">选择项目组</h1></div><Users className="size-10 text-orange-500" /></div>
            <p className="mt-3 leading-7 text-slate-600">请选择教师分配给你们的小组。灰色组号尚未加入。</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {state.groups.map((group) => (
                <button key={group.groupNumber} type="button" disabled={group.joined || joining !== null} onClick={() => void join(group.groupNumber)} className={`relative h-24 rounded-2xl border-2 text-xl font-black transition ${group.joined ? 'border-slate-200 bg-slate-100 text-slate-400' : 'border-primary/20 bg-sky-50 text-primary active:scale-[0.98]'}`}>
                  第 {group.groupNumber} 组
                  <span className="mt-1 block text-xs font-bold">{group.joined ? '已加入' : joining === group.groupNumber ? '正在加入…' : '点击加入'}</span>
                </button>
              ))}
            </div>
            {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
          </div>
        </section>
      </main>
    );
  }

  const group = state.groups.find((item) => item.groupNumber === identity.groupNumber);
  return (
    <main className="min-h-screen bg-[#edf6f8] pb-24">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-white"><FlaskConical className="size-5" /></span>
          <div><p className="text-sm font-black text-primary">第 {identity.groupNumber} 组 · 课堂 {code}</p><p className="text-xs font-bold text-slate-500">{SCENE_HELP[panelIndex(state.scene)]}</p></div>
          <span className="ml-auto rounded-full bg-sky-50 px-3 py-1.5 text-xs font-black text-primary">{panelIndex(state.scene) + 1}/2</span>
        </div>
      </header>
      {offline && <div className="flex items-center justify-center gap-2 bg-orange-100 p-2 text-xs font-black text-orange-800"><WifiOff className="size-4" />网络中断，暂时无法提交</div>}
      {state.submissionsPaused && <div className="flex items-center justify-center gap-2 bg-slate-800 p-2 text-xs font-black text-white"><LockKeyhole className="size-4" />教师已暂停提交</div>}
      {((panelIndex(state.scene) === 0 ? group?.measurementStatus : group?.routeStatus) === 'locked') && <div className="flex items-center justify-center gap-2 bg-emerald-100 p-2 text-xs font-black text-emerald-800"><CheckCircle2 className="size-4" />教师已确认并锁定本板块提交</div>}
      {((panelIndex(state.scene) === 0 ? group?.measurementStatus : group?.routeStatus) === 'needs_changes') && <div className="flex items-center justify-center gap-2 bg-red-100 p-2 text-xs font-black text-red-800"><CircleAlert className="size-4" />教师请本组检查当前内容并重新提交</div>}
      {((panelIndex(state.scene) === 0 ? group?.measurementStatus : group?.routeStatus) === 'submitted') && <div className="flex items-center justify-center gap-2 bg-sky-100 p-2 text-xs font-black text-primary"><Send className="size-4" />当前板块已提交，等待教师反馈</div>}
      <section className="mx-auto max-w-xl px-4 py-6">
        <StudentScene scene={state.scene} group={group} disabled={offline || state.submissionsPaused} submit={submit} answerRevealed={state.answerRevealed} />
      </section>
    </main>
  );
}

function StudentScene({ scene, group, disabled, submit, answerRevealed }: { scene: number; group: ClassroomState['groups'][number] | undefined; disabled: boolean; submit: (payload: Record<string, unknown>) => Promise<void>; answerRevealed: boolean }) {
  if (scene >= 6) return <RouteForm initial={group?.routePlan} groupNumber={group?.groupNumber} disabled={disabled || group?.routeStatus === 'locked'} submit={submit} />;
  return <MeasurementForm initial={group?.measurements} conclusion={group?.conclusion} disabled={disabled || group?.measurementStatus === 'locked'} submit={submit} answerRevealed={answerRevealed} />;
}

function PredictionForm({ value, disabled, submit }: { value?: string | null; disabled: boolean; submit: (payload: Record<string, unknown>) => Promise<void> }) {
  const [selected, setSelected] = useState(value || '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const choices = [['直接搬', '💪'], ['找人帮忙', '🤝'], ['使用斜面', '📐']];
  async function send() { setLoading(true); setMessage(''); try { await submit({ kind: 'prediction', value: selected }); setMessage('方案已提交！准备在全班说明理由。'); } catch (caught) { setMessage(caught instanceof Error ? caught.message : '提交失败'); } finally { setLoading(false); } }
  return <TaskCard label="任务 1" title="怎样把重物搬上货车？" intro="选择你们认为最合适的方案。先别找标准答案，准备说出理由。"><div className="grid gap-3">{choices.map(([choice, emoji]) => <button key={choice} type="button" disabled={disabled} onClick={() => setSelected(choice)} className={`flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition ${selected === choice ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white'}`}><span className="text-3xl">{emoji}</span><span className="text-lg font-black">{choice}</span>{selected === choice && <CheckCircle2 className="ml-auto size-6" />}</button>)}</div><SubmitButton disabled={disabled || !selected || loading} onClick={() => void send()} loading={loading} />{message && <Feedback text={message} good={message.includes('已提交')} />}</TaskCard>;
}

function MeasurementForm({ initial, conclusion, disabled, submit, answerRevealed }: { initial?: Measurements | null; conclusion?: string | null; disabled: boolean; submit: (payload: Record<string, unknown>) => Promise<void>; answerRevealed: boolean }) {
  const [measurements, setMeasurements] = useState<Measurements>(initial || EMPTY_MEASUREMENTS);
  const [finding, setFinding] = useState(conclusion || '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const valid = useMemo(() => validateMeasurements(measurements), [measurements]);
  async function send() { setLoading(true); setMessage(''); try { await submit({ kind: 'measurements', measurements, conclusion: finding.trim() || undefined }); setMessage('实验数据已提交！'); } catch (caught) { setMessage(caught instanceof Error ? caught.message : '提交失败'); } finally { setLoading(false); } }
  return <TaskCard label="板块 1" title="记录三次拉力" intro="单位是 N。每种情况都缓慢匀速拉动，重复三次，再看平均值。小组发现可以课上口头说明，也可以写在下面。"><div className="space-y-4">{CONDITIONS.map(({ key, label }) => <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><p className="font-black">{label}</p><span className="text-sm font-black text-primary">平均 {average(measurements[key]) || '—'} N</span></div><div className="mt-3 grid grid-cols-3 gap-2">{measurements[key].map((value, index) => <label key={index} className="text-center text-xs font-bold text-slate-500">第{index + 1}次<Input type="number" inputMode="decimal" min="0.1" max="20" step="0.1" disabled={disabled} value={value || ''} onChange={(event) => { const next = { ...measurements, [key]: [...measurements[key]] } as Measurements; next[key][index] = Number(event.target.value); setMeasurements(next); }} className="mt-1 h-11 text-center text-base font-black" /></label>)}</div></div>)}</div><label className="mt-6 block text-sm font-black text-slate-700">小组发现（选填）<Textarea disabled={disabled} value={finding} onChange={(event) => setFinding(event.target.value)} placeholder="例如：斜面越平缓，需要的拉力越小。" className="mt-2 min-h-24" /></label>{answerRevealed && <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-800">全班结论：斜面越平缓，需要的拉力越小，同时移动距离更长。</div>}<SubmitButton disabled={disabled || !valid || loading} onClick={() => void send()} loading={loading} />{message && <Feedback text={message} good={message.includes('已提交')} />}</TaskCard>;
}

function RouteForm({ initial, groupNumber, disabled, submit }: { initial?: RoutePlan | null; groupNumber?: number; disabled: boolean; submit: (payload: Record<string, unknown>) => Promise<void> }) {
  return <TaskCard label="板块 2" title="设计上山路线" intro="拖动三个路线节点，比较路程与坡度，测试后提交你们的路线作品。"><RoutePlanner initial={initial} groupNumber={groupNumber} disabled={disabled} onSubmit={(routePlan) => submit({ kind: 'route', routePlan })} /></TaskCard>;
}

function TaskCard({ label, title, intro, children }: { label: string; title: string; intro: string; children: React.ReactNode }) {
  return <div className="rounded-[1.75rem] bg-white p-5 shadow-[0_18px_50px_rgba(30,64,95,0.12)]"><span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">{label}</span><h1 className="mt-4 text-3xl font-black leading-tight">{title}</h1><p className="mt-3 mb-6 leading-7 text-slate-600">{intro}</p>{children}</div>;
}

function SubmitButton({ disabled, loading, onClick }: { disabled: boolean; loading: boolean; onClick: () => void }) {
  return <Button disabled={disabled} onClick={onClick} className="mt-6 h-13 w-full rounded-2xl bg-orange-500 text-base font-black text-white hover:bg-orange-600">{loading ? <LoaderCircle className="size-5 animate-spin" /> : <Send className="size-5" />}{loading ? '正在提交…' : '提交给教师大屏'}</Button>;
}

function Feedback({ text, good }: { text: string; good: boolean }) { return <output className={`mt-4 block rounded-xl p-3 text-sm font-black ${good ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{text}</output>; }

function WaitingCard({ icon: Icon, title, text, tone = 'blue' }: { icon: typeof Users; title: string; text: string; tone?: 'blue' | 'green' }) {
  return <div className="rounded-[1.75rem] bg-white p-7 text-center shadow-[0_18px_50px_rgba(30,64,95,0.12)]"><span className={`mx-auto grid size-20 place-items-center rounded-[1.5rem] ${tone === 'green' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-primary'}`}><Icon className="size-10" /></span><h1 className="mt-6 text-3xl font-black">{title}</h1><p className="mt-4 text-base font-medium leading-8 text-slate-600">{text}</p><div className="mt-8 flex items-center justify-center gap-2 text-sm font-black text-slate-400"><Radio className="size-4 animate-pulse" />正在跟随教师大屏</div></div>;
}

function MobileNotice({ icon: Icon, title, action, spinning }: { icon: typeof CircleAlert; title: string; action?: React.ReactNode; spinning?: boolean }) {
  return <main className="grid min-h-screen place-items-center bg-sky-50 p-6"><div className="text-center"><Icon className={`mx-auto size-10 text-primary ${spinning ? 'animate-spin' : ''}`} /><h1 className="mt-4 text-xl font-black">{title}</h1>{action && <div className="mt-5">{action}</div>}</div></main>;
}
