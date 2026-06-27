// ocr_frames_openai.mjs — 可选的 OCR 辅助步骤（OpenAI-compatible）
//
// 作用：读取 frames 目录中的图片，调用任意 OpenAI-compatible OCR / VLM 模型提取画面文字，
// 输出为 `ocr_text.jsonl`，供 build_report.mjs 合并进最终分镜表。
//
// 环境变量：
//   OCR_API_KEY   必填
//   OCR_BASE_URL  必填，例如 https://your-openai-compatible-endpoint/v1
//   OCR_MODEL     必填，例如 deepseek-ai/DeepSeek-OCR
//   OCR_PROMPT    可选，覆盖默认 OCR 提示词
//
// 用法：
//   node ocr_frames_openai.mjs <frames目录> [输出jsonl路径]
import fs from 'fs';
import path from 'path';

export function framePathToShot(framePath) {
  const m = String(framePath).match(/shot_(\d+)_/);
  return m ? parseInt(m[1], 10) : null;
}

export function toDataUrl(base64, mime = 'image/jpeg') {
  return `data:${mime};base64,${base64}`;
}

function mimeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

async function main() {
  const framesDir = process.argv[2];
  const outPath = process.argv[3] || path.join(path.dirname(framesDir), 'ocr_text.jsonl');
  if (!framesDir) {
    console.error('用法: node ocr_frames_openai.mjs <frames目录> [输出jsonl路径]');
    process.exit(1);
  }

  const OCR_API_KEY = process.env.OCR_API_KEY;
  const OCR_BASE_URL = process.env.OCR_BASE_URL;
  const OCR_MODEL = process.env.OCR_MODEL;
  const OCR_PROMPT = process.env.OCR_PROMPT || '请识别这张图片中的所有可见文字；如果没有文字，请回答“无文字”。';

  if (!OCR_API_KEY || !OCR_BASE_URL || !OCR_MODEL) {
    console.error('[ocr] 缺少 OCR_API_KEY / OCR_BASE_URL / OCR_MODEL 环境变量');
    process.exit(1);
  }

  const files = fs.readdirSync(framesDir)
    .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
    .sort();

  const log = fs.createWriteStream(outPath, { flags: 'w' });
  console.error(`[ocr] 待处理 ${files.length} 张图`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const full = path.join(framesDir, file);
    const shot = framePathToShot(file);
    const b64 = fs.readFileSync(full).toString('base64');
    const mime = mimeFromExt(full);
    try {
      const r = await fetch(OCR_BASE_URL.replace(/\/+$/, '') + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + OCR_API_KEY,
        },
        body: JSON.stringify({
          model: OCR_MODEL,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: OCR_PROMPT },
              { type: 'image_url', image_url: { url: toDataUrl(b64, mime) } },
            ],
          }],
          max_tokens: 300,
        }),
      });

      const txt = await r.text();
      let parsed = txt;
      try {
        const j = JSON.parse(txt);
        parsed = j.choices?.[0]?.message?.content ?? JSON.stringify(j.error || j);
      } catch {}

      const ok = r.ok;
      log.write(JSON.stringify({ shot, file, ok, text: parsed }) + '\n');
      console.error(`  [${i + 1}/${files.length}] shot#${shot} ${ok ? '✓' : '✗'}`);
    } catch (e) {
      log.write(JSON.stringify({ shot, file, ok: false, text: 'ERROR: ' + e.message }) + '\n');
      console.error(`  [${i + 1}/${files.length}] shot#${shot} ✗`);
    }
  }

  log.end();
  console.error(`[ocr] 输出: ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('ocr_frames_openai.mjs')) {
  main();
}
