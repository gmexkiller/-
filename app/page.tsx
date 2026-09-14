import { ArrowRight, FlaskConical, Presentation, Smartphone } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <section className="relative isolate min-h-screen">
        <img
          src="/hero-incline.png"
          alt="橙色搬家货车、木质斜面与等待搬运的纸箱"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[68%_center]"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(245,250,252,0.98)_0%,rgba(245,250,252,0.94)_37%,rgba(245,250,252,0.25)_67%,rgba(245,250,252,0.05)_100%)]" />

        <header className="mx-auto flex w-full max-w-[1500px] items-center justify-between px-6 py-7 md:px-12">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <FlaskConical className="size-6" />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-primary">科学课 3.2</p>
              <p className="text-lg font-black">胡拉拉搬家公司</p>
            </div>
          </div>
          <span className="rounded-full border border-white/70 bg-white/75 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm backdrop-blur">
            六年级 · 公开课互动平台
          </span>
        </header>

        <div className="mx-auto grid min-h-[calc(100vh-100px)] w-full max-w-[1500px] items-center px-6 pb-20 md:px-12 lg:grid-cols-[minmax(0,680px)_1fr]">
          <div className="max-w-[680px] pb-12">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50/90 px-4 py-2 text-sm font-bold text-orange-700">
              <span className="size-2 rounded-full bg-orange-500" />
              今日项目会议：怎样更轻松地搬运重物？
            </div>
            <h1 className="text-balance text-[clamp(3.6rem,7vw,7.5rem)] font-black leading-[0.9] tracking-[-0.07em] text-slate-950">
              斜面
              <span className="mt-4 block text-[0.38em] font-bold tracking-[-0.03em] text-primary">
                让证据带我们找到答案
              </span>
            </h1>
            <p className="mt-8 max-w-xl text-lg font-medium leading-8 text-slate-600 md:text-xl">
              创建课堂，让 4–8 个项目组扫码加入。汇总全班拉力数据，再把科学规律用到真实的上山路线中。
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <a
                href="/teach/new"
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  'h-14 rounded-2xl bg-orange-500 px-7 text-base font-black text-white shadow-xl shadow-orange-500/25 hover:bg-orange-600',
                )}
              >
                <Presentation className="size-5" />
                创建一节课堂
                <ArrowRight className="size-5" />
              </a>
              <a
                href="/join"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'lg' }),
                  'h-14 rounded-2xl border-white bg-white/80 px-7 text-base font-black shadow-lg backdrop-blur hover:bg-white',
                )}
              >
                <Smartphone className="size-5 text-primary" />
                小组加入
              </a>
            </div>

            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-sm font-bold text-slate-600">
              <span>✓ 全班平均拉力</span>
              <span>✓ 路线作品墙</span>
              <span>✓ 小组实时提交</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
