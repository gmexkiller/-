import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

function privateAddressScore(name, address) {
  const virtualAdapter = /virtual|vmware|vbox|vethernet|wsl|loopback/i.test(name);
  let score = virtualAdapter ? -20 : 0;
  if (address.startsWith('192.168.')) score += 30;
  else if (address.startsWith('10.')) score += 20;
  else {
    const match = /^172\.(\d+)\./.exec(address);
    if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) score += 10;
  }
  return score;
}

function findLanAddress() {
  const candidates = [];
  for (const [name, entries] of Object.entries(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      candidates.push({ address: entry.address, score: privateAddressScore(name, entry.address) });
    }
  }
  candidates.sort((left, right) => right.score - left.score);
  return candidates[0]?.address || '127.0.0.1';
}

function portAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => tester.close(() => resolve(true)));
    tester.listen(port, '0.0.0.0');
  });
}

async function findPort() {
  for (let port = 3000; port <= 3010; port += 1) {
    if (await portAvailable(port)) return port;
  }
  throw new Error('端口 3000–3010 都被占用，请关闭其他本地网站后重试。');
}

function waitUntilReady(port) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 30_000;
    const check = () => {
      const request = http.get(`http://127.0.0.1:${port}/`, (response) => {
        response.resume();
        resolve();
      });
      request.on('error', () => {
        if (Date.now() >= deadline) reject(new Error('课堂服务器启动超时'));
        else setTimeout(check, 300);
      });
    };
    check();
  });
}

function openBrowser(url) {
  const opener = spawn('cmd.exe', ['/c', 'start', '', url], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  opener.unref();
}

const port = await findPort();
const lanAddress = findLanAddress();
const classroomUrl = `http://${lanAddress}:${port}`;

console.log('');
console.log('============================================================');
console.log('  胡拉拉《斜面》局域网课堂已经准备启动');
console.log(`  教师端与学生平板访问：${classroomUrl}`);
console.log('  学生平板必须与教师电脑连接同一个 Wi-Fi。');
console.log('  若弹出 Windows 防火墙提示，请允许“专用网络”访问。');
console.log('  关闭本窗口即可停止课堂服务器。');
console.log('============================================================');
console.log('');

const child = spawn(process.execPath, ['server.js'], {
  cwd: root,
  env: {
    ...process.env,
    CLASSROOM_STORAGE: 'local',
    CLASSROOM_DATA_FILE: path.join(root, 'data', 'local-classrooms.json'),
    CLASSROOM_LAN_ORIGIN: classroomUrl,
    HOSTNAME: '0.0.0.0',
    PORT: String(port),
    NODE_ENV: 'production',
  },
  stdio: 'inherit',
});

const stop = () => {
  if (!child.killed) child.kill();
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

try {
  await waitUntilReady(port);
  openBrowser(classroomUrl);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  stop();
  process.exitCode = 1;
}

child.once('exit', (code) => {
  process.exitCode = code ?? 0;
});
