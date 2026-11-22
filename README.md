[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Albertard/makefun-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Albertard/makefun-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# SOLMARA — Sun City Crime

A top-down open-world crime game for the make.fun competition
**"Make GTA 6"** (`gta6-01`).

Mara Voss owes fixer Rico Bellamy a debt. Work it off over seven jobs across
Solmara — a sun-soaked coastal city of harbours, downtown towers, the neon
Strip and the Marina Bay beach. Steal cars, outrun the Solmara PD, fight the
Cobras, and pull the Grand Solmara score that clears the debt for good.

## How to play

- **WASD / arrow keys** — move on foot, drive · **Shift** — run
- **E** — steal / enter a car, get out, start the next job at Rico's Garage
- **Mouse** — aim · **Click** — shoot the pistol / punch · **F** — punch
- **Space** — handbrake · **P / Esc** — pause · **M** — mute
- Open `game/index.html` in a desktop browser (no server needed), or serve
  `game/` with any static server.

## The city

- **A drivable city**: 10 avenues, 8 streets, six districts (Old Harbor,
  North Hills, Downtown, The Strip, Marina Bay, South Beach), parks, parking
  lots, a harbour with piers and a beach.
- **Traffic and pedestrians**: cars drive the road graph in their lanes and
  slow for the car ahead; pedestrians stroll the sidewalks and scatter from
  gunshots and crashes.
- **Steal any car**: pull the driver out of a moving car or take a parked one.
  Eight models, from the gold Comet to the police Interceptor.
- **Wanted, 0–5 stars**: stealing, hitting pedestrians and shooting raise the
  heat. Interceptors ram you; foot cops chase, shoot at three stars, and
  arrest you on foot. Lie low and the stars fade.
- **Combat**: fists and a P9 pistol, with health and ammo pickups around town.
- **Seven story missions**: First Gear, The Pickup, Borrowed Wheels, Heat,
  Street War, The Getaway, and The Grand Score — timed deliveries, a getaway,
  a gang defence and a four-star escape to the airfield.
- **HUD with minimap**: health, money, wanted stars, objective, speed, and a
  live map of the player, the police and the job marker.
- **Save**: progress (money, jobs, position) saves to the browser and resumes
  from the title screen.

## Screenshots

The cover shows the getaway: three stars, interceptors closing in, the job
objective on the HUD. The other shots show Downtown on foot and the Street
War shootout at Rico's Garage. Every screenshot is a real render of the
game's own code, staged deterministically with `?shot=cover|street|mission|menu&seed=7`
(see `shots.json`); the game sets `window.__shotReady` when a staged frame is
painted.

## Build

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to `/output` and writes `/output/dossier.json` with the vendored make.fun
library:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

All art, sound and music are original and generated in code — no assets from
any commercial game. Built for make.fun: https://make.fun/r/t85p2qsg
