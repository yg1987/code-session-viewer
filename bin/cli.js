#!/usr/bin/env node
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const electronPkgDir = path.dirname(require.resolve('electron/package.json'));

/**
 * Resolve the Electron binary path. When the package's postinstall step is
 * interrupted (a common failure on slow networks — the binary is a ~150MB
 * download), `electron/path.txt` is missing and `require('electron')` throws a
 * cryptic ENOENT. Detect that here and run Electron's own installer once so the
 * CLI self-heals instead of crashing.
 */
function resolveElectron() {
  try {
    return require('electron');
  } catch (err) {
    if (err && err.code !== 'ENOENT') throw err;
    return null;
  }
}

let electron = resolveElectron();
if (!electron || !fs.existsSync(electron)) {
  console.error('Electron binary not found — finishing installation (one-time, ~150MB download)...');
  const result = spawnSync(process.execPath, [path.join(electronPkgDir, 'install.js')], {
    stdio: 'inherit',
    cwd: electronPkgDir,
  });
  if (result.status !== 0) {
    console.error(
      '\nFailed to install the Electron runtime.\n' +
        'Please check your network/proxy and run:\n' +
        `  node "${path.join(electronPkgDir, 'install.js')}"\n`
    );
    process.exit(1);
  }
  // Clear the require cache so the freshly written path.txt is picked up.
  delete require.cache[require.resolve('electron')];
  electron = resolveElectron();
  if (!electron || !fs.existsSync(electron)) {
    console.error('Electron runtime still unavailable after install. Aborting.');
    process.exit(1);
  }
}

const appPath = path.join(__dirname, '..');
const child = spawn(electron, [appPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  windowsHide: false,
});

child.on('close', (code) => process.exit(code ?? 0));
