# Note Sorter — Obsidian Plugin

A plugin for [Obsidian](https://obsidian.md) that lets you reorder notes inside any folder by dragging and dropping them directly in the file explorer.

---

## How it works

By default, Obsidian sorts notes alphabetically and doesn't allow custom ordering. Note Order solves this by letting you drag notes into any position within their folder, and persisting that order across sessions.

The custom order is saved in `.obsidian/plugins/obsidian-note-sorter/data.json` and is automatically restored every time you open Obsidian.

---

## Usage

### Reordering notes
Hold **Shift** and drag a note to reorder it within its folder.

### Moving notes to another folder
Drag a note **without Shift** to move it to a different folder — this uses Obsidian's native behavior.

### Other actions
- **Click** a note to open it normally.
- **Right click** a note for additional options (rename, move, delete...).

---

## Installation

### Manual install
1. Download `main.js` and `manifest.json` from the latest release.
2. Copy them to your vault at `.obsidian/plugins/obsidian-note-sorter/`.
3. Open Obsidian → `Settings` → `Community plugins` and enable **Note Sorter**.

### From source
```bash
git clone https://github.com/your-username/obsidian-note-sorter
cd obsidian-note-sorter
npm install
npm run build
```
Then copy `main.js` and `manifest.json` to your vault's plugins folder.

---

## Known limitations

- Only reorders notes (`.md` files), not subfolders.
- The order is visual only — file names are not modified.
- Built and tested on Obsidian desktop. Mobile not tested.

---

## Version history

| Version | Changes |
|---------|---------|
| 1.0.3 | Fixed freeze on drop, added Shift modifier to distinguish reorder from move |
| 1.0.2 | Drag & drop directly in the file explorer tree |
| 1.0.1 | Mouse events drag & drop in side panel |
| 1.0.0 | Initial release with side panel |

---

## Author

Made by Jose Luis Melandri Garcia.