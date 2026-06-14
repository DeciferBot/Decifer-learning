'use client'

import { useEffect } from 'react'
import { useKTX2 } from '@react-three/drei'
import type * as THREE from 'three'
import { applyTextureQuality } from './textureQuality'

// DB stores texture filenames like 'earth.jpg' / 'saturn-rings.png'. The KTX2
// build lives at /textures/ktx2/<name>.ktx2 (see scripts/convert-textures-ktx2.sh).
export function ktx2Path(textureFile: string): string {
  const base = textureFile.replace(/\.[^.]+$/, '')
  return `/textures/ktx2/${base}.ktx2`
}

/**
 * Loads a KTX2 (Basis/UASTC) texture for an explorer. KTX2 transcodes to a
 * GPU-native compressed format with mipmaps — far less GPU memory than raw JPEG,
 * and crisp at distance. The Basis transcoder is served locally from /basis/ so
 * it works offline (PWA). KTX2 files self-describe sRGB; we just tune anisotropy.
 */
export function useExploreTexture(textureFile: string): THREE.Texture {
  const tex = useKTX2(ktx2Path(textureFile), '/basis/') as THREE.Texture
  useEffect(() => { applyTextureQuality(tex) }, [tex])
  return tex
}
