#!/usr/bin/env bash
# 视频分镜生成工具 - macOS/Linux 一键启动器
# 用法: ./run.sh [视频路径]  (无参数则交互输入)
set -e

TOOL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$TOOL_DIR"

echo "============================================"
echo "  视频分镜生成工具 (字幕驱动 + AI画面解读)"
echo "============================================"
echo

# ---- 依赖检查 ----
echo "[1/4] 检查依赖..."
command -v node >/dev/null 2>&1 || { echo "  [X] 未找到 node。请先安装 Node.js 18+: https://nodejs.org/"; exit 1; }
echo "  [OK] node $(node --version)"
command -v ffmpeg >/dev/null 2>&1 || { echo "  [X] 未找到 ffmpeg。macOS: brew install ffmpeg  Linux: sudo apt install ffmpeg"; exit 1; }
echo "  [OK] ffmpeg 已安装"
command -v ffprobe >/dev/null 2>&1 || { echo "  [X] 未找到 ffprobe (通常随 ffmpeg 一起)。"; exit 1; }
echo "  [OK] ffprobe 已安装"

# MCP 依赖检查
node -e "require.resolve('@idk500/video-vision-mcp/dist/index.js')" >/dev/null 2>&1 || {
  echo "  [X] 未找到 @idk500/video-vision-mcp 依赖。请先运行: npm install"
  exit 1
}
echo "  [OK] @idk500/video-vision-mcp 依赖就绪"

# API Key 检查
if [ -z "$VISION_API_KEY" ]; then
  echo "  [!] 警告: 未设置环境变量 VISION_API_KEY"
  echo "      AI 解读将无法运行。获取: https://open.bigmodel.cn/usercenter/apikeys"
  echo "      export VISION_API_KEY=你的key"
fi
echo

# ---- 获取视频路径 ----
VIDEO="$1"
if [ -z "$VIDEO" ]; then
  read -p "请输入视频文件路径: " VIDEO
fi
if [ -z "$VIDEO" ]; then echo "未提供视频路径,退出。"; exit 1; fi
if [ ! -f "$VIDEO" ]; then echo "[X] 文件不存在: $VIDEO"; exit 1; fi
echo "目标视频: $VIDEO"
echo

# ---- 配置 ----
GAP=2.0
INTERVAL=15
echo "[配置] 镜头切分阈值: ${GAP}s (有字幕时) / 均匀间隔: ${INTERVAL}s (无字幕时)"
echo

# ---- 推断输出目录 ----
VID_DIR="$(cd "$(dirname "$VIDEO")" && pwd)"
OUT_DIR="$VID_DIR/storyboard"

# ---- 步骤1: 抽帧 ----
echo "[2/4] 抽帧 + 生成分镜结构..."
node extract_storyboard.mjs "$VIDEO" --gap $GAP --interval $INTERVAL
echo

# ---- 步骤2: AI 解读 ----
echo "[3/4] AI 画面解读 (可能耗时较长,免费模型有限流,支持断点续传)..."
echo "      (若中断,重新运行会自动跳过已完成帧继续)"
echo
node analyze_frames.mjs "$OUT_DIR/storyboard.json" "$OUT_DIR/frames" "$OUT_DIR/ai_descriptions.jsonl" || \
  echo "[!] AI 解读环节出现问题 (可能部分帧未完成)。基于已完成结果生成报告。"
echo

# ---- 步骤3: 报告 ----
echo "[4/4] 生成分镜报告..."
node build_report.mjs "$OUT_DIR/storyboard.json" "$OUT_DIR/ai_descriptions.jsonl" "$OUT_DIR/storyboard_final.md"
echo

echo "============================================"
echo "  完成!"
echo "============================================"
echo "输出目录: $OUT_DIR"
echo "  - frames/              (分镜帧图片)"
echo "  - storyboard.json      (结构化数据)"
echo "  - ai_descriptions.jsonl (AI解读原始结果)"
echo "  - storyboard_final.md  (最终分镜表,含AI解读)"
