import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

function write(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

test('build_report merges optional OCR results into final markdown', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-ocr-report-'));
  const sbPath = path.join(dir, 'storyboard.json');
  const aiPath = path.join(dir, 'ai_descriptions.jsonl');
  const ocrPath = path.join(dir, 'ocr_text.jsonl');
  const outPath = path.join(dir, 'storyboard_final.md');

  write(sbPath, JSON.stringify([
    {
      shot: 1,
      timecode: '00:00:01.00',
      start_tc: '00:00:00.00',
      end_tc: '00:00:02.00',
      utterance_count: 1,
      subtitle_cn: '你好',
      subtitle_en: 'hello',
      frame: 'shot_001.jpg'
    }
  ], null, 2));

  write(aiPath, JSON.stringify({ shot: 1, ok: true, desc: '室内，一人近景，表情平静。' }) + '\n');
  write(ocrPath, JSON.stringify({ shot: 1, ok: true, text: '屏幕文字：HELLO' }) + '\n');

  execFileSync('node', ['build_report.mjs', sbPath, aiPath, outPath], {
    cwd: 'E:/AI/short-video/video-storyboard',
    stdio: 'ignore'
  });

  const md = fs.readFileSync(outPath, 'utf8');
  assert.match(md, /OCR/i);
  assert.match(md, /屏幕文字：HELLO/);
});
