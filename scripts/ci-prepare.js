// Used by the GitHub release workflow before building.
//   node scripts/ci-prepare.js <run number> <github owner> <repo name>
// 1. Gives every build a new, higher version: major.minor from package.json + the
//    workflow run number (1.1.0 -> 1.1.7 on run 7). The updater only installs
//    versions higher than the one you have.
// 2. Tells electron-builder to publish to this repo's GitHub Releases, which also
//    bakes the repo's address into the app so installed copies know where to look.
const fs = require('fs');
const path = require('path');

const [run, owner, repo] = process.argv.slice(2);
if (!run || !owner || !repo) throw new Error('usage: node scripts/ci-prepare.js <run number> <owner> <repo>');

const file = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
const [major, minor] = pkg.version.split('.');
pkg.version = `${major}.${minor}.${run}`;
pkg.build.publish = { provider: 'github', owner, repo, releaseType: 'release' };
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Building Mathpad ${pkg.version} for github.com/${owner}/${repo}`);
