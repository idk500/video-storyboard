// extract_storyboard.mjs — 视频 + (可选)字幕 -> 分镜帧 + storyboard.json
//
// 两种模式:
//   A. 有同名 .srt 字幕:解析 -> 合并重叠话语(CN/EN双语) -> 按间隔切镜头 -> 每镜头抽1帧
//   B. 无字幕:均匀间隔抽帧(默认每 N 秒一帧)
//
// 用法:
//   node extract_storyboard.mjs <视频路径> [选项]
//   选项:
//     --srt <路径>       字幕文件(默认: 视频同名.srt)
//     --out <目录>       输出目录(默认: 视频同目录/storyboard)
//     --gap <秒>         镜头切分阈值(有字幕时,默认 2.0)
//     --interval <秒>    均匀抽帧间隔(无字幕时,默认 15)
//     --quality <2-31>   JPEG 质量(默认 2,数字越小质量越高)
//     --no-frames        只生成 storyboard.json 不抽帧
import fs from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';

// ---- 解析参数 ----
function parseArgs(argv) {
  const args = { video: null, srt: null, out: null, gap: 2.0, interval: 15, quality: 2, noFrames: false };
  const positional = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--srt') args.srt = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--gap') args.gap = parseFloat(argv[++i]);
    else if (a === '--interval') args.interval = parseFloat(argv[++i]);
    else if (a === '--quality') args.quality = parseInt(argv[++i], 10);
    else if (a === '--no-frames') args.noFrames = true;
    else if (a === '-h' || a === '--help') { args.help = true; }
    else positional.push(a);
  }
  args.video = positional[0];
  return args;
}
const args = parseArgs(process.argv);
if (args.help || !args.video) {
  console.log(`用法: node extract_storyboard.mjs <视频路径> [选项]
  --srt <路径>      字幕文件(默认找视频同名.srt)
  --out <目录>      输出目录(默认 <视频目录>/storyboard)
  --gap <秒>        镜头切分阈值(有字幕,默认2.0)
  --interval <秒>   均匀抽帧间隔(无字幕,默认15)
  --quality <2-31>  JPEG质量(默认2,越小越好)
  --no-frames       只生成storyboard.json不抽帧`);
  process.exit(args.help ? 0 : 1);
}
if (!fs.existsSync(args.video)) { console.error('视频文件不存在:', args.video); process.exit(1); }

// ---- 时间工具 ----
function toSec(ts) { const [h, m, s] = ts.split(':'); const [sec, ms] = s.split(','); return (+h) * 3600 + (+m) * 60 + (+sec) + (+ms) / 1000; }
function toTC(sec) { const h = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = Math.floor(sec % 60), cs = Math.round((sec % 1) * 100); return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cs).padStart(2, '0')}`; }
function durFmt(sec) { const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return `${m}分${s}秒`; }

// ---- 探测视频信息 ----
function probeVideo(video) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=width,height,avg_frame_rate', '-of', 'json', video], { encoding: 'utf8' });
  const j = JSON.parse(out);
  const v = j.streams.find(s => s.width) || j.streams[0];
  return { duration: +j.format.duration, width: v?.width, height: v?.height, fps: v?.avg_frame_rate };
}
console.log(`探测视频: ${args.video}`);
const info = probeVideo(args.video);
console.log(`  时长 ${durFmt(info.duration)}, ${info.width}x${info.height}`);

// ---- 输出目录 ----
const videoDir = path.dirname(args.video);
const videoBase = path.basename(args.video, path.extname(args.video));
const outDir = args.out || path.join(videoDir, 'storyboard');
const framesDir = path.join(outDir, 'frames');
fs.mkdirSync(framesDir, { recursive: true });

// ---- 查找字幕 ----
let srtPath = args.srt;
if (!srtPath) {
  const candidate = path.join(videoDir, videoBase + '.srt');
  if (fs.existsSync(candidate)) srtPath = candidate;
}

let storyboard = [];
let mode = '';

if (srtPath) {
  if (!fs.existsSync(srtPath)) {
    console.error(`[!] 指定的字幕文件不存在: ${srtPath}`);
    console.error(`    将回退到均匀抽帧模式 (间隔 ${args.interval}s)。`);
    srtPath = null;
  }
}

if (srtPath) {
  // ===== 模式 A: 字幕驱动 =====
  mode = `字幕驱动(srt, 镜头切分阈值 ${args.gap}s)`;
  console.log(`\n模式 A: ${mode}`);
  console.log(`字幕: ${srtPath}`);
  const raw = fs.readFileSync(srtPath, 'utf8').replace(/\r/g, '');
  const subs = raw.split('\n\n').filter(b => b.trim()).map(b => {
    const lines = b.split('\n'); const m = lines[1] && lines[1].match(/(\d\d:\d\d:\d\d,\d+)\s-->\s(\d\d:\d\d:\d\d,\d+)/);
    if (!m) return null;
    return { start: toSec(m[1]), end: toSec(m[2]), text: lines.slice(2).join(' ').trim() };
  }).filter(Boolean).filter(s => s.text).sort((a, b) => a.start - b.start);
  console.log(`  解析字幕: ${subs.length} 条`);

  // 合并重叠/紧邻的话语(CN/EN双语)
  const MERGE_GAP = 0.3;
  const utterances = [];
  let cur = { ...subs[0] };
  for (let i = 1; i < subs.length; i++) {
    const s = subs[i];
    if (s.start <= cur.end + MERGE_GAP) { cur.end = Math.max(cur.end, s.end); cur.text += ' / ' + s.text; }
    else { utterances.push(cur); cur = { ...s }; }
  }
  utterances.push(cur);
  console.log(`  合并话语: ${utterances.length} 条`);

  // 切镜头
  const shots = [];
  let curShot = [utterances[0]];
  for (let i = 1; i < utterances.length; i++) {
    if (utterances[i].start - utterances[i - 1].end >= args.gap) { shots.push(curShot); curShot = []; }
    curShot.push(utterances[i]);
  }
  shots.push(curShot);
  console.log(`  切分镜头: ${shots.length} 个`);

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const first = shot[0], last = shot[shot.length - 1];
    const t = (first.start + first.end) / 2;
    const allText = shot.map(u => u.text).join(' / ');
    const parts = allText.split(' / ').map(s => s.trim()).filter(Boolean);
    const cn = parts.filter(p => /[\u4e00-\u9fff]/.test(p));
    const en = parts.filter(p => !/[\u4e00-\u9fff]/.test(p));
    storyboard.push({
      shot: i + 1, timecode: toTC(t), seconds: +t.toFixed(2),
      start_tc: toTC(first.start), end_tc: toTC(last.end),
      utterance_count: shot.length,
      subtitle_cn: cn.join(' '), subtitle_en: en.join(' '),
      frame: `shot_${String(i + 1).padStart(3, '0')}_${toTC(t).replace(/[:.]/g, '-')}.jpg`,
    });
  }
} else {
  // ===== 模式 B: 均匀抽帧 =====
  mode = `均匀抽帧(每 ${args.interval}s 一帧)`;
  console.log(`\n模式 B: ${mode}`);
  console.log(`  (未找到字幕,如需按台词切分请用 --srt 或先生成字幕)`);
  const count = Math.max(1, Math.floor(info.duration / args.interval));
  console.log(`  将抽取 ${count} 帧`);
  for (let i = 0; i < count; i++) {
    const t = Math.min(info.duration - 0.1, i * args.interval + args.interval / 2);
    storyboard.push({
      shot: i + 1, timecode: toTC(t), seconds: +t.toFixed(2),
      start_tc: toTC(t), end_tc: toTC(Math.min(info.duration, t + args.interval)),
      utterance_count: 0, subtitle_cn: '', subtitle_en: '',
      frame: `shot_${String(i + 1).padStart(3, '0')}_${toTC(t).replace(/[:.]/g, '-')}.jpg`,
    });
  }
}

// ---- 写 storyboard.json ----
fs.writeFileSync(path.join(outDir, 'storyboard.json'), JSON.stringify(storyboard, null, 2));
console.log(`\n已生成 storyboard.json (${storyboard.length} 镜头, 模式: ${mode})`);

// ---- 抽帧 ----
if (!args.noFrames) {
  console.log(`\n开始抽帧...`);
  let ok = 0, fail = 0;
  for (let i = 0; i < storyboard.length; i++) {
    const s = storyboard[i];
    const fpath = path.join(framesDir, s.frame);
    // 钳制抽帧时间点:留1秒余量(末尾话语中点 + ffmpeg seek 解码余量)
    const t = Math.min(s.seconds, Math.max(0, info.duration - 1));
    try {
      execFileSync('ffmpeg', ['-y', '-ss', t.toFixed(3), '-i', args.video, '-frames:v', '1', '-q:v', String(args.quality), fpath],
        { stdio: ['ignore', 'ignore', 'ignore'] });
      if (fs.existsSync(fpath)) ok++; else throw new Error('未生成');
    } catch (e) { fail++; console.error(`  shot#${s.shot} 抽帧失败: ${e.message}`); }
    if ((i + 1) % 25 === 0) console.log(`  进度 ${i + 1}/${storyboard.length}`);
  }
  console.log(`抽帧完成: 成功 ${ok}, 失败 ${fail}`);
}
console.log(`\n输出目录: ${outDir}`);
console.log(`下一步: node analyze_frames.mjs "${path.join(outDir, 'storyboard.json')}" "${framesDir}"`);
