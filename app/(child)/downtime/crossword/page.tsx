import { CrosswordGame } from '@/components/games/CrosswordGame'

export const metadata = { title: 'Crossword · Downtime' }

export default function DowntimeCrosswordPage() {
  return <CrosswordGame backHref="/downtime" />
}
