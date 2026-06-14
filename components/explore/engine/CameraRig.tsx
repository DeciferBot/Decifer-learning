'use client'

import { useEffect, useRef, type MutableRefObject } from 'react'
import { CameraControls } from '@react-three/drei'
import CameraControlsImpl from 'camera-controls'
import * as THREE from 'three'
import { useBodies } from './focusContext'

export interface CameraApi {
  /** Dolly in (positive) / out (negative) — used by the +/- accessibility buttons. */
  dolly: (delta: number) => void
  /** Return to the wide overview shot. */
  reset: () => void
}

interface CameraRigProps {
  focusKey: string | null
  overview: [number, number, number]
  minDistance: number
  maxDistance: number
  reducedMotion: boolean
  /** 'orbit' frames a free-floating body (planets); 'surface' frames a point on
   *  a globe by pulling the camera straight out along the surface normal. */
  framing?: 'orbit' | 'surface'
  apiRef?: MutableRefObject<CameraApi | null>
}

// 3/4 viewing direction used when framing a focused body (orbit mode).
const FRAME_DIR = new THREE.Vector3(0.45, 0.45, 1).normalize()

/**
 * The camera IS the interface. drei <CameraControls> (yomotsu/camera-controls)
 * gives native one-finger orbit + two-finger pinch/pan with damping on touch.
 * On focus change we smoothly fly to frame the selected body, biasing it toward
 * the upper part of the screen so the info sheet never covers it.
 */
export function CameraRig({
  focusKey,
  overview,
  minDistance,
  maxDistance,
  reducedMotion,
  framing = 'orbit',
  apiRef,
}: CameraRigProps) {
  const controlsRef = useRef<CameraControlsImpl | null>(null)
  const initialised = useRef(false)

  // One-time control configuration.
  useEffect(() => {
    const c = controlsRef.current
    if (!c) return
    c.minDistance = minDistance
    c.maxDistance = maxDistance
    c.dollyToCursor = false
    c.smoothTime = 0.4
    c.draggingSmoothTime = 0.18
    // Two-finger gesture = zoom (dolly). Keep orbit on one finger. No truck so
    // kids can't lose the scene off-screen.
    c.touches.two = CameraControlsImpl.ACTION.TOUCH_DOLLY
    c.touches.three = CameraControlsImpl.ACTION.TOUCH_DOLLY
    c.mouseButtons.right = CameraControlsImpl.ACTION.NONE
    if (!initialised.current) {
      c.setLookAt(overview[0], overview[1], overview[2], 0, 0, 0, false)
      initialised.current = true
    }
  }, [minDistance, maxDistance, overview])

  // Expose a small imperative API for the on-screen zoom buttons.
  useEffect(() => {
    if (!apiRef) return
    apiRef.current = {
      dolly: (delta: number) => controlsRef.current?.dolly(delta, !reducedMotion),
      reset: () => {
        const c = controlsRef.current
        if (!c) return
        c.setLookAt(overview[0], overview[1], overview[2], 0, 0, 0, !reducedMotion)
      },
    }
  }, [apiRef, overview, reducedMotion])

  const { bodies } = useBodies()

  // Fly to focus whenever the selected body changes.
  useEffect(() => {
    const c = controlsRef.current
    if (!c) return
    const transition = !reducedMotion

    if (!focusKey) {
      c.setLookAt(overview[0], overview[1], overview[2], 0, 0, 0, transition)
      return
    }

    const body = bodies.current.get(focusKey)
    if (!body) return

    if (framing === 'surface') {
      // Globe: pull the camera straight out along the point's surface normal so
      // the focused country faces us, biased high so the sheet doesn't cover it.
      const dir = body.pos.clone().normalize()
      const camDist = Math.max(body.pos.length() + 3.2, 5.5)
      const camPos = dir.multiplyScalar(camDist)
      c.setLookAt(camPos.x, camPos.y, camPos.z, body.pos.x, body.pos.y - 0.45, body.pos.z, transition)
      return
    }

    const dist = THREE.MathUtils.clamp(body.radius * 7, 6, 45)
    const camPos = body.pos.clone().add(FRAME_DIR.clone().multiplyScalar(dist))
    // Aim slightly below the body so it sits high on screen, above the sheet.
    const lookY = body.pos.y - dist * 0.22
    c.setLookAt(camPos.x, camPos.y, camPos.z, body.pos.x, lookY, body.pos.z, transition)
  }, [focusKey, overview, reducedMotion, bodies, framing])

  return <CameraControls ref={controlsRef} makeDefault />
}
