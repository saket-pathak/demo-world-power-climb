# 🏛️ Demo World: Power Climb

A Whirlybird-inspired browser-based platform jumper built for offline hackathon use.

## How to Play
- **Arrow Keys / A-D**: Move left & right
- **Mobile**: Tap left/right half of screen
- Land on platforms to jump automatically — keep climbing!

## Platform Types
| Color | Type | Behavior |
|-------|------|----------|
| 🔵 Blue | Normal | Safe, solid |
| 🟡 Yellow | Moving | Slides left/right |
| 🔴 Red | Breaking | Crumbles after you land |
| 🟢 Green | Boost | Super jump! |

## Levels
1. Town Hall
2. City Square
3. Parliament
4. Power Tower
5. Summit (final)

## Customizing the Character
Replace `assets/images/player.png` with your political doodle:
- Recommended size: **36×48px** (pixel art style)
- Transparent background (PNG)
- The game auto-detects and uses your image

## Customizing Platforms
Replace `assets/images/platform.png`:
- Recommended size: **70×14px**
- Used only for `normal` type platforms

## Adding Sounds
Drop your audio into `assets/audio/`:
- `jump.mp3` — played on every jump
- `score.mp3` — played on level-up

> The game uses Web Audio API as fallback, so it works even without audio files.

## Running Offline
Just open `index.html` in any browser — no server needed!

## Project Structure
```
demo-world-power-climb/
├── index.html
├── style.css
├── script.js
├── assets/
│   ├── audio/
│   │   ├── jump.mp3
│   │   └── score.mp3
│   ├── icons/
│   │   ├── emoji1.png
│   │   ├── emoji2.png
│   │   └── emoji3.png
│   └── images/
│       ├── platform.png
│       └── player.png
└── data/
    ├── levels.json
    └── text.json
```