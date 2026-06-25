# video-storyboard

把一段视频自动转成**带 AI 画面解读的分镜表**：

**视频 / 字幕 → 抽帧 → AI 看图解读 → 输出 markdown 分镜文档**

默认视觉后端使用 **智谱 Bigmodel `glm-4.6v-flash`**，通过已发布的 MCP 包 **`@idk500/video-vision-mcp`** 提供能力。

---

## 功能

- 有字幕时：
  - 自动读取同名 `.srt`
  - 自动合并中英双语重叠字幕
  - 按镜头切分
  - 每镜头抽 1 帧
- 无字幕时：
  - 均匀抽帧（默认每 15 秒 1 帧）
- AI 逐帧画面解读：
  - 场景
  - 人物
  - 动作
  - 景别
  - 氛围
- 断点续传：
  - 中断后重跑不会丢进度
- 自动补跑：
  - 429 / 限流后会自动重试
- 生成最终分镜表：
  - 总览表格
  - 逐镜头详尽区
  - 帧图链接
  - 中英台词
  - AI 画面解读

---

## 安装

### 1. 安装 Node.js

要求：**Node.js >= 18**

下载：<https://nodejs.org/>

### 2. 安装 FFmpeg

#### Windows

```bash
choco install ffmpeg
```

或手动安装并加入 PATH。

#### macOS

```bash
brew install ffmpeg
```

#### Linux

```bash
sudo apt install ffmpeg
```

### 3. 安装依赖

在项目目录下执行：

```bash
npm install
```

这会安装：

- `@idk500/video-vision-mcp`

---

## 配置 API Key

本工具**不内置任何 key**。

你必须自己设置环境变量：

### Windows PowerShell

```powershell
$env:VISION_API_KEY="你的key"
```

### Windows CMD

```cmd
set VISION_API_KEY=你的key
```

### macOS / Linux

```bash
export VISION_API_KEY="你的key"
```

### 获取官方智谱 Key

<https://open.bigmodel.cn/usercenter/apikeys>

---

## 一键使用

### Windows

双击：

```text
生成分镜.bat
```

或者把视频文件直接拖到 `.bat` 上。

### macOS / Linux

```bash
chmod +x run.sh
./run.sh /path/to/video.mp4
```

---

## 输出

输出到：

```text
<视频目录>/storyboard/
```

包含：

| 文件 | 说明 |
|---|---|
| `frames/` | 每镜头一张 JPG |
| `storyboard.json` | 结构化分镜数据 |
| `ai_descriptions.jsonl` | AI 解读原始结果 |
| `storyboard_final.md` | 最终分镜表 |

---

## 抽帧模式

### 模式 A：有同名 `.srt`

默认优先读取视频同目录下的同名字幕文件：

```text
video.mp4
video.srt
```

处理流程：

1. 解析字幕
2. 合并中英双语重叠话语
3. 按话语间隔切分镜头
4. 每镜头抽 1 帧

这最接近“按镜头做分镜”。

### 模式 B：无字幕

如果没有字幕文件：

- 自动回退到**均匀抽帧**
- 默认每 **15 秒** 1 帧

如果你想按台词切分，请先准备 `.srt`。

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

### 3. 生成最终报告

```bash
node build_report.mjs "storyboard/storyboard.json" "storyboard/ai_descriptions.jsonl"
```

输出：

```text
storyboard_final.md
```

---

## 关于 ASR（自动生成字幕）

本工具当前**未内置 ASR**。

如果视频没有字幕，但你希望按台词切镜头，可以先用 ASR 生成 `.srt`：

- OpenAI Whisper API
- 本地 whisper
- faster-whisper

生成后把 `.srt` 放到视频同目录，并保证同名即可。

---

## 已知特性

- `analyze_frames.mjs` 每帧完成立即写入 `.jsonl`
- 中断后重跑自动跳过已完成帧
- 免费模型可能触发 429，脚本会自动冷却和补跑
- 大视频（如 189 帧）可能需要 30–60 分钟

---

## 文件结构

```text
video-storyboard/
├── package.json
├── .gitignore
├── LICENSE
├── README.md
├── 生成分镜.bat
├── run.sh
├── extract_storyboard.mjs
├── analyze_frames.mjs
└── build_report.mjs
```

---

## 许可证

MIT

---

## 相关项目

- MCP 服务：`@idk500/video-vision-mcp`
- 上游来源：`pickstar-2002/video-capture-script-mcp`
