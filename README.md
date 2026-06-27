# video-storyboard

把一段视频自动转换成**带 AI 画面解读的分镜表**。

**视频 / 字幕 → 抽帧 → AI 看图解读 → 输出 markdown 分镜文档**

适合：
- 短剧拆解
- 分镜整理
- 剧情梳理
- 视频归档
- 二创/复盘参考

默认视觉后端使用 **智谱 Bigmodel `glm-4.6v-flash`**，通过 MCP 包 **[`@idk500/video-vision-mcp`](https://www.npmjs.com/package/@idk500/video-vision-mcp)** 提供能力。

---

## 为什么用它？

相比“手动截图 + 手动记台词 + 手动写分镜”，这个工具可以自动完成：

- **自动切镜头**：有字幕时按字幕节奏切镜头
- **自动抽帧**：每镜头一张图，文件名带时间码
- **自动 AI 解读**：逐帧输出场景 / 人物 / 动作 / 景别 / 氛围
- **自动生成报告**：输出 `storyboard_final.md`
- **支持断点续传**：长视频中断后可继续跑
- **支持限流补跑**：429 自动重试

---

## 快速开始

### 1. 安装依赖

要求：
- **Node.js >= 18**
- **FFmpeg / ffprobe**

安装：

```bash
npm install
```

### 2. 配置 API Key

本工具**不内置任何 key**，必须自己设置环境变量。

### 主视觉模型（分镜画面解读）

必填：
- `VISION_API_KEY`

### 可选 OCR 模型（画面文字提取）

如果你想额外提取帧中的文字（例如烧录字幕、招牌、屏幕文字），可选设置：
- `OCR_API_KEY`
- `OCR_BASE_URL`
- `OCR_MODEL`
- `ENABLE_OCR=1`

OCR 采用**通用 OpenAI-compatible 接口**，不绑定任何具体供应商。

#### Windows PowerShell

```powershell
$env:VISION_API_KEY="你的key"
```

#### Windows CMD

```cmd
set VISION_API_KEY=你的key
```

#### macOS / Linux

```bash
export VISION_API_KEY="你的key"
```

智谱官方 Key 获取地址：

<https://open.bigmodel.cn/usercenter/apikeys>

### 3. 运行

#### Windows

双击：

```text
生成分镜.bat
```

或者把视频文件直接拖到 `.bat` 上。

#### macOS / Linux

```bash
chmod +x run.sh
./run.sh /path/to/video.mp4
```

---

## 输出结果

工具会在视频同目录生成：

```text
storyboard/
├── frames/                 # 每镜头一张图
├── storyboard.json         # 结构化镜头数据
├── ai_descriptions.jsonl   # AI 逐帧解读
├── ocr_text.jsonl          # 可选 OCR 文字提取
└── storyboard_final.md     # 最终分镜报告
```

`storyboard_final.md` 包含：
- 总览表格
- 每镜头时间码
- 中英台词
- AI 画面解读
- 帧图路径
- 逐镜头详尽区

---

## 抽帧模式

### 模式 A：有同名 `.srt`

如果视频同目录存在同名字幕文件：

```text
video.mp4
video.srt
```

工具会自动：
1. 解析字幕
2. 合并中英双语重叠话语
3. 按话语间隔切分镜头
4. 每镜头抽 1 帧

这是最接近“按镜头做分镜”的模式。

### 模式 B：无字幕

如果没有字幕文件：
- 自动回退到**均匀抽帧**
- 默认每 **15 秒** 1 帧

如果你想按台词切镜头，请先准备 `.srt`。

---

## 命令行拆步使用

### 1. 抽帧 + 生成 `storyboard.json`

```bash
node extract_storyboard.mjs "视频.mp4"
```

可选参数：

| 参数 | 默认 | 说明 |
|---|---|---|
| `--srt <路径>` | 视频同名 `.srt` | 指定字幕文件 |
| `--out <目录>` | 视频目录 `/storyboard` | 输出目录 |
| `--gap <秒>` | `2.0` | 字幕模式下的镜头切分阈值 |
| `--interval <秒>` | `15` | 无字幕时的均匀抽帧间隔 |
| `--quality <2-31>` | `2` | JPEG 质量，越小越高 |
| `--no-frames` | - | 只生成 `storyboard.json`，不抽帧 |

示例：

```bash
node extract_storyboard.mjs "video.mp4" --gap 2.0 --interval 15 --quality 2
```

### 2. AI 逐帧解读

```bash
node analyze_frames.mjs "storyboard/storyboard.json" "storyboard/frames"
```

特点：
- 断点续传
- 自动补跑失败帧
- 使用 npm 安装的 `@idk500/video-vision-mcp`
- 强制依赖 `VISION_API_KEY`

你也可以自定义提示词：

```bash
export VISION_PROMPT="请重点描述人物关系和动作"
node analyze_frames.mjs "storyboard/storyboard.json" "storyboard/frames"
```

### 3. 可选 OCR（画面文字提取）

```bash
export ENABLE_OCR=1
export OCR_API_KEY="你的ocr-key"
export OCR_BASE_URL="https://your-openai-compatible-endpoint/v1"
export OCR_MODEL="your-ocr-model"

node ocr_frames_openai.mjs "storyboard/frames" "storyboard/ocr_text.jsonl"
```

说明：
- 这是**可选步骤**，不会替代主视觉模型
- 适合提取烧录字幕、UI、招牌、屏幕文字等
- 结果会被并入最终报告

### 4. 生成最终报告

```bash
node build_report.mjs "storyboard/storyboard.json" "storyboard/ai_descriptions.jsonl" "storyboard/storyboard_final.md" "storyboard/ocr_text.jsonl"
```

输出：

```text
storyboard_final.md
```

---

## 平台支持

- Windows：`生成分镜.bat`
- macOS / Linux：`run.sh`

---

## 关于 ASR（自动生成字幕）

本工具当前**未内置 ASR**。

如果视频没有字幕，但你希望按台词切镜头，可以先用 ASR 生成 `.srt`：

- OpenAI Whisper API
- 本地 whisper
- faster-whisper

生成后把 `.srt` 放到视频同目录，并保证同名即可。

---

## FAQ

### 没有字幕可以用吗？
可以。工具会自动回退到均匀抽帧模式。
如果你想按对白切镜头，建议先准备 `.srt`。

### 为什么 AI 解读会慢？
默认模型 `glm-4.6v-flash` 是免费模型，可能触发限流（429）。
工具会自动重试，并支持断点续传。

### 能分析多长的视频？
可以。长视频只会更慢，但不会因为中断而丢失已完成结果。

### 为什么不内置 API Key？
为了安全。公开仓库不存任何 key，必须通过环境变量提供。

---

## 已知特性

- `analyze_frames.mjs` 每帧完成立即写入 `.jsonl`
- 中断后重跑自动跳过已完成帧
- 免费模型可能触发 429，脚本会自动冷却和补跑
- 长视频（如 189 帧）可能需要 30–60 分钟

---

## 文件结构

```text
video-storyboard/
├── package.json
├── package-lock.json
├── .gitignore
├── LICENSE
├── README.md
├── 生成分镜.bat
├── run.sh
├── extract_storyboard.mjs
├── analyze_frames.mjs
├── ocr_frames_openai.mjs
└── build_report.mjs
```

---

## 许可证

MIT

---

## 相关项目

- MCP 服务：[`@idk500/video-vision-mcp`](https://www.npmjs.com/package/@idk500/video-vision-mcp)
- 上游来源：`pickstar-2002/video-capture-script-mcp`
