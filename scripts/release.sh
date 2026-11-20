#!/usr/bin/env bash
# One command per release: build the app, stage the binaries, refresh the
# website (installer, hash, size, changelog) and upload the GitHub assets.
#
#   ./scripts/release.sh                                  # patch release of the current version
#   ./scripts/release.sh --version 2.1.0 --notes notes.md # bump and add a changelog entry
#   SKIP_UPLOAD=1 ./scripts/release.sh                    # build and sync only
#
# The site sync arguments are passed straight through to
# site/scripts/sync-release.mjs, so --version, --notes, --title and --summary
# all work here.
set -euo pipefail

export PATH="/c/Users/chasi/.cargo/bin:$PATH"

cd "$(dirname "$0")/.."

version=$(node -p "require('./src-tauri/tauri.conf.json').version")
tag=${TAG:-v$version}

echo "building Lyrica $version"
npm run tauri build

installer="src-tauri/target/release/bundle/nsis/Lyrica_${version}_x64-setup.exe"
if [ ! -f "$installer" ]; then
  echo "release: expected the installer at $installer" >&2
  exit 1
fi

cp src-tauri/target/release/lyrica.exe release/Lyrica.exe
cp "$installer" release/Lyrica-Setup.exe
echo "staged release/Lyrica.exe and release/Lyrica-Setup.exe"

# The site follows the build: same installer, new hash and size.
node site/scripts/sync-release.mjs --installer release/Lyrica-Setup.exe "$@"
(cd site && npm run build)
echo "rebuilt site/dist"

if [ "${SKIP_UPLOAD:-0}" = "1" ]; then
  echo "SKIP_UPLOAD=1, stopping before the upload"
  exit 0
fi

token=$(printf "protocol=https\nhost=github.com\n\n" | git credential fill | sed -n 's/^password=//p')
if [ -z "$token" ]; then
  echo "release: no GitHub token in the git credential helper" >&2
  exit 1
fi

repo=$(git remote get-url origin | sed -E 's#.*github\.com[:/](.+)$#\1#; s#\.git$##')
api="https://api.github.com/repos/$repo"

release_id=$(curl -fsSL -H "Authorization: Bearer $token" "$api/releases/tags/$tag" |
  node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).id")
if [ -z "$release_id" ] || [ "$release_id" = "undefined" ]; then
  echo "release: no release for $tag" >&2
  exit 1
fi

for name in Lyrica.exe Lyrica-Setup.exe; do
  # Replace the asset rather than accumulating copies of it.
  curl -fsSL -H "Authorization: Bearer $token" "$api/releases/$release_id/assets" |
    node -e '
      const assets = JSON.parse(require("fs").readFileSync(0, "utf8"));
      for (const asset of assets) if (asset.name === process.argv[1]) console.log(asset.id);
    ' "$name" |
    while read -r asset_id; do
      curl -fsSL -X DELETE -H "Authorization: Bearer $token" "$api/releases/assets/$asset_id" >/dev/null
      echo "removed old $name"
    done

  curl -fsSL --retry 3 -X POST \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/octet-stream" \
    --data-binary "@release/$name" \
    "https://uploads.github.com/repos/$repo/releases/$release_id/assets?name=$name" >/dev/null
  echo "uploaded $name"
done

curl -fsSL -H "Authorization: Bearer $token" "$api/releases/latest" |
  node -e '
    const release = JSON.parse(require("fs").readFileSync(0, "utf8"));
    for (const asset of release.assets) {
      console.log(`${asset.name.padEnd(18)} ${String(asset.size).padStart(10)}  ${asset.state}`);
    }
    console.log(`published: ${release.tag_name} · ${release.published_at}`);
  '
