'use client'

import { createContext, useContext, useRef, type ReactNode } from 'react'
import * as THREE from 'three'

export interface RegisteredBody {
  pos: THREE.Vector3
  radius: number
}

interface BodiesApi {
  bodies: React.MutableRefObject<Map<string, RegisteredBody>>
  register: (key: string, radius: number) => THREE.Vector3
  unregister: (key: string) => void
}

const BodiesContext = createContext<BodiesApi | null>(null)

/**
 * Shared registry of focusable body positions. Scene objects (e.g. planets)
 * register a live Vector3 they mutate each frame; the camera rig reads it to
 * fly-to-focus. Both producers and the rig live inside the same <Canvas>, so
 * React context resolves normally (no r3f context bridge needed).
 */
export function BodiesProvider({ children }: { children: ReactNode }) {
  const bodies = useRef<Map<string, RegisteredBody>>(new Map())

  const register = (key: string, radius: number) => {
    const existing = bodies.current.get(key)
    if (existing) {
      existing.radius = radius
      return existing.pos
    }
    const pos = new THREE.Vector3()
    bodies.current.set(key, { pos, radius })
    return pos
  }

  const unregister = (key: string) => {
    bodies.current.delete(key)
  }

  return (
    <BodiesContext.Provider value={{ bodies, register, unregister }}>
      {children}
    </BodiesContext.Provider>
  )
}

export function useBodies(): BodiesApi {
  const ctx = useContext(BodiesContext)
  if (!ctx) throw new Error('useBodies must be used within <BodiesProvider>')
  return ctx
}
