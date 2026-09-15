import { copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const standalone = '.next/standalone';
const release = 'output/斜面课堂局域网版';
const savedDataPath = path.join(release, 'data', 'local-classrooms.json');
let savedData = null;

try {
  savedData = await readFile(savedDataPath);
} catch {
  // A first build has no local classroom data to preserve.
}

await rm(release, { force: true, recursive: true });
await mkdir(path.join(release, '.next'), { recursive: true });
await cp(standalone, release, { recursive: true });
await cp('public', path.join(release, 'public'), { recursive: true });
await cp('.next/static', path.join(release, '.next', 'static'), { recursive: true });
await copyFile(process.execPath, path.join(release, 'node.exe'));
await copyFile('scripts/start-lan.mjs', path.join(release, 'start-lan.mjs'));

await writeFile(
  path.join(release, '启动课堂.cmd'),
  `@echo off\r\nchcp 65001 >nul\r\ncd /d "%~dp0"\r\ntitle 胡拉拉斜面局域网课堂\r\nnode.exe start-lan.mjs\r\nif errorlevel 1 pause\r\n`,
  'utf8',
);

await writeFile(
  path.join(release, '使用说明.txt'),
  `胡拉拉《斜面》局域网课堂\r\n\r\n1. 教师电脑连接教室 Wi-Fi。\r\n2. 双击“启动课堂.cmd”。\r\n3. 如果 Windows 防火墙询问，请勾选“专用网络”并允许访问。\r\n4. 浏览器会自动打开教师入口；创建课堂后，大屏二维码会自动使用教师电脑的局域网地址。\r\n5. 学生平板连接同一个 Wi-Fi，扫码加入，无需安装应用、注册账号或使用 VPN。\r\n6. 上山路线使用 3D 沙盘：在“修路”中点按山体铺路，“调整”可拖动节点，“观察”可单指旋转、双指缩放。\r\n7. 上课期间不要关闭黑色启动窗口；下课后关闭窗口即可停止服务。\r\n8. 课堂数据保存在 data\\local-classrooms.json，重启后仍可恢复。\r\n\r\n如果平板打不开：\r\n- 确认教师电脑和平板连接的是同一个 Wi-Fi；\r\n- 确认 Wi-Fi 未开启“客户端隔离/AP 隔离”；\r\n- 在 Windows 防火墙中允许 node.exe 通过专用网络。\r\n`,
  'utf8',
);

if (savedData) {
  await mkdir(path.dirname(savedDataPath), { recursive: true });
  await writeFile(savedDataPath, savedData);
}

console.log(`LAN classroom package prepared in ${release}`);
