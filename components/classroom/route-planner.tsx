'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Gauge, LoaderCircle, Play, Route, Rotate3D, Send, Sparkles } from 'lucide-react';

import { MountainRoadLab } from '@/components/classroom/mountain-road-lab';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  calculateRouteMetrics,
  DEFAULT_ROUTE_PLAN,
  normalizeRoutePlan,
  ROUTE_EVIDENCE,
  ROUTE_STRATEGIES,
  type RouteEvidence,
  type RoutePlan,
} from '@/lib/route-design';
import { EMPTY_MOUNTAIN_ROAD, legacyMountainRoad, validateMountainRoad } from '@/lib/mountain-route';

export function RoutePlanner({
  initial,
  disabled = false,
  compact = false,
  groupNumber,
  submitLabel = '提交给教师大屏',
  onSubmit,
}: {
  initial?: RoutePlan | null;
  disabled?: boolean;
  compact?: boolean;
  groupNumber?: number;
  submitLabel?: string;
  onSubmit: (plan: RoutePlan) => Promise<void>;
}) {
  const [plan, setPlan] = useState<RoutePlan>(() => {
    if (initial) return initial.mountain ? initial : { ...initial, mountain: legacyMountainRoad(initial.waypointXs) };
    return { ...DEFAULT_ROUTE_PLAN, mountain: { ...EMPTY_MOUNTAIN_ROAD, nodes: [...EMPTY_MOUNTAIN_ROAD.nodes] } };
  });
  const [animateKey, setAnimateKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const metrics = useMemo(() => calculateRouteMetrics(plan), [plan]);
  const roadReady = plan.mountain ? validateMountainRoad(plan.mountain, true) === null : true;
  const valid = roadReady && plan.evidenceTags.length > 0 && plan.reason.trim().length >= 4;

  function toggleEvidence(tag: RouteEvidence) {
    setPlan((current) => ({
      ...current,
      evidenceTags: current.evidenceTags.includes(tag)
        ? current.evidenceTags.filter((item) => item !== tag)
        : [...current.evidenceTags, tag],
    }));
  }

  async function submit() {
    setLoading(true);
    setMessage('');
    try {
      await onSubmit(normalizeRoutePlan(plan));
      setMessage('路线作品已提交，教师大屏正在接收！');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : '提交失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={compact ? 'grid min-h-0 grid-cols-[1.1fr_0.9fr] gap-5' : ''}>
      <div>
        <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-2 shadow-inner">
          <MountainRoadLab
            plan={plan}
            groupNumber={groupNumber}
            editable={!disabled}
            disabled={disabled}
            compact={compact}
            animateKey={animateKey}
            onChange={setPlan}
            color="#f47c20"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs font-bold leading-5 text-slate-500"><Rotate3D className="size-4 shrink-0 text-primary" />先在“修路”模式点按山体铺路，连接山顶后切到“观察”旋转检查；“调整”可拖动节点。</p>
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => setAnimateKey((value) => value + 1)}>
            <Play className="size-3.5" /> 预览行驶
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Metric label="路线类型" value={roadReady ? metrics.routeType.replace('路线', '') : '待完成'} icon={<Route className="size-4" />} />
          <Metric label="相对路程" value={roadReady ? metrics.lengthLabel : '待完成'} detail={roadReady ? `${metrics.lengthRatio} 倍` : undefined} icon={<Sparkles className="size-4" />} />
          <Metric label="最陡路段" value={roadReady ? metrics.steepnessLabel : '待完成'} icon={<Gauge className="size-4" />} />
        </div>
        {!roadReady && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-center text-xs font-black text-amber-700">道路还没有接到山顶，完成建路后才能提交。</p>}
      </div>

      <div className={compact ? 'min-h-0 overflow-auto pr-1' : ''}>
        <fieldset className={compact ? '' : 'mt-6'} disabled={disabled}>
          <legend className="text-sm font-black text-slate-700">我们的设计目标</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {ROUTE_STRATEGIES.map((strategy) => (
              <button
                key={strategy}
                type="button"
                onClick={() => setPlan((current) => ({ ...current, strategy }))}
                className={`rounded-xl border-2 px-2 py-3 text-sm font-black transition ${
                  plan.strategy === strategy
                    ? 'border-primary bg-primary text-white'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                {strategy}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5" disabled={disabled}>
          <legend className="text-sm font-black text-slate-700">支持方案的证据（至少选择一项）</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ROUTE_EVIDENCE.map((tag) => {
              const selected = plan.evidenceTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleEvidence(tag)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-black transition ${
                    selected
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {selected && <CheckCircle2 className="size-3.5" />}
                  {tag}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="mt-5 block text-sm font-black text-slate-700">
          小组设计理由
          <Textarea
            disabled={disabled}
            value={plan.reason}
            maxLength={120}
            onChange={(event) => setPlan((current) => ({ ...current, reason: event.target.value }))}
            placeholder="例如：我们把路线绕得更长，让每一段坡都更平缓，货车上山会更省力、更稳定。"
            className={`mt-2 ${compact ? 'min-h-20' : 'min-h-28'}`}
          />
          <span className="mt-1 block text-right text-xs font-bold text-slate-400">{plan.reason.length}/120</span>
        </label>

        <Button
          disabled={disabled || !valid || loading}
          onClick={() => void submit()}
          className="mt-4 h-12 w-full rounded-2xl bg-orange-500 text-base font-black text-white hover:bg-orange-600"
        >
          {loading ? <LoaderCircle className="size-5 animate-spin" /> : <Send className="size-5" />}
          {loading ? '正在提交…' : submitLabel}
        </Button>
        {message && (
          <output className={`mt-3 block rounded-xl p-3 text-sm font-black ${message.includes('已提交') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {message}
          </output>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail?: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm">
      <p className="flex items-center gap-1 text-[11px] font-black text-slate-400">{icon}{label}</p>
      <p className="mt-1 text-base font-black text-primary">{value}{detail && <span className="ml-1 text-[11px] text-slate-400">{detail}</span>}</p>
    </div>
  );
}
