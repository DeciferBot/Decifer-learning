#!/usr/bin/env bash
# Encode the equirectangular planet/globe textures to KTX2 (UASTC + mipmaps).
# UASTC keeps quality high for surfaces you zoom into; RDO + zstd keep file size
# down; on-GPU it transcodes to ASTC/BC7 — a big GPU-memory win over raw JPEG.
# Requires: basis_universal (`brew install basis_universal`).
# Run: bash scripts/convert-textures-ktx2.sh
set -euo pipefail

SRC_DIR="public/textures"
OUT_DIR="public/textures/ktx2"
mkdir -p "$OUT_DIR"

command -v basisu >/dev/null 2>&1 || { echo "basisu not found — brew install basis_universal"; exit 1; }

shopt -s nullglob
for f in "$SRC_DIR"/*.jpg "$SRC_DIR"/*.png; do
  name="$(basename "${f%.*}")"
  out="$OUT_DIR/$name.ktx2"
  echo "→ $name"
  basisu -ktx2 -uastc -uastc_level 2 -uastc_rdo_l 1.0 -mipmap -y_flip \
    -output_file "$out" "$f" >/dev/null
done

echo "Done. Output:"
ls -lh "$OUT_DIR"
