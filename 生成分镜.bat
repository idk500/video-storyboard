@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ============================================================
REM  视频分镜生成工具 - 一键启动器
REM  用法:
REM    1. 双击运行,按提示输入视频路径
REM    2. 或把视频文件/文件夹拖到本 .bat 上
REM ============================================================

set "TOOL_DIR=%~dp0"
set "TOOL_DIR=%TOOL_DIR:~0,-1%"
cd /d "%TOOL_DIR%"

echo ============================================
echo   视频分镜生成工具 (字幕驱动 + AI画面解读)
echo ============================================
echo.

REM ---- 依赖检查 ----
echo [1/4] 检查依赖...
where node >nul 2>nul
if errorlevel 1 (
  echo   [X] 未找到 node。请先安装 Node.js 18+: https://nodejs.org/
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo   [OK] node %%v

where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo   [X] 未找到 ffmpeg。请安装 FFmpeg 并加入 PATH。
  echo       Windows: choco install ffmpeg  或  https://www.gyan.dev/ffmpeg/builds/
  pause
  exit /b 1
)
echo   [OK] ffmpeg 已安装

where ffprobe >nul 2>nul
if errorlevel 1 (
  echo   [X] 未找到 ffprobe (通常随 ffmpeg 一起)。
  pause
  exit /b 1
)
echo   [OK] ffprobe 已安装

REM ---- MCP server 依赖检查 ----
node -e "require.resolve('@idk500/video-vision-mcp/dist/index.js')" >nul 2>nul
if errorlevel 1 (
  echo   [X] 未找到 @idk500/video-vision-mcp 依赖。
  echo       请先运行: npm install
  echo       ^(在工具目录 %TOOL_DIR% 下执行^)
  pause
  exit /b 1
)
echo   [OK] @idk500/video-vision-mcp 依赖就绪

REM ---- API Key 检查 ----
if "%VISION_API_KEY%"=="" (
  echo   [!] 警告: 未设置环境变量 VISION_API_KEY
  echo       AI 解读将无法运行。请先设置 ^(获取: https://open.bigmodel.cn/usercenter/apikeys^)
  echo       set VISION_API_KEY=你的key
  echo.)
echo.

REM ---- 获取视频路径 ----
set "VIDEO=%~1"

if "%VIDEO%"=="" (
  echo 请输入视频文件完整路径 ^(可直接拖入文件^):
  set /p "VIDEO="
)

if "%VIDEO%"=="" (
  echo 未提供视频路径,退出。
  pause
  exit /b 1
)

REM 去除可能的引号
set "VIDEO=%VIDEO:"=%"

if not exist "%VIDEO%" (
  echo [X] 文件不存在: %VIDEO%
  pause
  exit /b 1
)

echo 目标视频: %VIDEO%
echo.

REM ---- 配置(可改) ----
set "GAP=2.0"
set "INTERVAL=15"
echo [配置] 镜头切分阈值: %GAP%s ^(有字幕时^) / 均匀间隔: %INTERVAL%s ^(无字幕时^)
echo.

REM ---- 步骤1: 抽帧 ----
echo [2/4] 抽帧 + 生成分镜结构...
node extract_storyboard.mjs "%VIDEO%" --gap %GAP% --interval %INTERVAL%
if errorlevel 1 (
  echo [X] 抽帧失败。
  pause
  exit /b 1
)
echo.

REM ---- 推断输出目录 ----
for %%F in ("%VIDEO%") do set "VID_DIR=%%~dpF" & set "VID_NAME=%%~nF"
set "VID_DIR=%VID_DIR:~0,-1%"
set "OUT_DIR=%VID_DIR%\storyboard"

REM ---- 步骤2: AI 解读 ----
echo [3/5] AI 画面解读 ^(可能耗时较长,免费模型有限流,支持断点续传^)...
echo       ^(若中断,重新运行会自动跳过已完成帧继续^)
echo.
node analyze_frames.mjs "%OUT_DIR%\storyboard.json" "%OUT_DIR%\frames" "%OUT_DIR%\ai_descriptions.jsonl"
if errorlevel 1 (
  echo [!] AI 解读环节出现问题 ^(可能部分帧未完成^)。将基于已完成的结果生成报告。
)
echo.

REM ---- 步骤4: 可选 OCR ----
if "%ENABLE_OCR%"=="1" (
  echo [4/5] OCR 文字提取 ^(可选,需设置 OCR_API_KEY / OCR_BASE_URL / OCR_MODEL^)...
  node ocr_frames_openai.mjs "%OUT_DIR%\frames" "%OUT_DIR%\ocr_text.jsonl"
  if errorlevel 1 (
    echo [!] OCR 环节出现问题。将跳过 OCR,继续生成报告。
  )
  echo.
) else (
  echo [4/5] 跳过 OCR ^(如需启用: set ENABLE_OCR=1^)
  echo.
)

REM ---- 步骤5: 生成最终报告 ----
echo [5/5] 生成分镜报告...
node build_report.mjs "%OUT_DIR%\storyboard.json" "%OUT_DIR%\ai_descriptions.jsonl" "%OUT_DIR%\storyboard_final.md" "%OUT_DIR%\ocr_text.jsonl"
echo.

echo ============================================
echo   完成!
echo ============================================
echo 输出目录: %OUT_DIR%
echo   - frames\              ^(分镜帧图片^)
echo   - storyboard.json      ^(结构化数据^)
echo   - ai_descriptions.jsonl ^(AI解读原始结果^)
echo   - storyboard_final.md  ^(最终分镜表,含AI解读^)
echo.
pause
