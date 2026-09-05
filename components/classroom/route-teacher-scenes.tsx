'use client';

/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Dialog semantics are applied to custom full-screen classroom overlays. */

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Columns2,
  Eye,
  EyeOff,
  Layers3,
  Maximize2,
  Mountain,
  PencilLine,
  Play,
  Route,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';

import { GROUP_ROUTE_COLORS, RouteMap, RouteOverlayMap } from '@/components/classroom/route-map';
import { RoutePlanner } from '@/components/classroom/route-planner';
import { Button } from '@/components/ui/button';
import type { ClassroomState, GroupRecord } from '@/lib/classroom-types';
import type { RoutePlan } from '@/lib/route-design';

function ScenePill({ icon: Icon, children }: { icon: typeof Mountain; children: React.ReactNode }) {
  return <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-700"><Icon className="size-4" />{children}</div>;
}

export function RouteDesignScene({
  state,
  teacherToken,
  offline,
  submitRoute,
}: {
  state: ClassroomState;
  teacherToken: string;
  offline: boolean;
  submitRoute: (groupNumber: number, plan: RoutePlan) => Promise<void>;
}) {
  const submitted = state.groups.filter((group) => group.routePlan).length;
  const [focusGroupNumber, setFocusGroupNumber] = useState<number | null>(null);
  const [overlay, setOverlay] = useState(false);
  const [editingGroupNumber, setEditingGroupNumber] = useState<number | null>(null);
  const [animateKey, setAnimateKey] = useState(0);
  const focusGroup = state.groups.find((group) => group.groupNumber === focusGroupNumber);
  const routes = state.groups
    .filter((group): group is GroupRecord & { routePlan: RoutePlan } => Boolean(group.routePlan))
    .map((group) => ({
      plan: group.routePlan,
      groupNumber: group.groupNumber,
      color: GROUP_ROUTE_COLORS[group.groupNumber - 1],
    }));

  async function markGroup(groupNumber: number, status: 'locked' | 'needs_changes') {
    if (offline) return;
    await fetch(`/api/sessions/${state.code}/state`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${teacherToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupNumber, status }),
    });
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[linear-gradient(160deg,#f7fbfc,#eef8ec)] p-[clamp(1.25rem,2.4vw,2.35rem)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <ScenePill icon={Mountain}>应用 · 搬家测试 2</ScenePill>
          <h2 className="mt-3 text-[clamp(2rem,3.4vw,3.5rem)] font-black leading-tight">全班上山路线作品墙</h2>
          <p className="mt-1 text-base font-bold text-slate-500">先看每组怎样权衡坡度和路程，再选出有代表性的方案讲评。</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-primary shadow-sm">{submitted}/{state.groupCount} 组已提交</span>
          <Button variant={overlay ? 'default' : 'outline'} onClick={() => setOverlay((value) => !value)} disabled={!routes.length}>
            <Layers3 className="size-4" /> {overlay ? '返回作品墙' : '全班叠加'}
          </Button>
          <Button variant="outline" onClick={() => setEditingGroupNumber(state.groups.find((group) => !group.routePlan)?.groupNumber || 1)}>
            <PencilLine className="size-4" /> 教师代录
          </Button>
        </div>
      </div>

      {overlay ? (
        <div className="mt-4 grid min-h-0 flex-1 grid-cols-[1fr_250px] gap-5">
          <div className="min-h-0 rounded-[1.75rem] bg-white p-3 shadow-lg">
            <RouteOverlayMap routes={routes} animateKey={animateKey} className="h-full" />
          </div>
          <div className="flex flex-col rounded-[1.75rem] bg-white p-5 shadow-lg">
            <p className="text-lg font-black">全班路线图例</p>
            <p className="mt-1 text-sm font-bold leading-6 text-slate-500">同一个起点和山顶，绕行越明显，路线通常越长、坡度越缓。</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {routes.map((route) => <span key={route.groupNumber} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-black"><i className="size-3 rounded-full" style={{ background: route.color }} />第{route.groupNumber}组</span>)}
            </div>
            <Button className="mt-auto bg-orange-500 text-white hover:bg-orange-600" onClick={() => setAnimateKey((value) => value + 1)}>
              <Play className="size-4" /> 同时播放路线
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid min-h-0 flex-1 grid-cols-2 gap-3 lg:grid-cols-4">
          {state.groups.map((group) => {
            const color = GROUP_ROUTE_COLORS[group.groupNumber - 1];
            return (
              <button
                key={group.groupNumber}
                type="button"
                disabled={!group.routePlan}
                onClick={() => setFocusGroupNumber(group.groupNumber)}
                className={`group relative flex min-h-0 flex-col items-stretch overflow-hidden rounded-[1.35rem] border-2 bg-white p-3 text-left shadow-sm transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-lg ${group.routePlan ? 'route-arrive border-white' : 'border-dashed border-slate-200'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full px-3 py-1 text-sm font-black text-white" style={{ background: color }}>第{group.groupNumber}组</span>
                  {group.routePlan ? <Maximize2 className="size-4 text-slate-400 group-hover:text-primary" /> : <span className="text-xs font-black text-slate-300">等待作品</span>}
                </div>
                {group.routePlan ? (
                  <>
                    <RouteMap plan={group.routePlan} color={color} compact className={`mt-2 ${state.groupCount <= 4 ? 'h-[230px]' : 'h-[92px]'}`} />
                    <div className="mt-2 flex items-center justify-between gap-2"><p className="font-black text-slate-800">{group.routeMetrics?.routeType}</p><span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">坡度{group.routeMetrics?.steepnessLabel}</span></div>
                    <p className="mt-1 line-clamp-1 text-xs font-bold text-slate-500">{group.routePlan.strategy} · {group.routePlan.reason}</p>
                  </>
                ) : (
                  <div className="mt-3 grid h-[128px] place-items-center rounded-xl bg-slate-50 text-center"><div><Route className="mx-auto size-8 text-slate-300" /><p className="mt-2 text-xs font-bold text-slate-400">学生提交后<br />路线图会出现在这里</p></div></div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {focusGroup?.routePlan && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-slate-950/55 p-6 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-label={`第${focusGroup.groupNumber}组路线焦点讲评`} className="grid max-h-full w-full max-w-5xl grid-cols-[1.15fr_0.85fr] gap-6 overflow-auto rounded-[2rem] bg-white p-6 shadow-2xl">
            <div>
              <div className="flex items-center justify-between"><span className="rounded-full px-4 py-2 font-black text-white" style={{ background: GROUP_ROUTE_COLORS[focusGroup.groupNumber - 1] }}>第{focusGroup.groupNumber}组路线作品</span><Button variant="ghost" size="icon" aria-label="关闭焦点讲评" onClick={() => setFocusGroupNumber(null)}><X className="size-5" /></Button></div>
              <RouteMap plan={focusGroup.routePlan} color={GROUP_ROUTE_COLORS[focusGroup.groupNumber - 1]} groupNumber={focusGroup.groupNumber} animateKey={animateKey} className="mt-4" />
              <Button className="mt-3 w-full bg-orange-500 text-white hover:bg-orange-600" onClick={() => setAnimateKey((value) => value + 1)}><Play className="size-4" />播放货车测试</Button>
            </div>
            <div className="flex flex-col">
              <p className="text-sm font-black text-emerald-700">设计目标</p><p className="mt-1 text-3xl font-black">{focusGroup.routePlan.strategy}</p>
              <div className="mt-5 grid grid-cols-3 gap-2"><Evidence label="路线" value={focusGroup.routeMetrics?.routeType.replace('路线', '') || '—'} /><Evidence label="相对路程" value={`${focusGroup.routeMetrics?.lengthRatio || '—'} 倍`} /><Evidence label="最陡路段" value={focusGroup.routeMetrics?.steepnessLabel || '—'} /></div>
              <p className="mt-5 text-sm font-black text-slate-500">小组证据</p><div className="mt-2 flex flex-wrap gap-2">{focusGroup.routePlan.evidenceTags.map((tag) => <span key={tag} className="rounded-full bg-emerald-100 px-3 py-2 text-sm font-black text-emerald-700">{tag}</span>)}</div>
              <div className="mt-5 rounded-2xl bg-sky-50 p-5"><p className="text-sm font-black text-primary">小组设计理由</p><p className="mt-2 text-lg font-bold leading-8 text-slate-700">{focusGroup.routePlan.reason || '旧版方案未填写理由'}</p></div>
              <div className="mt-auto grid grid-cols-2 gap-3 pt-5"><Button variant="destructive" disabled={offline} onClick={() => void markGroup(focusGroup.groupNumber, 'needs_changes')}><RotateCcw className="size-4" />退回修改</Button><Button disabled={offline} onClick={() => void markGroup(focusGroup.groupNumber, 'locked')} className="bg-emerald-600 text-white hover:bg-emerald-700"><CheckCircle2 className="size-4" />确认方案</Button></div>
            </div>
          </section>
        </div>
      )}

      {editingGroupNumber !== null && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-slate-950/55 p-6 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-label="教师代录路线" className="max-h-full w-full max-w-5xl overflow-auto rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between"><div><p className="text-sm font-black text-orange-600">离线或设备异常时使用</p><h3 className="text-2xl font-black">教师代录路线作品</h3></div><div className="flex items-center gap-3"><select value={editingGroupNumber} onChange={(event) => setEditingGroupNumber(Number(event.target.value))} className="rounded-xl border border-slate-200 px-3 py-2 font-black">{state.groups.map((group) => <option key={group.groupNumber} value={group.groupNumber}>第{group.groupNumber}组</option>)}</select><Button variant="ghost" size="icon" aria-label="关闭教师代录" onClick={() => setEditingGroupNumber(null)}><X className="size-5" /></Button></div></div>
            <div className="mt-4"><RoutePlanner key={editingGroupNumber} compact groupNumber={editingGroupNumber} initial={state.groups.find((group) => group.groupNumber === editingGroupNumber)?.routePlan} submitLabel="保存代录路线" onSubmit={async (plan) => { await submitRoute(editingGroupNumber, plan); setEditingGroupNumber(null); }} /></div>
          </section>
        </div>
      )}
    </div>
  );
}

export function RouteCompareScene({ state, updateState }: { state: ClassroomState; updateState: (patch: Partial<ClassroomState>) => Promise<void> }) {
  const completed = useMemo(() => state.groups.filter((group) => group.routePlan), [state.groups]);
  const defaults = useMemo(() => {
    if (!completed.length) return [];
    const shortest = [...completed].sort((a, b) => (a.routeMetrics?.lengthRatio || 99) - (b.routeMetrics?.lengthRatio || 99))[0];
    if (completed.length === 1) return [shortest.groupNumber];
    const gentlest = [...completed].sort((a, b) => (a.routeMetrics?.steepnessScore || 99) - (b.routeMetrics?.steepnessScore || 99)).find((group) => group.groupNumber !== shortest.groupNumber) || shortest;
    return [shortest.groupNumber, gentlest.groupNumber];
  }, [completed]);
  const [selected, setSelected] = useState<number[]>(defaults);
  const [animateKey, setAnimateKey] = useState(0);

  const validSelected = selected.filter((number) => completed.some((group) => group.groupNumber === number));
  const activeSelected = validSelected.length >= Math.min(2, completed.length) ? validSelected : defaults;

  function toggleGroup(groupNumber: number) {
    setSelected((current) => current.includes(groupNumber) ? current.filter((value) => value !== groupNumber) : [...current.slice(-1), groupNumber]);
  }

  const compared = activeSelected.map((number) => completed.find((group) => group.groupNumber === number)).filter((group): group is GroupRecord & { routePlan: RoutePlan } => Boolean(group?.routePlan));
  const routes = compared.map((group) => ({ groupNumber: group.groupNumber, plan: group.routePlan, color: GROUP_ROUTE_COLORS[group.groupNumber - 1] }));

  return (
    <div className="flex h-full flex-col overflow-hidden p-[clamp(1.25rem,2.4vw,2.35rem)]">
      <div className="flex items-start justify-between gap-5"><div><ScenePill icon={Columns2}>工程 · 路线证据比较</ScenePill><h2 className="mt-3 text-[clamp(2rem,3.2vw,3.35rem)] font-black leading-tight">同样到达山顶，哪条路线更合理？</h2></div><div className="flex max-w-[48%] flex-wrap justify-end gap-2">{completed.map((group) => <button key={group.groupNumber} type="button" aria-pressed={activeSelected.includes(group.groupNumber)} onClick={() => toggleGroup(group.groupNumber)} className={`rounded-full border-2 px-3 py-2 text-sm font-black ${activeSelected.includes(group.groupNumber) ? 'border-transparent text-white' : 'border-slate-200 bg-white text-slate-600'}`} style={activeSelected.includes(group.groupNumber) ? { background: GROUP_ROUTE_COLORS[group.groupNumber - 1] } : undefined}>第{group.groupNumber}组</button>)}</div></div>

      {compared.length ? (
        <div className="mt-4 grid min-h-0 flex-1 grid-cols-[1.1fr_0.9fr] gap-5">
          <div className="flex min-h-0 flex-col rounded-[1.75rem] bg-slate-50 p-3"><RouteOverlayMap routes={routes} animateKey={animateKey} className="min-h-0 flex-1" /><Button className="mt-3 bg-orange-500 text-white hover:bg-orange-600" onClick={() => setAnimateKey((value) => value + 1)}><Play className="size-4" />同步播放两条路线</Button></div>
          <div className="flex min-h-0 flex-col overflow-auto rounded-[1.75rem] border border-slate-200 bg-white p-5">
            <p className="text-lg font-black">学生证据对照</p>
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200"><table className="w-full text-sm"><thead><tr className="bg-slate-100"><th className="p-3 text-left">证据</th>{compared.map((group) => <th key={group.groupNumber} className="p-3 text-center" style={{ color: GROUP_ROUTE_COLORS[group.groupNumber - 1] }}>第{group.groupNumber}组</th>)}</tr></thead><tbody>{[['设计目标', (g: GroupRecord) => g.routePlan?.strategy], ['相对路程', (g: GroupRecord) => `${g.routeMetrics?.lengthRatio} 倍（${g.routeMetrics?.lengthLabel}）`], ['最陡路段', (g: GroupRecord) => g.routeMetrics?.steepnessLabel], ['转弯次数', (g: GroupRecord) => `${g.routeMetrics?.turnCount} 次`]].map(([label, read]) => <tr key={String(label)} className="border-t border-slate-100"><th className="p-3 text-left font-black text-slate-500">{String(label)}</th>{compared.map((group) => <td key={group.groupNumber} className="p-3 text-center font-black">{(read as (g: GroupRecord) => React.ReactNode)(group)}</td>)}</tr>)}</tbody></table></div>
            <div className="mt-3 grid gap-2">{compared.map((group) => <div key={group.groupNumber} className="rounded-xl bg-sky-50 p-3 text-sm font-bold leading-6"><span className="mr-2 font-black" style={{ color: GROUP_ROUTE_COLORS[group.groupNumber - 1] }}>第{group.groupNumber}组：</span>{group.routePlan?.reason}</div>)}</div>
            <div className="mt-auto pt-4"><Button onClick={() => void updateState({ engineeringRevealed: !state.engineeringRevealed })} className={`w-full ${state.engineeringRevealed ? 'bg-slate-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white`}>{state.engineeringRevealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}{state.engineeringRevealed ? '重新隐藏工程结论' : '揭示工程结论'}</Button>{state.engineeringRevealed && <div className="mt-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 text-lg font-black leading-8 text-emerald-900"><Sparkles className="mr-2 inline size-5 text-orange-500" />路线越平缓，上坡越省力，但行驶路程通常更长；盘山公路正是斜面的应用。</div>}</div>
          </div>
        </div>
      ) : <div className="mt-6 grid flex-1 place-items-center rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50 text-center"><div><Route className="mx-auto size-14 text-slate-300" /><p className="mt-4 text-xl font-black text-slate-500">等待小组提交路线作品</p></div></div>}
    </div>
  );
}

function Evidence({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-xs font-black text-slate-400">{label}</p><p className="mt-1 font-black text-primary">{value}</p></div>;
}
