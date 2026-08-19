import { WordTilesGame } from '@/components/games/WordTilesGame'

export const metadata = { title: 'Word Tiles · Downtime' }

export default function DowntimeWordTilesPage() {
  return <WordTilesGame backHref="/downtime" />
}
