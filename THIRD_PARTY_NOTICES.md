# Third-party notices

## 3D models: KayKit : Furniture Bits (1.0)

Used for the chairs, tables, desks, counter, cabinet and plant in the editor and in
the Library thumbnails (`public/models/kaykit/`, `public/iso/`).

- **Author:** Kay Lousberg — <https://www.kaylousberg.com>
- **Source:** <https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0>
  (also <https://kaylousberg.itch.io/furniture-bits>)
- **License:** Creative Commons Zero (CC0 1.0) — free for personal, educational and
  commercial use, attribution not required but given here.
  <https://creativecommons.org/publicdomain/zero/1.0/> · original text in
  `public/models/kaykit/LICENSE.txt`
- **Files:** seven models, committed unmodified (`.gltf`, `.bin`, one shared `.png`
  texture atlas), pinned by SHA-256 in `public/models/kaykit/manifest.json`.

| Asset type | Model |
|---|---|
| `chair_office` | `chair_C` |
| `chair_lounge` | `armchair_pillows` |
| `desk_single` | `table_small` |
| `desk_cluster_4` | `table_medium` |
| `desk_cluster_6`, `conference_table` | `table_medium_long` |
| `reception_desk`, `cabinet` | `cabinet_medium` |
| `plant_pot` | `cactus_medium_A` |

## Original models

The low-current device models (access point, CCTV, data / telephone / HDMI / projector
ports, door reader, intercom, floor power box) and the whiteboard were built for this
project (`src/three/deviceModels.ts`, `src/three/proceduralAssets.ts`) and are covered
by the repository license. No accessible free 3D library offers network or AV
hardware, so none were sourced.

## Software

Runtime and build dependencies keep their own licenses; an SBOM (CycloneDX) is
produced by CI on every run.
