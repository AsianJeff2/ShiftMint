# Desktop assets

The checked-in icons already exist. Keep their current names aligned with `package.json` and `electron/main/index.ts`:

| File | Current use |
| --- | --- |
| `icon.ico.ico` | Windows application, NSIS installer and uninstaller |
| `icon.png.png` | Linux application and Electron window icon |
| `icon.icns` | macOS application |

The doubled `.ico.ico` and `.png.png` extensions are the actual filenames. No conversion or rename is required for the configured build. If replacing an icon, validate its format and update every reference together. The installer configuration does not use custom welcome/header/sidebar bitmap assets.

From the repository root, `npm run build` creates the renderer and compiled backend/Electron source. `npm run dist:win` builds the configured Windows x64 NSIS and portable targets; `npm run dist:win-portable` selects the portable target. Artifacts go to `release/`. `npm run dist:mac` and `npm run dist:linux` select their configured platform targets and still require verification on those platforms.

Windows currently uses `asInvoker`, a per-user installer and no elevation. Code signing is not configured or required by this build. An unsigned artifact can produce operating-system trust warnings; an existing icon does not establish signing, installer UI acceptance or release approval. Verify a native installation with disposable data before distribution.

The old asset completion notes are retained under `archive/legacy-source/assets/` as historical, unverified records. Their obsolete conversion instructions, packaging scripts and output-directory claims do not describe this release.
