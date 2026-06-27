import test from 'node:test';
import assert from 'node:assert/strict';

// 先按我们希望的 API 写测试，后面再实现
import { framePathToShot, toDataUrl } from '../ocr_frames_openai.mjs';

test('framePathToShot extracts shot number from frame filename', () => {
  assert.equal(framePathToShot('E:/x/frames/shot_001_00-00-06-83.jpg'), 1);
  assert.equal(framePathToShot('shot_189_00-44-50-00.jpg'), 189);
});

test('toDataUrl wraps base64 with mime prefix', () => {
  assert.equal(toDataUrl('abc123', 'image/jpeg'), 'data:image/jpeg;base64,abc123');
});
