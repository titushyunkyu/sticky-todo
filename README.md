# Sticky Todo

A small always-on-top to-do note. Categories, due dates, check off, delete,
and a switch between sorting by due date and grouping by category.

## Running it

1. Install **Node.js** from <https://nodejs.org>. Check with `node --version`.

2. Put this folder somewhere **outside OneDrive** — `C:\dev\sticky-todo` or
   similar. `node_modules` is tens of thousands of small files, and OneDrive
   syncing them causes file locks and half-downloaded placeholders.

3. In a terminal, from that folder:

   ```
   npm install
   npm start
   ```

The note appears, floating above your other windows. Drag it by the top bar,
resize from any edge.

## Making it a real double-clickable app

```
npm run dist
```

The installer lands in `dist/`.

- **macOS** — `dist/Sticky Todo-1.0.0.dmg`. It isn't code-signed, so the first
  launch needs a right-click → **Open** → **Open**, rather than a double-click.
- **Windows** — `dist/Sticky Todo Setup 1.0.0.exe`. SmartScreen will warn about
  an unknown publisher: **More info** → **Run anyway**.
- **Linux** — an AppImage. `chmod +x` it, then run it.

Build on the platform you're targeting; a Mac app can only be built on a Mac.

### If `npm run dist` fails on Windows

The usual cause is a permissions one, not a code one. To produce the installer,
electron-builder downloads a signing toolkit that contains symbolic links, and
Windows refuses to create those unless the account is allowed to. The error
mentions a required privilege not being held, or failing to create a symbolic
link.

Any one of these fixes it:

- Turn on **Developer Mode**: Settings → Privacy & security → For developers.
  This grants the symlink privilege and is the cleanest option.
- Or run the terminal **as Administrator** for the build.
- Or skip the signing toolkit entirely, since this app isn't signed anyway.
  In PowerShell, before building:

  ```
  $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
  npm run dist
  ```

Also build from a folder outside OneDrive. The build writes a few hundred
megabytes into `dist\`, and OneDrive tries to sync all of it mid-write.

You'll see a warning that no application icon is set. That's expected — the
build uses Electron's default icon. To use your own, drop a 256×256 `icon.png`
into a `build/` folder next to `package.json`.

`npm start` doesn't need any of this. Packaging is the only step that does.

To have it open at login: macOS System Settings → General → Login Items;
Windows, drop a shortcut in `shell:startup`.

### If an install goes wrong

A half-finished `npm install` doesn't repair itself. Delete the tree and redo
it — in Windows PowerShell:

```
Remove-Item -Recurse -Force node_modules
npm install
```

If that still fails, delete `package-lock.json` as well and install again.

## The buttons along the top

| | |
|---|---|
| Pin | Toggles always-on-top. Gold means it's floating above everything. |
| Tag | Opens the category editor. |
| – | Minimize. |
| × | Quit. Everything is already saved. |

## Typing a due date

The date box takes shorthand and shows you what it understood underneath, so
you can always see what you're about to get. Leave it blank for no due date.

| Type | Means |
|---|---|
| `today`, `tomorrow`, `tom` | today / tomorrow |
| `fri`, `friday`, `thurs` | the next Friday — today counts as itself |
| `next fri` | the Friday after that |
| `3d`, `in 3 days`, `2w` | 3 days / 2 weeks out |
| `10/14`, `10-14` | Oct 14, rolling to next year if that date has passed |
| `12/25/26`, `2026-12-25` | an exact date, past dates included |
| `oct 14`, `14 oct`, `jan 5 2028` | same, spelled out |

### Adding a time

Put the time after the date. `at`, `by`, and `@` are ignored, so write it
however reads naturally.

| Type | Means |
|---|---|
| `eod` | **11:59 PM today** |
| `fri eod`, `10/14 eod` | 11:59 PM on that day |
| `midnight`, `tonight` | also 11:59 PM — the end of the stated day, not 00:00 |
| `noon` | 12:00 PM |
| `5pm`, `5p`, `5:30pm`, `5.30pm` | that time today |
| `17:00`, `09:05` | 24-hour, colon required |
| `fri at 5pm`, `10/14 @ 3:30pm` | date and time together |
| `tomorrow 9:15am` | ditto |

A date on its own has no time attached, and stays that way.

Anything it can't read turns the hint red and refuses to add the task, rather
than guessing at you. A bare number is never read as a time — `fri 5` is
rejected, `fri 5pm` is not.

## Everything else

- Click the **checkbox** to finish a task. It greys out, strikes through, and
  drops to the bottom. Click again to bring it back.
- Click a task's **text** to edit its wording, date, or category. Enter saves,
  Escape cancels.
- The **×** on the right of a row deletes it. It appears on hover.
- **Due date** sorts everything by date and then by time, overdue first,
  undated last. Within one day, tasks with a time come first in clock order and
  tasks without one sit at the end of that day.
  **Category** groups it instead, earliest first inside each group.
- Overdue is clock-aware. Something due today at 9am turns red at 9:01am.
  Something due today with no time only turns red once the day is over. The
  list refreshes itself as the clock moves, but never while you're mid-edit.
- Deleting a category moves its tasks to another one. Nothing is lost.
- Category colours come from a six-colour palette and show up on the checkboxes,
  so you can read the category off the list without switching sort.

## Your data

One plain JSON file, written atomically so a crash can't corrupt it:

- macOS `~/Library/Application Support/Sticky Todo/data.json`
- Windows `%APPDATA%\Sticky Todo\data.json`
- Linux `~/.config/Sticky Todo/data.json`

Copy it to back up. A damaged file falls back to an empty list instead of
refusing to start.

## Export .ics

Writes your unfinished dated tasks to a calendar file. Tasks with a time become
30-minute events at that time; tasks without one become all-day events. In
Google Calendar: **Settings → Import & export → Import**.

This is a one-time snapshot, not a sync. Export again later and you'll get
duplicates unless you delete the first import.

## Changing the colours

The top of `styles.css` has the whole palette in eleven variables. Change them
and restart. `--surface`, `--raised`, and `--edge` are the backgrounds,
`--text` and `--dim` the type, `--accent` the gold, and `--c0` to `--c5` the
category colours.

## Tests

```
node test-dates.js
```

169 checks on the date and time parser: every shorthand form, `eod` in each
position, 12- and 24-hour clocks, invalid times, leap years, year rollover,
clock-aware overdue logic, and a round-trip over 400 consecutive days. Passes
identically in nine time zones.
