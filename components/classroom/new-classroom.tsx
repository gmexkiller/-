'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

export function NewClassroom() {
  const [groupCount, setGroupCount] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const createClassroom = useCallback(async (count = groupCount) => {
    if (!Number.isInteger(count) || count < 4 || count > 8) throw new Error('请选择 4–8 个小组');
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupCount: count }),
      });
      const data = (await response.json()) as { code?: string; teacherToken?: string; error?: string };
      if (!response.ok || !data.code || !data.teacherToken) throw new Error(data.error || '课堂创建失败');
      localStorage.setItem(`incline:teacher:${data.code}`, data.teacherToken);
      localStorage.setItem('incline:last-classroom', data.code);
      location.assign(`/teach/${data.code}`);
      return { code: data.code, groupCount: count };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '课堂创建失败';
      setError(message);
      throw caught;
    } finally {
      setLoading(false);
    }
  }, [groupCount]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'create_incline_classroom',
            title: '创建斜面科学课堂',
            description: '创建一节新的斜面公开课，并打开教师大屏。',
            inputSchema: {
              type: 'object',
              properties: { groupCount: { type: 'integer', minimum: 4, maximum: 8 } },
              required: ['groupCount'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute: (input: unknown) => {
              const count = (input as { groupCount?: number })?.groupCount;
              if (!Number.isInteger(count) || !count || count < 4 || count > 8) {
                throw new Error('groupCount 必须是 4–8 的整数');
              }
              setGroupCount(count);
              return createClassroom(count);
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => undefined);
    } catch {
      // Unsupported browser; the visible form remains fully functional.
    }
    return () => lifecycle.abort();
  }, [createClassroom]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_85%_10%,rgba(248,143,46,0.18),transparent_32%),linear-gradient(145deg,#eef8fb,#fffaf0)] px-5 py-8 md:grid md:place-items-center">
      <section className="mx-auto w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white bg-white/90 shadow-[0_30px_100px_rgba(30,64,95,0.14)] backdrop-blur">
        <div className="h-2 bg-[linear-gradient(90deg,#1769aa_0_55%,#f58a2c_55%)]" />
        <div className="p-7 md:p-12">
          <a href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary">
            <ArrowLeft className="size-4" /> 返回首页
          </a>
          <p className="text-sm font-black tracking-[0.2em] text-primary">课前准备 · 约 10 秒</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">创建项目会议</h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">选择今天的项目组数量。创建后，大屏会生成课堂码和扫码入口。</p>

          <div className="mt-10">
            <div className="mb-4 flex items-center gap-2 text-base font-black text-slate-800">
              <Users className="size-5 text-primary" /> 今天有多少个小组？
            </div>
            <div className="grid grid-cols-5 gap-3">
              {[4, 5, 6, 7, 8].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setGroupCount(count)}
                  aria-pressed={groupCount === count}
                  className={`relative grid h-20 place-items-center rounded-2xl border-2 text-2xl font-black transition ${
                    groupCount === count
                      ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-primary/40'
                  }`}
                >
                  {count}
                  {groupCount === count && <Check className="absolute right-2 top-2 size-4" />}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-9 rounded-2xl bg-sky-50 p-5 text-sm leading-7 text-slate-650">
            每组只需一台手机或平板。学生不需要注册，选择组号后即可提交预测、实验数据和路线方案。
          </div>
          {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
          <Button
            size="lg"
            onClick={() => void createClassroom()}
            disabled={loading}
            className="mt-8 h-14 w-full rounded-2xl bg-orange-500 text-base font-black text-white shadow-xl shadow-orange-500/20 hover:bg-orange-600"
          >
            {loading ? <LoaderCircle className="size-5 animate-spin" /> : <ArrowRight className="size-5" />}
            {loading ? '正在布置课堂…' : `创建 ${groupCount} 组课堂`}
          </Button>
        </div>
      </section>
    </main>
  );
}
