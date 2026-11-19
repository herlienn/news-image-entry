# News Image — 18 November 2026 (v2)

[![make.fun](https://make.fun/badge/news-image-20261118.svg)](https://make.fun/bounty/news-image-20261118)
[![rank](https://make.fun/badge/news-image-20261118/herlienn/news-image-entry/rank.svg)](https://make.fun/bounty/news-image-20261118)
[![reward](https://make.fun/badge/news-image-20261118/herlienn/news-image-entry/reward.svg)](https://make.fun/bounty/news-image-20261118)

One image that sums up the world's news of Wednesday, 18 November 2026 — 35 stories from 6 continents, drawn as a one-page newspaper front page. A denser rebuild of the first entry in this repo: same day, same newspaper idea, many more stories.

## What's in the picture

- **Header count line:** "35 STORIES • 6 CONTINENTS • ONE DAY", plus a per-region count bar (Europe 7, Middle East 5, Asia 12, Africa 1, Americas 6, Oceania 1, World 3).
- **The Day in Numbers:** 3 leaders, 1 summit, $115.84B Nvidia, 56–44 Senate, 145 km/h Akvan gusts, 5,400 measles cases, 97-run ODI win, 1 light-day Voyager.
- **Three illustrated hero panels:** APEC opens in Shenzhen, Iran hits back in the Gulf, Democrats take the Senate.
- **Twelve featured stories**, each with its own small drawing: Trump meets Marcos in Manila, Crimea Bridge hit again, North Korea's hypersonic claim, Nvidia doubles its revenue, Cyclone Akvan nears India, Voyager 1 reaches one light-day, EU's €45B Ukraine loan, Dhoni bows out of the IPL, Duckett's 133 wins the ODI series, Board of Peace blames both sides, Ebola hits children hardest in DRC, US loses measles-free status.
- **Where it happened:** a world map with 11 numbered pins and a key.
- **Also on Wednesday 18 November:** 20 more one-line stories, items 16–35.
- **By the Clock — UTC:** a timeline of the day.
- **Sources footer** (Reuters, AP, AFP, BBC, Al Jazeera, Bloomberg) and a **Date Check** note naming two stories deliberately left out because they happened on 17 November.

## How to run it

Requires Node 22. Standard library only — no network, no dependencies.

```sh
node main.ts [output.png]
```

With no argument it writes to `/output/entry.png`. The output is a 1024×1024 PNG (46,597 bytes). Two runs produce byte-identical output (sha256 `03f4f4ea6c95c7f10a230a77b61d9d6245fe6d064f40cc8edda3722a99990df0`).

## How it draws

`main.ts` draws everything itself: its own PNG encoder (built on `node:zlib`), its own 5×7 bitmap font, and every picture — skyline, sea, capitol, rocket, cyclone, map — drawn from shapes. No image files are read at runtime.

## License

MIT — see `LICENSE`.
