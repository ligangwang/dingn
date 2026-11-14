# Kingdom model credits

The kingdom's villagers, animals, some small props and a few of its buildings
are low-poly models from [Polyfork](https://polyfork.dev/), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), from its Medieval
Village kit. The files here were optimized (deduplicated, quantized, and the
animated ones trimmed to the one animation we play); the shapes are unchanged.

The keep, castle and palace walls and towers, the clock tower, the
watchtower and the plaza fountain are drawn in code
(`src/components/kingdom-models.ts`) and are not Polyfork models. The houses,
church, windmill, well, market stall and gate are listed under "Realistic
buildings" below, and the scanned props and the ship under "Scanned props".
The hot-air balloons are drawn in code too.

| Model                                           | File                                  | Source                                                     |
| ----------------------------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| Anvil by Polyfork, CC BY 4.0                    | `anvil-1286cb.glb`                    | https://polyfork.dev/asset/anvil-1286cb                    |
| Blacksmith Forge by Polyfork, CC BY 4.0         | `blacksmith-forge-09fa85.glb`         | https://polyfork.dev/asset/blacksmith-forge-09fa85         |
| Camp Tent by Polyfork, CC BY 4.0                | `camp-tent-3c5c89.glb`                | https://polyfork.dev/asset/camp-tent-3c5c89                |
| Campfire Cook Tripod by Polyfork, CC BY 4.0     | `campfire-cook-tripod-d95a1e.glb`     | https://polyfork.dev/asset/campfire-cook-tripod-d95a1e     |
| Columnar Evergreen Shrub by Polyfork, CC BY 4.0 | `columnar-evergreen-shrub-35a00b.glb` | https://polyfork.dev/asset/columnar-evergreen-shrub-35a00b |
| Crown by Polyfork, CC BY 4.0                    | `crown-a294ce.glb`                    | https://polyfork.dev/asset/crown-a294ce                    |
| Flame Brazier by Polyfork, CC BY 4.0            | `flame-brazier-bbf74a.glb`            | https://polyfork.dev/asset/flame-brazier-bbf74a            |
| Flower Bed by Polyfork, CC BY 4.0               | `flower-bed-708e73.glb`               | https://polyfork.dev/asset/flower-bed-708e73               |
| Flower Planter by Polyfork, CC BY 4.0           | `flower-planter-500ed2.glb`           | https://polyfork.dev/asset/flower-planter-500ed2           |
| Four-Wheel Wagon by Polyfork, CC BY 4.0         | `four-wheel-wagon-adb946.glb`         | https://polyfork.dev/asset/four-wheel-wagon-adb946         |
| Grain Sack by Polyfork, CC BY 4.0               | `grain-sack-401d96.glb`               | https://polyfork.dev/asset/grain-sack-401d96               |
| Grass Tuft by Polyfork, CC BY 4.0               | `grass-tuft-5ccff0.glb`               | https://polyfork.dev/asset/grass-tuft-5ccff0               |
| Haystack by Polyfork, CC BY 4.0                 | `haystack-77b0dd.glb`                 | https://polyfork.dev/asset/haystack-77b0dd                 |
| Merchant by Polyfork, CC BY 4.0                 | `merchant-6f606b.glb`                 | https://polyfork.dev/asset/merchant-6f606b                 |
| Quench Barrel by Polyfork, CC BY 4.0            | `quench-barrel-0c78fd.glb`            | https://polyfork.dev/asset/quench-barrel-0c78fd            |
| Red fire dragon by Polyfork, CC BY 4.0          | `red-fire-dragon-base.glb`            | https://polyfork.dev/asset/red-fire-dragon-base            |
| Sheep by Polyfork, CC BY 4.0                    | `sheep-base.glb`                      | https://polyfork.dev/asset/sheep-base                      |
| Signpost by Polyfork, CC BY 4.0                 | `signpost-8287c3.glb`                 | https://polyfork.dev/asset/signpost-8287c3                 |
| Sunflower by Polyfork, CC BY 4.0                | `sunflower-80ce15.glb`                | https://polyfork.dev/asset/sunflower-80ce15                |
| Timber Barn by Polyfork, CC BY 4.0              | `timber-barn-90b3ce.glb`              | https://polyfork.dev/asset/timber-barn-90b3ce              |
| Tradesman by Polyfork, CC BY 4.0                | `tradesman-1707b9.glb`                | https://polyfork.dev/asset/tradesman-1707b9                |
| Village Guard by Polyfork, CC BY 4.0            | `village-guard-5f0f6f.glb`            | https://polyfork.dev/asset/village-guard-5f0f6f            |
| Male Villager by Polyfork, CC BY 4.0            | `villager-40255c.glb`                 | https://polyfork.dev/asset/villager-40255c                 |
| Water Trough by Polyfork, CC BY 4.0             | `water-trough-318ee1.glb`             | https://polyfork.dev/asset/water-trough-318ee1             |
| Wheat Plant by Polyfork, CC BY 4.0              | `wheat-plant-7f29a1.glb`              | https://polyfork.dev/asset/wheat-plant-7f29a1              |
| Wheelbarrow by Polyfork, CC BY 4.0              | `wheelbarrow-13f422.glb`              | https://polyfork.dev/asset/wheelbarrow-13f422              |
| Wildflower by Polyfork, CC BY 4.0               | `wildflower-68d3a1.glb`               | https://polyfork.dev/asset/wildflower-68d3a1               |
| Wooden Cart by Polyfork, CC BY 4.0              | `wooden-cart-bf83d8.glb`              | https://polyfork.dev/asset/wooden-cart-bf83d8              |
| Wooden Fence by Polyfork, CC BY 4.0             | `wooden-fence-3d8ee7.glb`             | https://polyfork.dev/asset/wooden-fence-3d8ee7             |

## Realistic buildings

The houses, church, windmill, well, market stall and town gate are textured
models by the Sketchfab authors below, each licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The files are in
`real/`. Each was changed for the web: its parts joined into one mesh, its
textures resized to 1024 px or less and saved as WebP, its geometry quantized,
and the church, gate, well and stall simplified to fewer triangles. The four
"Medieval House" materials were converted from specular-glossiness to
metallic-roughness.

| Model                                                           | File                | Source                                                        |
| --------------------------------------------------------------- | ------------------- | ------------------------------------------------------------- |
| "Medieval House 1" by Animau3D, CC BY 4.0                       | `real/house-1.glb`  | https://sketchfab.com/models/0bbda345359349ea95280f597c8a4bd4 |
| "Medieval House 2" by Animau3D, CC BY 4.0                       | `real/house-2.glb`  | https://sketchfab.com/models/bc9272b74e544db1b93b0ebee8689bf4 |
| "Medieval House 3" by Animau3D, CC BY 4.0                       | `real/house-3.glb`  | https://sketchfab.com/models/cf179aa6dc0944f1974ce3f7812031a6 |
| "Medieval House 4" by Animau3D, CC BY 4.0                       | `real/house-4.glb`  | https://sketchfab.com/models/b42578994a334bb1a544c51043276f85 |
| "Medieval house, Generic Textures" by by\_\_Rx, CC BY 4.0       | `real/manor.glb`    | https://sketchfab.com/models/3eb9e3b600264e2f99100fc43619497e |
| "Gothic Church" by RapidAssets, CC BY 4.0                       | `real/church.glb`   | https://sketchfab.com/models/b498941d7a704173a6ad7446bafe8679 |
| "New Castle Door" by farooq.smurf, CC BY 4.0                    | `real/gate.glb`     | https://sketchfab.com/models/c17775043b0a485e844d5f7a2aacce24 |
| "TP1, Texture générique" (windmill) by Anthony Caron, CC BY 4.0 | `real/windmill.glb` | https://sketchfab.com/models/3e7b03f5e21c48d5a839344513a04520 |
| "Medieval Wooden Well" by LucasPresoto, CC BY 4.0               | `real/well.glb`     | https://sketchfab.com/models/c364167420164db3bc837f351551ba1c |
| "Medieval Market Stall" by AspectStudios, CC BY 4.0             | `real/stall.glb`    | https://sketchfab.com/models/b5d87398b87a4e7ab8959da2c6a47056 |

## Scanned props

The barrels, crates, lamp posts, statues, fire pit, tree stump, boulders and
the ships in the bay are scanned models from
[Poly Haven](https://polyhaven.com/), which are
[CC0](https://creativecommons.org/publicdomain/zero/1.0/) (public domain, no
credit required; listed here so the sources stay known). The files are in
`real/`. Each was simplified to a few thousand triangles, its textures
resized to 512 px or less and saved as WebP, and its geometry quantized.

| Asset             | File                | Source                                    |
| ----------------- | ------------------- | ----------------------------------------- |
| Wine Barrel 01    | `real/barrel.glb`   | https://polyhaven.com/a/wine_barrel_01    |
| Wooden Crate 02   | `real/crate.glb`    | https://polyhaven.com/a/wooden_crate_02   |
| Street Lamp 01    | `real/lamp.glb`     | https://polyhaven.com/a/street_lamp_01    |
| Gothic Statue     | `real/statue.glb`   | https://polyhaven.com/a/gothic_statue     |
| Stone Fire Pit    | `real/fire-pit.glb` | https://polyhaven.com/a/stone_fire_pit    |
| Tree Stump 01     | `real/stump.glb`    | https://polyhaven.com/a/tree_stump_01     |
| Boulder 01        | `real/boulder.glb`  | https://polyhaven.com/a/boulder_01        |
| Dutch Ship Medium | `real/ship.glb`     | https://polyhaven.com/a/dutch_ship_medium |

## Landscape

The sky, the ground, the forest trees and the castle's stone and roof tiles
are made from
[Poly Haven](https://polyhaven.com/) assets, which are
[CC0](https://creativecommons.org/publicdomain/zero/1.0/) (public domain, no
credit required; listed here so the sources stay known). The files are in
`land/`. The sky is the top half of the HDRI, tone-compressed to a JPG; the
ground pictures are resized; the trees are rendered from eight sides and
from above into picture sheets, so no tree mesh is shipped.

| Asset                                 | Files                                                      | Source                                                       |
| ------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| Kloofendal 48d Partly Cloudy Pure Sky | `land/sky.jpg`                                             | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky |
| Forrest Ground 01                     | `land/grass.jpg`, `land/grass-n.jpg`                       | https://polyhaven.com/a/forrest_ground_01                    |
| Rocky Terrain 02                      | `land/hills.jpg`                                           | https://polyhaven.com/a/rocky_terrain_02                     |
| Aerial Rocks 04                       | `land/rock.jpg`                                            | https://polyhaven.com/a/aerial_rocks_04                      |
| Coast Sand 01                         | `land/sand.jpg`                                            | https://polyhaven.com/a/coast_sand_01                        |
| Tree Small 02                         | `land/tree.webp`, `land/tree-n.webp`, `land/tree-top.webp` | https://polyhaven.com/a/tree_small_02                        |
| Fir Sapling Medium                    | `land/fir.webp`, `land/fir-n.webp`, `land/fir-top.webp`    | https://polyhaven.com/a/fir_sapling_medium                   |
| Medieval Blocks 03                    | `land/wall.jpg`, `land/wall-n.jpg`                         | https://polyhaven.com/a/medieval_blocks_03                   |
| Clay Roof Tiles 02                    | `land/tiles.jpg`, `land/tiles-n.jpg`                       | https://polyhaven.com/a/clay_roof_tiles_02                   |
| Roof Slates 02                        | `land/slate.jpg`                                           | https://polyhaven.com/a/roof_slates_02                       |
| Cobblestone Floor 08                  | `land/cobbles.jpg`, `land/cobbles-n.jpg`                   | https://polyhaven.com/a/cobblestone_floor_08                 |
