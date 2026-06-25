# Contributing

Thanks for your interest in improving `video-storyboard`.

## Development setup

```bash
npm install
```

You also need:
- Node.js >= 18
- `ffmpeg`
- `ffprobe`
- `VISION_API_KEY`

## Local workflow

### Extract frames

```bash
node extract_storyboard.mjs "video.mp4"
```

### Analyze frames

```bash
node analyze_frames.mjs "storyboard/storyboard.json" "storyboard/frames"
```

### Build report

```bash
node build_report.mjs "storyboard/storyboard.json" "storyboard/ai_descriptions.jsonl"
```

## Guidelines

- Do not commit API keys or tokens
- Do not hardcode machine-specific paths
- Keep prompts generic unless the change is deliberately domain-specific
- Prefer small, focused commits

## Issues and pull requests

- Open an issue for bugs or feature ideas
- Fork the repository and submit a pull request
- Explain what changed and why
