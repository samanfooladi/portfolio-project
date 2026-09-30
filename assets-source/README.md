# assets-source

The originals every shipped image is built from. Nothing here is served: run
`npm run images` and it writes `public/characters/<id>/` plus the measured
`src/data/character-anchors.json`.

## Layout

```
assets-source/
  <Name> bg.png          the three lineup layers, one flat file per character,
  <Name> Full view.png   matched by name. Case, spaces, underscores and hyphens
  <Name> close-up.png    are all treated as the same thing.
  <id>/                  per-character extras, currently only Foxy's:
    pose-<key>.png         a story pose -> public/characters/<id>/pose-<key>-{1600,3200}.{webp,avif}
    sheet-<key>.*          reference art. Never built, never served.
  _superseded/           earlier versions, kept for reference only.
```

Poses are cut out and stood on the wallpaper the same way the Full views are,
so **a pose source must have a real transparent background**. The build trims
each one to its opaque box; a pose on an opaque background has nothing to trim
to, so it is reported and skipped rather than shipped as a rectangle.

## Foxy

The scroll story shows four of these. `sheet-*` is where the chapter text in
`src/data/stories/foxy.ts` comes from -- it is reading material, not artwork.

| original filename | here | what it shows | used by |
| --- | --- | --- | --- |
| `Foxy bg.png` | unchanged | the casino floor, no character | the wallpaper behind every screen |
| `Foxy close-up.png` | unchanged | bust, facing the viewer, bow tie and fox pin | the hero close-up of the selected state |
| `Foxy Full view.png` | unchanged | full body, facing the viewer, standing, hands at her sides | the lineup strip, the mobile stage, **and story chapter 1** (`pose: "front"`) |
| `Foxy_height_front.png` | not copied | the same standing pose as `Foxy Full view.png`, a little more padding | -- reused rather than duplicated |
| `file_00000000e95c81f59dab7c3615e7ba02.png` | `foxy/pose-tea.png` | sitting in a leather armchair, teacup and saucer, tail over the arm | story chapter 2 |
| `foxy-pose-bullet-tail.png` | `foxy/pose-bullet-tail.png` | walking, tail swung up, deflecting a bullet in a burst of sparks | story chapter 3 |
| `file_00000000796c82109524c5d3ca1d45b1.png` | `foxy/pose-profile.png` | bust, profile, looking up, fox pin on the lapel | story chapter 4 |
| `Foxy_height_back.png` | `foxy/pose-back.png` | full body from behind, tail down her left side | nothing yet. Low resolution (1024x1536), so both outputs land at 1512 tall |
| `Foxy_powersheet.png` | `foxy/sheet-power.png` | the power domain, abilities, limitation and stat grades | source for chapters 3 and 4. Not displayed |
| -- | `foxy/sheet-character.png` | the character sheet: front/back, expressions, swatches, character notes | source for chapters 1 and 2. Not displayed |

Where a pose is upscaled, the upscaled file is the one kept: the poses render up
to 92vh, which on a tall hi-dpi screen asks for the 3200-tall output, and the
originals are only ~1450px tall.

## Sam

Delivered already cut out and already named, so only the folder changed. All
four have real transparency -- the black is his tracksuit, not a background.

| original filename | here | what it shows | used by |
| --- | --- | --- | --- |
| `Sam bg.png` | unchanged | the arena floor, no character | the wallpaper behind every screen |
| `Sam close-up.png` | unchanged | bust, facing the viewer, jacket zipped | the hero close-up of the selected state |
| `Sam Full view.png` | unchanged | full body, jacket on, thumbs up | the lineup strip and the mobile stage |
| `sam-extra/pose-shirtless.png` | `sam/pose-shirtless.png` | standing shirtless, hand on hip, confident grin | story chapter 1. A different render from the Full view, not a duplicate |
| `sam-extra/pose-charge.png` | `sam/pose-charge.png` | leaping forward, hand reaching at the viewer, grinning | story chapter 2 |
| `sam-extra/pose-crash.png` | `sam/pose-crash.png` | crouched on one knee, torn sleeve, bloodied hands, spent | story chapter 3 |
| `sam-extra/pose-face-scar.png` | `sam/pose-face-scar.png` | bust, three-quarter, wound on the cheek, orange speed streaks | story chapter 4 |
| `character sheet.jpg` | `sam/sheet-character.jpg` | stats, traits, hobbies, expressions, colour palette, his in-character quote | source for chapter 1. Not displayed |
| `Power-sheet.jpg` | `sam/sheet-power.jpg` | Thrill Drive, the limitation, the side captions, his acceptance line | source for chapters 2-4. Not displayed |

## Navid

Delivered already cut out and already named; only the two sheets were renamed.
All four poses have real transparency -- the white sneakers and the pale
ripples around his head survived intact, so nothing was keyed.

| original filename | here | what it shows | used by |
| --- | --- | --- | --- |
| `Navid bg.png` | unchanged | dark city, cyan and orange light streaks, no character | the wallpaper behind every screen |
| `Navid close-up.png` | unchanged | bust, facing the viewer, sling bag strap | the hero close-up of the selected state |
| `Navid Full view.png` | unchanged | full body, black jeans, hand in pocket | the lineup strip and the mobile stage |
| `pose-stand.png` | `navid/pose-stand.png` | standing, one hand in his pocket, calm. A different render from the Full view (blue jeans, head turned) | story chapter 1 |
| `pose-sense.png` | `navid/pose-sense.png` | bust, looking off to the side, faint blue ripples around his head | story chapter 2 |
| `pose-plan.png` | `navid/pose-plan.png` | crouched on one knee, fist to his chin, thinking | story chapter 3 |
| `pose-evade.png` | `navid/pose-evade.png` | mid-evasion, bent low and twisted, one foot off the ground | story chapter 4 |
| `Character sheet.png` | `navid/sheet-character.png` | stats, personality, hobbies, expressions, palette | source for chapter 1. Not displayed. Its **183 cm is wrong** -- he is 171 cm, as the power sheet says |
| `Power sheet.png` | `navid/sheet-power.png` | Omen Sense, the mechanic, the limitation, the seven captions | source for chapters 1-4. Not displayed |

### Open items

- **`foxy/sheet-character.png` is a downscaled copy** (1055x1491) taken from chat,
  not the original file. Fine for reading, so replace it whenever convenient.
- **Three of Navid's poses are not upscaled.** `pose-sense`, `pose-plan` and
  `pose-evade` are 1122x1402 originals, so both their 1600 and 3200 outputs
  stop at ~1400px tall. At 92vh on a 1440px screen that is roughly 1:1, and
  half resolution on a hi-dpi one. `pose-stand` is fine (5120x7680). Run the
  three through the same 5x upscale the others had and rebuild.

## Keeping this current

Change anything in here and update the table in the same commit -- it is the
only place the original filenames survive.
