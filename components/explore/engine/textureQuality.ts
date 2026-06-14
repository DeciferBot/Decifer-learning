import * as THREE from 'three'

/**
 * Correct colour + sharpness for colour textures. Since three r152, TextureLoader
 * textures default to a linear colour space, which makes albedo maps (planets,
 * the globe) look washed-out / dark. Mark them sRGB and raise anisotropy so they
 * stay crisp at oblique viewing angles. Idempotent.
 */
export function applyTextureQuality(map: THREE.Texture, anisotropy = 8): void {
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = anisotropy
  // KTX2/compressed textures already carry their colour space and re-uploading
  // them is wasteful (and unsupported for some formats) — only flag plain textures.
  if (!(map as unknown as { isCompressedTexture?: boolean }).isCompressedTexture) {
    map.needsUpdate = true
  }
}
