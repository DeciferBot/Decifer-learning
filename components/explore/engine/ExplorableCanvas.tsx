'use client'

import { Suspense, type ReactNode, type MutableRefObject } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, PerformanceMonitor, Loader } from '@react-three/drei'
import { BodiesProvider } from './focusContext'
import { CameraRig, type CameraApi } from './CameraRig'

interface ExplorableCanvasProps {
  background: string
  overview: [number, number, number]
  fov: number
  near: number
  far: number
  minDistance: number
  maxDistance: number
  ambientLight: number
  focusKey: string | null
  reducedMotion: boolean
  framing?: 'orbit' | 'surface'
  apiRef?: MutableRefObject<CameraApi | null>
  children: ReactNode
}

/**
 * Reusable WebGL stage for every explorer. Owns the performance + camera
 * concerns so individual scenes only describe their content:
 *  - drei CameraControls (orbit / pinch / fly-to) via <CameraRig>
 *  - PerformanceMonitor + AdaptiveDpr auto-degrade resolution on slow devices
 *  - frameloop="demand" when motion is reduced (saves battery on iPad)
 *  - <Loader> shows real texture-load progress instead of a blank screen
 */
export function ExplorableCanvas({
  background,
  overview,
  fov,
  near,
  far,
  minDistance,
  maxDistance,
  ambientLight,
  focusKey,
  reducedMotion,
  framing = 'orbit',
  apiRef,
  children,
}: ExplorableCanvasProps) {
  return (
    <>
      <Canvas
        camera={{ position: overview, fov, near, far }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        performance={{ min: 0.5 }}
        frameloop={reducedMotion ? 'demand' : 'always'}
        style={{ width: '100%', height: '100%', touchAction: 'none' }}
      >
        <color attach="background" args={[background]} />
        <ambientLight intensity={ambientLight} />
        <PerformanceMonitor />
        <AdaptiveDpr pixelated />
        <BodiesProvider>
          <Suspense fallback={null}>{children}</Suspense>
          <CameraRig
            focusKey={focusKey}
            overview={overview}
            minDistance={minDistance}
            maxDistance={maxDistance}
            reducedMotion={reducedMotion}
            framing={framing}
            apiRef={apiRef}
          />
        </BodiesProvider>
      </Canvas>
      <Loader
        containerStyles={{ background: 'transparent' }}
        innerStyles={{ background: 'rgba(255,255,255,0.15)' }}
        barStyles={{ background: 'linear-gradient(90deg, #6C9EFF, #a78bfa)' }}
        dataStyles={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}
        dataInterpolation={(p) => `Loading the cosmos… ${p.toFixed(0)}%`}
      />
    </>
  )
}
