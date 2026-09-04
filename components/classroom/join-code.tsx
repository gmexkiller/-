'use client';

import { FormEvent, useState } from 'react';
import { ArrowLeft, ArrowRight, Smartphone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function JoinCode() {
  const [code, setCode] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (/^\d{6}$/.test(code)) location.assign(`/join/${code}`);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(160deg,#eaf7fb,#fff8ec)] px-5 py-10">
      <section className="w-full max-w-md rounded-[2rem] border border-white bg-white p-7 shadow-[0_25px_80px_rgba(30,64,95,0.15)] md:p-9">
        <a href="/" className="mb-9 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary">
          <ArrowLeft className="size-4" /> 返回首页
        </a>
        <div className="grid size-14 place-items-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
          <Smartphone className="size-7" />
        </div>
        <h1 className="mt-6 text-3xl font-black text-slate-950">加入项目组</h1>
        <p className="mt-3 leading-7 text-slate-600">输入教师大屏上的 6 位课堂码。</p>
        <form className="mt-8" onSubmit={submit}>
          <label htmlFor="code" className="text-sm font-black text-slate-700">课堂码</label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="mt-3 h-16 rounded-2xl border-2 text-center text-3xl font-black tracking-[0.35em]"
          />
          <Button type="submit" disabled={!/^\d{6}$/.test(code)} className="mt-5 h-13 w-full rounded-2xl text-base font-black">
            进入课堂 <ArrowRight className="size-5" />
          </Button>
        </form>
      </section>
    </main>
  );
}
