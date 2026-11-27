# Order 591

A browser roguelike. Pure JS (ES modules, no bundler), WebGL2 only, one
canvas at 800×450 scaled up by an integer factor. The world is low-poly 3D
built from primitives at startup (no model or texture files), seen from a
fixed dimetric angle; text and menus are an 8×8 glyph overlay.

```
NEED RESCUE PER ORDER 5.9.1
```

**Play it:** <https://gmaker.github.io/order-591/>

## Run

Any static file server from the project root (ES modules and shader fetches
need http, not file://):

```powershell
npx --yes http-server -c-1 -p 8591 .
```

Then open <http://localhost:8591/>.

Headless checks:

```powershell
node tools/smoke.mjs 591 300      # generate every floor and let a random walker play
node tools/balance.mjs 300        # fight table: hits to kill, hp cost per floor and class
```

## Languages

Russian by default, English from the title menu (the choice is kept in
localStorage). Source strings in the code are English and double as keys;
`src/data/lang/ru.js` maps them, `src/i18n.js` does the lookup, plurals and
the long text pages. The 5×7 font covers Latin and Cyrillic capitals.

## Controls

| Key | Action |
| --- | --- |
| left click | walk there along the shortest known path (stops when a new enemy shows up or something blocks the way; click again to walk on past known enemies); adjacent cell = attack / open / use |
| right click | shoot at that cell with the bow or staff (arrows, fireballs, ice shards, chain lightning) |
| numpad / arrows / hjkl yubn | step, attack by walking into things |
| shift + move | shoot that way |
| 5 / . / space | wait a turn |
| side panel | gear and pack, always visible: click to equip or take off, right click to use or drop |
| C or Q | close doors around you |
| Escape | leave the peddler, close windows |
| ? | help (pages in a window: space / arrows turn them, Escape closes) |

## Layout

```
src/
  main.js            entry: loop + input + renderer + scene stack
  config.js          resolution, scale, tick rate, key repeat
  core/              GameLoop (fixed 60 Hz ticks), Input, Rng (seeded), Noise (Perlin)
  gfx/               GlContext (canvas + WebGL2), Renderer (glyph overlay),
                     Atlas (procedural font + sprites), Palette, Screen
  gfx3d/             Camera (dimetric ortho), MeshBuilder + Models
                     (primitives, flat shading), SceneRenderer (instanced
                     draws, lights, wind), Particles, Mat4
  scenes/            Title, intro/help text, character creation, the game,
                     level-up and death windows
  ui/                SidePanel (gear, pack, peddler), Modal (windows)
  game/              Level (simulation), LevelGen (procedural floors),
                     WorldView (level → 3D frame, animation, effects),
                     Pathfinder, tiles, mobs, items
  data/              items (tiers, affixes, spells), creatures, races and
                     classes, biomes; lang/ru.js, lang/en.js text bundles
  i18n.js            t(), tn(), pages(), language switch
```

Everything on screen is an 8×8 glyph from a procedural atlas; there are no
image assets. Each floor is generated from the run seed, so a seed
reproduces the whole station.
