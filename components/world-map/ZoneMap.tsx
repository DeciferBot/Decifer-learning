'use client'

import Link from 'next/link'
import { TopicNode, type NodeState } from './TopicNode'
import { Leaf, TreePine, Mountain, Hexagon, ScrollText, Flame, MapFold, FlagCheckered, Swords } from '@/components/ui/icons'
import type { ComponentType, SVGProps } from 'react'

type IconType = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

export type ZoneNode = {
  id: string
  topicId: string
  topicTitle: string
  state: NodeState
  href: string
  xPct: number
  yPct: number
  quizOptional?: boolean
}

type Props = {
  zoneId: string
  zoneName: string
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

// Container height gives room for nodes + labels without horizontal overflow.
const NODE_AREA_HEIGHT = 180

export function ZoneMap({ zoneId, zoneName, theme, subjectColor, nodes, allCompleted, checkpointTopicId }: Props) {
  const ThemeIcon: IconType = theme ? (THEME_ICON[theme] ?? MapFold) : MapFold
  const completedCount = nodes.filter((n) => n.state === 'completed').length

  return (
    <div
      className="overflow-hidden rounded-2xl border border-black/5 bg-surface shadow-sm"
      style={{ borderLeft: `4px solid ${subjectColor}` }}
    >
      {/* Zone header */}
      <div className="flex items-center gap-2 px-5 pb-2 pt-4">
        <ThemeIcon size={20} style={{ color: subjectColor }} aria-hidden />
        <h3 className="font-heading text-base font-bold text-ink">{zoneName}</h3>
      </div>

      {nodes.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-muted">More topics coming soon!</p>
      ) : (
        <>
          {/* Node canvas — relative container for absolute-positioned nodes */}
          <div
            className="relative mx-5"
            style={{ height: NODE_AREA_HEIGHT }}
            aria-label={`${zoneName} topic map`}
          >
            {nodes.map((node) => (
              <TopicNode
                key={node.id}
                title={node.topicTitle}
                state={node.state}
                href={node.href}
                subjectColor={subjectColor}
                xPct={node.xPct}
                yPct={node.yPct}
                quizOptional={node.quizOptional}
              />
            ))}
          </div>

          {/* Checkpoint banner — shown after every 3rd completed topic */}
          {checkpointTopicId && !allCompleted && (
            <div
              className="mx-5 mb-3 mt-1 rounded-xl p-4"
              style={{ backgroundColor: '#EEF4FF', border: '2px solid #6C9EFF' }}
            >
              <p className="flex items-center gap-2 font-heading font-bold text-ink"><FlagCheckered size={18} className="text-brand" /> Zone Checkpoint!</p>
              <p className="mt-1 text-sm text-muted">
                Great progress — 3 quick questions to check you&apos;re on track.
              </p>
              <Link
                href={`/topics/${checkpointTopicId}/checkpoint`}
                className="mt-3 inline-flex min-h-[48px] items-center justify-center rounded-xl px-6 py-2 font-heading font-bold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#6C9EFF' }}
              >
                Take Checkpoint →
              </Link>
            </div>
          )}

          {/* Guardian banner — shown when all topics complete */}
          {allCompleted && (
            <div
              className="mx-5 mb-4 mt-1 rounded-xl p-4 text-center"
              style={{ backgroundColor: '#FFF9E6', border: '2px solid #FFD43B' }}
            >
              <p className="flex items-center gap-2 font-heading font-bold text-ink"><Swords size={18} className="text-lightning" /> Zone Guardian Awakens!</p>
              <p className="mt-1 text-sm text-muted">All topics complete — face the guardian!</p>
              <Link
                href={`/guardian/${zoneId}`}
                className="mt-3 inline-flex min-h-[48px] items-center justify-center rounded-xl px-6 py-2 font-heading font-bold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: subjectColor }}
              >
                Battle Guardian →
              </Link>
            </div>
          )}

          {/* Progress footer */}
          <div className="px-5 pb-4 pt-1">
            <p className="text-xs text-muted">
              {completedCount} / {nodes.length} topic{nodes.length !== 1 ? 's' : ''} complete
            </p>
          </div>
        </>
      )}
    </div>
  )
}
