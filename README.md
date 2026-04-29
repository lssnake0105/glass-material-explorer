# Glass Material Explorer

Static Nd-Vd material explorer for CDGM, NHG, and plastic optical material libraries.

## Use

Open `index.html` from GitHub Pages or open `material_explorer.html` locally.

Main features:

- Search and highlight materials by name.
- Filter by library, material family, generated tags, custom tags, and numeric ranges.
- View the global Nd-Vd map and a local Nd-Vd slice around the selected material.
- Compare nearby substitute candidates with a combined optical/engineering score.

## Regenerate

When the source material TXT files change, regenerate the standalone HTML:

```powershell
node .\build_material_explorer.js
Copy-Item .\material_explorer.html .\index.html
```

`index.html` is the GitHub Pages entry point.
