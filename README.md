# Mathpad

Math notes without writing LaTeX. Type math the way you'd text it, and it turns into real notation as you go.

| You type | You get |
|---|---|
| `x^2/3` | x² over 3, as a stacked fraction |
| `sqrt(b^2 - 4ac)` | a square root over b² − 4ac |
| `int from 0 to 1 x^2 dx` | an integral from 0 to 1 of x² dx |
| `lim x->0 sin(x)/x = 1` | the limit as x → 0 of sin x over x |
| `sum n=1 to inf 1/n^2 = pi^2/6` | a sum from n = 1 to ∞ equal to π² over 6 |
| `[1, 2; 3, 4]` | a 2×2 matrix |

Notes export to LaTeX (for Overleaf) or Markdown (for Obsidian, Notion, GitHub).

It comes in two versions built from the same code:

- **Windows app**: an installer (`Mathpad-Setup-x.y.z.exe`) that works offline and saves notes on your computer.
- **Web app**: one HTML page (`docs/index.html`) that GitHub Pages can host for free. It saves notes in your browser.

## Using it

- **Make a line math**: press `Ctrl+M`, click the `Tx` / `∑` button next to the line, or start the line with `$$`.
- **Math inside normal text**: put it between dollar signs: `the area is $pi r^2$`.
- **Line up a derivation**: start a math line with `=` and it lines up under the `=` of the line above.
- **Text formatting**: `# Heading`, `- bullet`, `1. numbered`, `**bold**`, `==highlight==`, and labels like `Definition:`, `Theorem:`, `Proof:`.
- **Escape hatch**: anything starting with `\` goes to LaTeX unchanged (e.g. `\mathcal{L}`). Put words in quotes to keep them as words: `"area" = l w`.
- **Moving notes between the web and Windows versions**: Export → *Back up all notes* saves one `.json` file; *Import notes…* loads it on the other side.

The "How to type math" panel in the app lists every supported pattern with a live preview.

### Rules worth knowing

Plain text can be ambiguous, so a few conventions decide things:

- A space ends a fraction: `1/2x` is 1⁄(2x), `1/2 x` is ½·x.
- An exponent takes one item: `e^2x` is e²·x; write `e^(2x)` for the whole exponent.
- In sums and integrals, add `of` after an upper limit that has an operator in it: `sum i=0 to n-1 of x_i`.
- Parentheses around a whole numerator, denominator or exponent are dropped in the output: `(x+1)/(x-1)` shows no brackets.

## Project layout

```
src/app.html        the app: editor, notes list, cheat sheet, export (template with build placeholders)
src/mathparse.js    the plain-text -> LaTeX translator (no dependencies, also works in Node)
main.js             Electron entry point for the Windows app
scripts/build.js    fills the template and writes docs/index.html (web) and app/ (desktop)
test/               translator tests (npm test)
build/              app icon (.ico / .png)
docs/index.html     prebuilt web version, ready for GitHub Pages
.github/workflows/  builds the Windows installer on GitHub's servers
```

Math is rendered with [MathJax](https://www.mathjax.org/) (SVG output). The desktop build bundles MathJax and the fonts (Source Serif 4, IBM Plex Sans, JetBrains Mono) so it works with no internet.

## Run it yourself

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
npm install
npm test          # check the translator
npm start         # open the desktop app in a window
npm run build     # rebuild docs/index.html and app/ after editing src/
```

### Build the Windows installer

On Windows:

```bash
npm run dist      # writes release/Mathpad-Setup-1.0.0.exe
```

Building on macOS or Linux also works, but you have to install [Wine](https://www.winehq.org/) first (32-bit support included).

**Or let GitHub build it for you.** This repo includes `.github/workflows/build-windows.yml`. After you push to GitHub:

- Go to the **Actions** tab → *Build Windows installer* → **Run workflow**. When it finishes, the `.exe` is under **Artifacts** on that run.
- Or push a version tag (`git tag v1.0.1 && git push --tags`). The installer is then attached to a GitHub Release automatically.

To change the version number, edit `"version"` in `package.json`.

## About the Windows security warning

The installer isn't code-signed (signing certificates cost money each year), so the first time it runs Windows shows **"Windows protected your PC"**. Click **More info → Run anyway**. Anyone you share the installer with will see the same warning.

## Where notes are stored

- **Windows app**: in the app's local storage under `%APPDATA%\Mathpad`. Uninstalling keeps your notes.
- **Web app**: in your browser's local storage for that site. Clearing site data deletes them, so use *Back up all notes* now and then.

Nothing is sent to a server in either version.

## License

MIT. See `LICENSE`.
