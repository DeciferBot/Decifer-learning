import { CheckersGame } from '@/components/games/CheckersGame'

export const metadata = { title: 'Checkers · Downtime' }

export default function DowntimeCheckersPage() {
  return <CheckersGame backHref="/downtime" />
}
