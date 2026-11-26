"""Deterministic source/site release; explicit allowlist excludes credentials and local data."""
import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parents[1]
version = json.loads((ROOT / 'package.json').read_text())['version']
files = {
    'index.html', 'cinema.css', 'cinema.js', 'addon-engine.js', 'platform-core.js',
    'platform-ui.js', 'sw.js', 'version.json', 'manifest.json', 'icon.svg',
    'README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'ROADMAP.md', 'LICENSE-DECISION.md',
    'package.json', 'package-lock.json', 'playwright.config.cjs',
    'worker/worker.js', 'worker/sync.mjs', 'worker/wrangler.toml', 'worker/README.md',
    'worker/migrations/0001_private_sync.sql', 'scripts/vendor-hls.cjs',
    'scripts/package-release.py', 'tests/check-syntax.cjs',
}
for folder, suffixes in [('assets', {'.jpg', '.png', '.svg', '.js', '.txt', '.md'}),
                         ('docs', {'.md'}), ('tests', {'.cjs', '.webm'})]:
    files.update(str(p.relative_to(ROOT)) for p in (ROOT / folder).rglob('*')
                 if p.is_file() and not p.is_symlink() and p.suffix in suffixes)
if (ROOT / 'LICENSE').is_file():
    files.add('LICENSE')
output = ROOT / 'release'
output.mkdir(exist_ok=True)
archive = output / f'streameo-{version}.tar.gz'
with archive.open('wb') as raw:
    with gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w', format=tarfile.PAX_FORMAT) as tar:
            for name in sorted(files):
                path = ROOT / name
                if path.is_symlink():
                    raise ValueError(f'Symlink not allowed: {name}')
                data = path.read_bytes()
                info = tarfile.TarInfo(f'streameo-{version}/{name}')
                info.size, info.mtime, info.uid, info.gid = len(data), 0, 0, 0
                info.mode, info.uname, info.gname = 0o644, '', ''
                tar.addfile(info, io.BytesIO(data))
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(output / 'SHA256SUMS').write_text(f'{digest}  {archive.name}\n')
print(f'{archive.relative_to(ROOT)}\nSHA-256: {digest}')
