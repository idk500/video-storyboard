# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-06-25

### Added
- Initial public release of `video-storyboard`
- Subtitle-driven shot segmentation (`extract_storyboard.mjs`)
- Uniform frame extraction fallback when no `.srt` is present
- AI frame analysis via `@idk500/video-vision-mcp`
- Resume-safe long-running analysis (`ai_descriptions.jsonl` checkpointing)
- Automatic retry / cooldown on 429 rate limits
- Markdown report generation (`storyboard_final.md`)
- Windows launcher: `生成分镜.bat`
- macOS / Linux launcher: `run.sh`
- Project scaffolding: `package.json`, `.gitignore`, `LICENSE`, `README.md`

### Changed
- Tool no longer depends on any local `C:\Users\...` paths
- Tool no longer contains hardcoded API keys
- Visual prompt generalized (not tied to hockey-themed videos)

### Fixed
- Shot segmentation off-by-one boundary (`>` -> `>=`)
- End-of-video frame extraction clamp (`duration - 1s`) to avoid tail-frame failures
- Report truncation improved to respect punctuation / word boundaries
