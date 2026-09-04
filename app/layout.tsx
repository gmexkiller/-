import type { Metadata } from 'next';

import './globals.css';
import { OfflineRegistrar } from '@/components/classroom/offline-registrar';

export const metadata: Metadata = {
  metadataBase: new URL('https://hulala-incline-classroom.yokey1016.chatgpt.site'),
  title: '斜面｜胡拉拉搬家公司科学公开课',
  description: '面向六年级科学公开课的教师大屏与小组互动平台。',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: '斜面｜胡拉拉搬家公司科学公开课',
    description: '教师大屏与小组扫码协作的六年级科学互动课堂。',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: '斜面｜胡拉拉搬家公司科学公开课',
    description: '教师大屏与小组扫码协作的六年级科学互动课堂。',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <OfflineRegistrar />
      </body>
    </html>
  );
}
