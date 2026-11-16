// Builds the two versions of Mathpad from src/:
//   app/index.html   - desktop (Electron) version: MathJax and fonts bundled, works offline
//   docs/index.html  - web version for GitHub Pages: MathJax and fonts load from CDNs
//
// Usage: node scripts/build.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), s); };
const copy = (from, to) => { fs.mkdirSync(path.dirname(path.join(root, to)), { recursive: true }); fs.copyFileSync(path.join(root, from), path.join(root, to)); };

const template = read('src/app.html');
const parser = read('src/mathparse.js');
if (!template.includes('/*MATHPARSE*/') || !template.includes('<!--FONTS-->') || !template.includes('MATHJAX_URL')) {
  throw new Error('src/app.html is missing a build placeholder (/*MATHPARSE*/, <!--FONTS-->, or MATHJAX_URL)');
}
// function replacer so "$" sequences in the parser source are inserted literally
const html = template.replace('/*MATHPARSE*/', () => parser);

// ---------- web version (GitHub Pages) ----------
const GOOGLE_FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&display=swap" rel="stylesheet">`;
const MATHJAX_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.js';
write('docs/index.html', html.replace('<!--FONTS-->', () => GOOGLE_FONTS).replace('MATHJAX_URL', MATHJAX_CDN));

// ---------- desktop version (Electron) ----------
const desktopHead = '<link rel="stylesheet" href="vendor/fonts/fonts.css">\n<script>window.MATHPAD_DESKTOP = true;</script>';
write('app/index.html', html.replace('<!--FONTS-->', () => desktopHead).replace('MATHJAX_URL', 'vendor/tex-svg.js'));
copy('node_modules/mathjax/es5/tex-svg.js', 'app/vendor/tex-svg.js');
copy('build/icon.png', 'app/icon.png');

const fonts = [
  ['Source Serif 4', 'source-serif-4', [[400, 'normal'], [600, 'normal'], [700, 'normal'], [400, 'italic']]],
  ['IBM Plex Sans', 'ibm-plex-sans', [[400, 'normal'], [500, 'normal'], [600, 'normal']]],
  ['JetBrains Mono', 'jetbrains-mono', [[400, 'normal'], [500, 'normal']]],
];
const css = [];
for (const [family, slug, weights] of fonts) {
  for (const [weight, style] of weights) {
    const file = `${slug}-latin-${weight}-${style}.woff2`;
    copy(`node_modules/@fontsource/${slug}/files/${file}`, `app/vendor/fonts/${file}`);
    css.push(`@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;src:url(${file}) format('woff2')}`);
  }
}
write('app/vendor/fonts/fonts.css', css.join('\n') + '\n');

console.log('Built docs/index.html (web) and app/ (desktop).');
