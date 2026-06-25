# v1.0.0 — Initial public release

## What it does

`video-storyboard` turns a video into a structured storyboard report:

**video / subtitle → frame extraction → AI visual descriptions → markdown report**

## Highlights

- Subtitle-driven shot segmentation
- Uniform frame extraction fallback when no subtitle is available
- AI-generated visual descriptions for each frame
- Resume-safe long-running analysis
- Automatic retry on 429 rate limits
- Markdown storyboard report generation
- Windows launcher: `生成分镜.bat`
- macOS / Linux launcher: `run.sh`

## Output

The tool writes a `storyboard/` directory next to the input video:

- `frames/`
- `storyboard.json`
- `ai_descriptions.jsonl`
- `storyboard_final.md`

## Dependency

This project depends on:

- `@idk500/video-vision-mcp`
- `VISION_API_KEY`
- `ffmpeg` / `ffprobe`

## Notes

- If a same-name `.srt` exists, the tool uses subtitle-driven shot segmentation.
- If no subtitle is found, it falls back to uniform frame extraction.
- API keys are **not** stored in code and must be provided via environment variables.
