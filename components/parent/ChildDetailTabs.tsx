'use client'

import { useState, useEffect } from 'react'

export type TabId = 'overview' | 'curriculum' | 'activity' | 'settings'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview',   label: 'Overview'   },
  { id: 'curriculum', label: 'Curriculum' },
  { id: 'activity',   label: 'Activity'   },
  { id: 'settings',   label: 'Settings'   },
]

interface Props {
  children: (activeTab: TabId) => React.ReactNode
  defaultTab?: TabId
}

export function ChildDetailTabs({ children, defaultTab = 'overview' }: Props) {
  const [active, setActive] = useState<TabId>(defaultTab)

  // Sync with ?tab= query param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab') as TabId | null
    if (tab && TABS.some((t) => t.id === tab)) setActive(tab)
  }, [])

  return (
    <div>
      {/* Tab bar — sticky, scrollable on mobile */}
      <div className="sticky top-0 z-10 -mx-4 mb-5 bg-background px-4 pt-1 pb-0 sm:-mx-6 sm:px-6">
        <div
          role="tablist"
          aria-label="Report sections"
          className="flex gap-1 overflow-x-auto border-b border-black/8 pb-0 scrollbar-none"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => setActive(tab.id)}
              className={[
                'flex-none whitespace-nowrap px-4 py-2.5 text-sm font-semibold transition-colors',
                'border-b-2 -mb-px min-h-[44px]',
                active === tab.id
                  ? 'border-maths text-maths'
                  : 'border-transparent text-muted hover:text-ink',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Panel */}
      <div
        role="tabpanel"
        id={`tabpanel-${active}`}
        aria-labelledby={`tab-${active}`}
        tabIndex={0}
      >
        {children(active)}
      </div>
    </div>
  )
}
