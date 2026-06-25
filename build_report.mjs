// build_report.mjs — 合并 storyboard.json + ai_descriptions.jsonl -> 最终分镜表 markdown
//
// 用法:
//   node build_report.mjs <storyboard.json> [ai_descriptions.jsonl] [输出.md]
import fs from 'fs';
import path from 'path';

const sbPath = process.argv[2];
const aiPath = process.argv[3] || sbPath.replace(/\.json$/, '_ai.jsonl');
const outMd = process.argv[4] || sbPath.replace(/storyboard\.json$/, 'storyboard_final.md');
if (!sbPath) { console.error('用法: node build_report.mjs <storyboard.json> [ai.jsonl] [输出.md]'); process.exit(1); }

const sb = JSON.parse(fs.readFileSync(sbPath, 'utf8'));
const ai = new Map();
if (fs.existsSync(aiPath)) {
  for (const line of fs.readFileSync(aiPath, 'utf8').split('\n').filter(Boolean)) {
    try { const r = JSON.parse(line); if (r.ok && r.desc) ai.set(r.shot, r.desc); } catch (e) { }
  }
}
const hasAi = ai.size > 0;
const aiCoverage = `${ai.size}/${sb.length}`;

// 智能截断:优先在标点处断开(中文分句),其次在空格处断开(英文词边界),
// 避免把"氛围紧张"切成"氛…"、"the"切成"t…"。找不到才硬切。
function truncSmart(text, maxLen) {
  if (text.length <= maxLen) return text;
  const slice = text.slice(0, maxLen);
  // 先找最后一个标点(中英断句)
  let m = slice.match(/.*[，。！？；、,.!?;:]/);
  if (!m) {
    // 没标点(常见于纯英文),找最后一个空格(词边界)
    m = slice.match(/.*\s/);
  }
  const cut = m ? m[0].length : maxLen;
  return text.slice(0, cut).replace(/[,，。！？；、.!?:\s]+$/, '') + '…';
}

// 视频名(从路径推断)
const videoName = sbPath.split(/[/\\]/).slice(-3, -2)[0] || '视频';

const L = [];
L.push(`# ${videoName} — 分镜表${hasAi ? '(含AI画面解读)' : ''}`);
L.push('');
L.push(`- **镜头数**: ${sb.length}`);
L.push(`- **AI 解读覆盖**: ${hasAi ? aiCoverage : '无'}`);
L.push(`- **帧目录**: \`frames/\``);
L.push('');

// 总览表
if (hasAi) {
  L.push(`| Shot | 时间码 | 区间 | AI画面解读 | 台词(中) | 台词(英) | 帧 |`);
  L.push(`|---:|---|---|---|---|---|---|`);
} else {
  L.push(`| Shot | 时间码 | 区间 | 台词(中) | 台词(英) | 帧 |`);
  L.push(`|---:|---|---|---|---|---|`);
}
for (const s of sb) {
  const cn = (s.subtitle_cn || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const en = (s.subtitle_en || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  // AI 描述本身就很短(≤75字),表格里基本不截断;字幕可能很长,按分句截断
  const cnS = truncSmart(cn, 50);
  const enS = truncSmart(en, 70);
  const desc = (ai.get(s.shot) || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const descS = truncSmart(desc, 80);
  if (hasAi) {
    L.push(`| ${s.shot} | ${s.timecode} | ${s.start_tc}–${s.end_tc} | ${descS || '(未解读)'} | ${cnS} | ${enS} | [${s.frame}](frames/${s.frame}) |`);
  } else {
    L.push(`| ${s.shot} | ${s.timecode} | ${s.start_tc}–${s.end_tc} | ${cnS} | ${enS} | [${s.frame}](frames/${s.frame}) |`);
  }
}

// 详细
L.push('');
L.push('---');
L.push('');
L.push('## 逐镜头详尽');
L.push('');
for (const s of sb) {
  L.push(`### Shot ${s.shot} — ${s.timecode}`);
  L.push(`- **区间**: ${s.start_tc} – ${s.end_tc}`);
  if (s.utterance_count) L.push(`- **话语数**: ${s.utterance_count}`);
  L.push(`- **帧**: \`frames/${s.frame}\``);
  if (hasAi) L.push(`- **AI 画面解读**: ${ai.get(s.shot) || '(未解读)'}`);
  if (s.subtitle_cn) L.push(`- **中文**: ${s.subtitle_cn}`);
  if (s.subtitle_en) L.push(`- **英文**: ${s.subtitle_en}`);
  L.push('');
}

fs.writeFileSync(outMd, L.join('\n'));
console.log(`已生成: ${outMd}`);
console.log(`镜头 ${sb.length}, AI 解读 ${aiCoverage}`);
