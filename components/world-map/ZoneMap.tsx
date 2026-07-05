'use client'

import Link from 'next/link'
import { TopicNode, NODE_CIRCLE, type NodeState } from './TopicNode'
import { Leaf, TreePine, Mountain, Hexagon, ScrollText, Flame, MapFold, FlagCheckered, Swords } from '@/components/ui/icons'
import type { ComponentType, SVGProps } from 'react'

type IconType = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

export type ZoneNode = {
  id: string
  topicId: string
  topicTitle: string
  state: NodeState
  href: string
  quizOptional?: boolean
  chapterCount?: number
}

type Props = {
  zoneId: string
  zoneName: string
  subjectName: string
  theme: string | null
  subjectColor: string
  nodes: ZoneNode[]
  allCompleted: boolean
  checkpointTopicId?: string | null
}

const THEME_ICON: Record<string, IconType> = {
  jungle:   Leaf,
  woodland: TreePine,
  cave:     Mountain,
  crystal:  Hexagon,
  library:  ScrollText,
  forge:    Flame,
}

// Serpentine path layout: 3 nodes per row, alternating direction, fixed row
// rhythm. Guarantees no label/circle collisions at 375px and no dead space —
// each row reserves exactly the height a node needs (64px circle + 2-line
// label + chapter chip).
const ROW_H = 136
const PAD_TOP = 8
const NODES_PER_ROW = 3
const X_FOR_COUNT: Record<number, number[]> = {
  1: [50],
  2: [28, 72],
  3: [16, 50, 84],
}

type PlacedNode = { node: ZoneNode; xPct: number; yPx: number }

function layoutNodes(nodes: ZoneNode[]): PlacedNode[] {
  const placed: PlacedNode[] = []
  for (let start = 0; start < nodes.length; start += NODES_PER_ROW) {
    const row = nodes.slice(start, start + NODES_PER_ROW)
    const rowIndex = start / NODES_PER_ROW
    const xs = X_FOR_COUNT[row.length] ?? X_FOR_COUNT[3]
    row.forEach((node, col) => {
      const xIndex = rowIndex % 2 === 1 ? row.length - 1 - col : col
      placed.push({ node, xPct: xs[xIndex], yPx: PAD_TOP + rowIndex * ROW_H })
    })
  }
  return placed
}

export function ZoneMap({ zoneId, zoneName, subjectName, theme, subjectColor, nodes, allCompleted, checkpointTopicId }: Props) {
  const ThemeIcon: IconType = theme ? (THEME_ICON[theme] ?? MapFold) : MapFold
  const completedCount = nodes.filter((n) => n.state === 'completed').length
  const placed = layoutNodes(nodes)
  const rowCount = Math.ceil(nodes.length / NODES_PER_ROW)
  const height = PAD_TOP + rowCount * ROW_H

  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-surface shadow-sm">
      {/* Zone header */}
      <div className="flex items-center gap-3 px-5 pb-3 pt-4">
        <span
          className="flex h-10 w-10 flex-none items-center justify-center rounded-xl"
          style={{ backgroundColor: `${subjectColor}24` }}
          aria-hidden
        >
          <ThemeIcon size={20} style={{ color: subjectColor }} />
        </span>
        <div>
          <h3 className="font-heading text-base font-bold leading-tight text-ink">{zoneName}</h3>
          <p className="text-xs font-semibold text-ink-2">{subjectName}</p>
        </div>
      </div>

      {/* Node canvas */}
      {placed.length > 0 && (
        <div
          className="relative mx-5"
          style={{ height }}
          role="region"
          aria-label={`${zoneName} topic map`}
        >
          {/* Adventure trail connecting consecutive topics */}
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            {placed.slice(0, -1).map((from, i) => {
              const to = placed[i + 1]
              const walked = from.node.state === 'completed'
              return (
                <line
                  key={from.node.id}
                  x1={`${from.xPct}%`}
                  y1={from.yPx + NODE_CIRCLE / 2}
                  x2={`${to.xPct}%`}
                  y2={to.yPx + NODE_CIRCLE / 2}
                  stroke={walked ? subjectColor : '#D7DBE2'}
                  strokeOpacity={walked ? 0.55 : 1}
                  strokeWidth={3}
                  strokeDasharray="0.5 9"
                  strokeLinecap="round"
                />
              )
            })}
          </svg>
          {placed.map(({ node, xPct, yPx }) => (
            <TopicNode
              key={node.id}
              title={node.topicTitle}
              state={node.state}
              href={node.href}
              subjectColor={subjectColor}
              xPct={xPct}
              yPx={yPx}
              quizOptional={node.quizOptional}
              chapterCount={node.chapterCount}
            />
          ))}
        </div>
      )}

      {/* Checkpoint banner */}
      {checkpointTopicId && !allCompleted && (
        <div
          className="mx-5 mb-3 mt-2 rounded-xl p-4"
          style={{ backgroundColor: `${subjectColor}14`, border: `2px solid ${subjectColor}` }}
        >
          <p className="flex items-center gap-2 font-heading font-bold text-ink">
            <FlagCheckered size={18} style={{ color: subjectColor }} /> Zone Checkpoint!
          </p>
          <p className="mt-1 text-sm text-muted">Great progress! 3 quick questions to check you&apos;re on track.</p>
          <Link
            href={`/topics/${checkpointTopicId}/checkpoint`}
            className="mt-3 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand-600 px-6 py-2 font-heading font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Take Checkpoint →
          </Link>
        </div>
      )}

      {/* Guardian banner */}
      {allCompleted && (
        <div className="mx-5 mb-4 mt-2 rounded-xl border-2 border-lightning bg-lightning/15 p-4 text-center">
          <p className="flex items-center justify-center gap-2 font-heading font-bold text-ink">
            <Swords size={18} className="text-points-gold-700" /> Zone Guardian Awakens!
          </p>
          <p className="mt-1 text-sm text-muted">All topics complete. Face the guardian!</p>
          <Link
            href={`/guardian/${zoneId}`}
            className="mt-3 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand-600 px-6 py-2 font-heading font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Battle Guardian →
          </Link>
        </div>
      )}

      {/* Progress footer */}
      <div className="px-5 pb-4 pt-3">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs text-muted">{completedCount} / {nodes.length} topic{nodes.length !== 1 ? 's' : ''} complete</p>
          <p className="text-xs font-bold text-ink-2">
            {nodes.length > 0 ? Math.round((completedCount / nodes.length) * 100) : 0}%
          </p>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-black/8"
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={nodes.length}
          aria-label={`${zoneName} progress: ${completedCount} of ${nodes.length} topics complete`}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${nodes.length > 0 ? (completedCount / nodes.length) * 100 : 0}%`, backgroundColor: subjectColor }}
            aria-hidden
          />
        </div>
      </div>
    </div>
  )
}
