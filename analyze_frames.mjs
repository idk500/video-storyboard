// analyze_frames.mjs — 用 video-vision-mcp 逐帧分析分镜图片。
//
// 设计要点(为长期稳定使用):
//   1. 复用单个 MCP server 进程(spawn 一次),串行发 tools/call,避免反复启动。
//   2. 断点续传:每帧分析完立即追加写入 .jsonl,中断后重跑自动跳过已完成帧。
//   3. 失败补跑:首轮 429/失败的帧记录下来,全部跑完后冷却再补跑(最多 N 轮)。
//   4. 进度实时输出(stderr),便于后台监控。
//
// 用法:
//   node analyze_frames.mjs <storyboard.json路径> <frames目录> [输出jsonl路径]
//
// 环境变量:
//   VISION_API_KEY   必填,视觉模型 API Key (默认智谱 Bigmodel)
//   VISION_PROMPT    可选,覆盖默认的画面描述提示词
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import readline from 'readline';

const require = createRequire(import.meta.url);

// ---- 配置 ----
// MCP 服务通过 npm 依赖安装,用 require.resolve 定位其 dist/index.js
let MCP_DIR;
try {
  MCP_DIR = path.dirname(require.resolve('@idk500/video-vision-mcp/dist/index.js'));
} catch (e) {
  console.error('[analyze] 未找到 @idk500/video-vision-mcp。请先运行: npm install');
  process.exit(1);
}

// API Key 必须由用户提供,代码里不存任何默认值
const API_KEY = process.env.VISION_API_KEY;
if (!API_KEY) {
  console.error('[analyze] 缺少环境变量 VISION_API_KEY。');
  console.error('         获取智谱 Bigmodel key: https://open.bigmodel.cn/usercenter/apikeys');
  process.exit(1);
}

// 通用画面描述提示词(不绑定特定题材)。可用 VISION_PROMPT 覆盖。
const PROMPT = process.env.VISION_PROMPT ||
  '这是一段视频的截图。请用中文简洁描述(共60字内):1.场景环境 2.人物(数量/外貌/表情/动作) 3.画面景别(特写/近景/中景/全景) 4.整体氛围。直接给描述,不要前缀。';
const MAX_RETRY_ROUNDS = 3;      // 失败补跑轮数
const COOLDOWN_MS = 15000;       // 补跑轮次之间的冷却
const INTER_CALL_MS = 800;       // 两次调用间的间隔(降低 429)

// ---- 参数 ----
const storyboardPath = process.argv[2];
const framesDir = process.argv[3];
const outPath = process.argv[4] || storyboardPath.replace(/\.json$/, '_ai.jsonl');
if (!storyboardPath || !framesDir) {
  console.error('用法: node analyze_frames.mjs <storyboard.json> <frames目录> [输出jsonl]');
  process.exit(1);
}

const sb = JSON.parse(fs.readFileSync(storyboardPath, 'utf8'));

// ---- 断点续传:读取已完成的帧 ----
const done = new Map(); // shot -> description
if (fs.existsSync(outPath)) {
  for (const line of fs.readFileSync(outPath, 'utf8').split('\n').filter(Boolean)) {
    try {
      const r = JSON.parse(line);
      if (r.ok && r.desc) done.set(r.shot, r.desc);
    } catch (e) { /* skip */ }
  }
}
const pending = sb.filter(s => !done.has(s.shot));
console.error(`[analyze] 共 ${sb.length} 帧,已完成 ${done.size},待分析 ${pending.length}`);

if (pending.length === 0) {
  console.error('[analyze] 全部已完成,无需重跑');
  process.exit(0);
}

// ---- 启动 MCP server ----
const env = { ...process.env, VISION_API_KEY: API_KEY };
const proc = spawn('node', ['dist/index.js'], { cwd: MCP_DIR, env });
const rl = readline.createInterface({ input: proc.stdout });

// 简单的 JSON-RPC over stdio 客户端
let nextId = 1;
const waiting = new Map(); // id -> {resolve, reject}
rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);
    if (msg.id != null && waiting.has(msg.id)) {
      waiting.get(msg.id).resolve(msg);
      waiting.delete(msg.id);
    }
  } catch (e) { /* non-JSON line, ignore */ }
});
let procErr = '';
proc.stderr.on('data', d => { procErr += d; process.stderr.write(d); });

function send(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}
function notify(method, params) {
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}

async function callAnalyze(imagePath) {
  const resp = await send('tools/call', {
    name: 'analyze_image_batch',
    arguments: { imagePaths: [imagePath], prompt: PROMPT },
  });
  if (resp.error) throw new Error(JSON.stringify(resp.error));
  const text = resp.result.content.map(c => c.text).join('\n');
  // extract the description after "图片 1 (...):\n"
  const m = text.match(/📸 图片 \d+[^\n]*:\n((?:.|\n)*?)(?=\n📸 |\n*$)/);
  let desc = m ? m[1].trim() : text;
  const ok = !desc.startsWith('❌');
  return { desc, ok };
}

// ---- 主循环(带补跑) ----
async function runBatch(frames) {
  const log = fs.createWriteStream(outPath, { flags: 'a' });
  let ok = 0, fail = 0;
  const failed = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const imgPath = path.join(framesDir, f.frame).split(path.sep).join('/');
    try {
      const { desc, ok: isOk } = await callAnalyze(imgPath);
      log.write(JSON.stringify({ shot: f.shot, timecode: f.timecode, desc, ok: isOk }) + '\n');
      if (isOk) { ok++; done.set(f.shot, desc); }
      else { fail++; failed.push(f); }
    } catch (e) {
      fail++; failed.push(f);
      log.write(JSON.stringify({ shot: f.shot, timecode: f.timecode, desc: 'ERROR: ' + e.message, ok: false }) + '\n');
    }
    process.stderr.write(`  [${i + 1}/${frames.length}] shot#${f.shot} ${f.timecode} ${fail > 0 || ok > 0 ? (done.has(f.shot) ? '✓' : '✗') : ''}\n`);
    if (i < frames.length - 1) await new Promise(r => setTimeout(r, INTER_CALL_MS));
  }
  log.end();
  await new Promise(r => log.on('close', r));
  return { ok, fail, failed };
}

// ---- 入口 ----
try {
  // initialize
  await send('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'analyze-tool', version: '1.0' } });
  notify('notifications/initialized');

  let toRun = pending;
  for (let round = 1; round <= MAX_RETRY_ROUNDS; round++) {
    console.error(`\n[analyze] === 第 ${round} 轮 (${toRun.length} 帧) ===`);
    const t0 = Date.now();
    const { ok, fail, failed } = await runBatch(toRun);
    const dt = ((Date.now() - t0) / 1000).toFixed(0);
    console.error(`[analyze] 第 ${round} 轮完成: 成功 ${ok}, 失败 ${fail}, 耗时 ${dt}s`);
    if (failed.length === 0) break;
    if (round < MAX_RETRY_ROUNDS) {
      console.error(`[analyze] ${failed.length} 帧失败,冷却 ${COOLDOWN_MS / 1000}s 后补跑...`);
      await new Promise(r => setTimeout(r, COOLDOWN_MS));
      toRun = failed;
    } else {
      console.error(`[analyze] 仍有 ${failed.length} 帧失败(已达最大补跑轮数),放弃: ${failed.map(f => '#' + f.shot).join(',')}`);
    }
  }

  console.error(`\n[analyze] 全部完成。总计成功 ${done.size}/${sb.length}。`);
  console.error(`[analyze] 输出: ${outPath}`);
  proc.stdin.end();
  proc.kill();
} catch (e) {
  console.error('[analyze] 致命错误:', e.message);
  console.error(procErr.slice(-500));
  proc.kill();
  process.exit(1);
}
