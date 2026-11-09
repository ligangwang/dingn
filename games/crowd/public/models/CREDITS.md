# Crowd Rush models

These models are from [Polyfork](https://polyfork.dev) and are used under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (see
https://polyfork.dev/licensing):

- Infantry Rifleman by Polyfork (https://polyfork.dev/asset/infantry-rifleman-c1c0a5), CC BY 4.0
- Orc Brute by Polyfork (https://polyfork.dev/asset/orc-brute-08c6ca), CC BY 4.0
- Tyrannosaurus Rex by Polyfork (https://polyfork.dev/asset/tyrannosaurus-rex-adf79f), CC BY 4.0
- Rifle by Polyfork (https://polyfork.dev/asset/rifle-df1815), CC BY 4.0
- Rotary Cannon by Polyfork (https://polyfork.dev/asset/rotary-cannon-e2114b), CC BY 4.0
- Rocket Launcher by Polyfork (https://polyfork.dev/asset/rocket-launcher-032299), CC BY 4.0

Changes: the files were quantized with `gltf-transform quantize` to make them
smaller, and the T-Rex's animation keyframes were resampled
(`gltf-transform resample`). At runtime the game recolours the rifleman's jacket and helmet per
team, poses the rifleman and orc with its own run and walk cycles, and scales
all three models. The T-Rex opens its jaw as it lunges. The three weapons (in `weapons/`) are
placed in the rifleman's hand in place of his rifle, one per damage level.

Polyfork does not endorse this game.
