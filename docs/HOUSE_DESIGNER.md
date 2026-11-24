# House Designer

Generates a whole house from a request: floor plan, rooms, doors and windows, floor and
wall finishes (tiles, timber, stone, paints, wallpapers), furniture, decor and lighting.
Everything it places is a normal asset you can move, edit, delete or undo.

Open it from **House Designer** in the header.

## Using it

1. Describe the home, for example:
   - *Modern 3 bedroom, 2 bathroom home with a study, large-format tiles and warm lighting*
   - *Scandinavian two storey, 4 bedrooms, 3 bathrooms, oak floors and a blush floral wallpaper feature wall*
   - *Art deco luxury villa, marble floors and bathrooms, gold geometric wallpaper in the living room*
2. Check the green chips (what was understood) and adjust the controls: bedrooms (1-6),
   bathrooms (1-5), single or two storeys, total area, study, laundry, style, light colour,
   and the tile / floor / wallpaper pickers.
3. Compare the three variations as floor plans, then use **Show more options** for more.
4. Read the **finish schedule** and the indicative cost, then **Apply to workspace**
   (one undo step; it replaces the current design).
5. In the workspace, use **Day / Evening / Night** to preview the lights and **Cutaway**
   to drop the walls to waist height so the rooms are visible from above.

**Read with AI** sends the request to Gemini (your key, or your plan's hosted credits)
to pick up details the built-in reader misses. Without a key everything else still works.

## What it builds

- **Plans:** 1-6 bedrooms on one or two storeys. Rooms tile each floor exactly. Every room
  is reachable from the entrance; bathrooms, ensuites and the powder room are never walked
  through; the ensuite opens onto the master bedroom; habitable rooms on an outside wall
  get windows; the entrance hall gets the front door. Single storey: public row (entrance,
  living, dining, kitchen, study, laundry), hall, private row. Two storeys: a full-height
  stair hall in the west, living and kitchen below, bedrooms either side of a corridor above.
- **Sizes:** if the requested area is too small for every room to stay usable, the plan is
  built at the closest workable size and says so. If a brief cannot fit (for example six
  bedrooms on one floor with every extra), extras are dropped one at a time and listed.
- **Furniture and decor:** placed against walls with clearances: nothing overlaps, door
  swings stay clear, tall pieces stay off windows. Living room (sofa, coffee table, rug,
  TV, shelves, armchair, lamps, art), dining (table, six chairs, sideboard), kitchen (units,
  wall units, fridge, island and stools when there is room), bedrooms (bed, bedsides,
  wardrobe, dresser, rug, art), bathrooms (toilet, vanity, mirror, shower, bath), study,
  laundry, entrance, corridors, curtains and plants. Decor density follows the style.
- **Lighting:** downlights, ceiling lights, pendants over the dining table and kitchen
  island, wall sconces and floor lamps, by style, with the light colour from 2700 K (warm)
  to 4500 K (cool daylight). The preview adds up to 24 real light sources.
- **Finishes:** 16 floors (porcelain, marble, terrazzo, encaustic and checker tiles,
  travertine, slate, oak, walnut, chevron parquet, concrete, carpet) and 27 walls (10 paints,
  subway, zellige, terracotta, marble and large-format wall tiles, 11 wallpapers: stripe, floral,
  geometric, damask, grasscloth, chevron, art deco fan, plus oak slat panelling). Bathrooms and the laundry only get
  wet-safe finishes. Tile sizes are real (a 60 cm tile is 60 cm).
- **Styles:** Modern, Scandinavian, Japandi, Industrial, Mid-Century, Traditional, Boho,
  Luxury Art Deco, Coastal, Minimalist. Each has alternates, so the variation number changes
  the finishes as well as the layout.

## Extending it

| To add | Edit |
|--------|------|
| A style | `src/house/styles.ts` (the tests check every finish id and that wet rooms use wet-safe finishes) |
| A finish | `src/house/finishes.ts`, plus a pattern in `src/three/finishTextures.ts` if it needs a new one |
| A furniture or decor item | `src/house/assetSpecs.ts` (real size, mounting, cost), its parts in `src/three/houseModels.ts`, and the type in `src/types.ts`; run `npm run assets:iso` for the icon |
| Request keywords | `src/house/parseBrief.ts` |

The bounding-box tests in `tests/unit/houseModels.test.ts` fail if a model is not built to
the size in the spec table. The generator tests (`houseLayout`, `houseGenerate`) check plans
across a grid of bedroom, bathroom, storey, style and variation combinations.

## AI endpoints

`POST /api/house-brief` (your Gemini key in `x-gemini-api-key`) and
`POST /api/ai/house-brief` (signed-in, metered like the other hosted AI routes) take
`{ prompt }` (max 4000 characters) and return a structured brief. The response is
sanitised on the client (`sanitizeAiBrief`): unknown styles and finish ids, wrong
surfaces, non-wet-safe bathroom finishes and out-of-range numbers are dropped, so a bad
model answer can never produce an invalid house.

## Known limits

- Layouts are rectangular and generated from templates, so they are sensible rather than
  inspired. Use the variations, or edit rooms and furniture by hand afterwards.
- Two-storey houses have no stair void cut in the upper floor, and the staircase is a
  solid block, not a railed stair.
- Re-styling or re-lighting a design regenerates furniture or lights; pieces you moved are replaced.
- Costs are indicative list prices, not quotes.
- Doors are openings (the front door has a leaf); interior door leaves are not modelled.
