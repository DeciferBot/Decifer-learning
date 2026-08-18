import { Connect4Game } from '@/components/games/Connect4Game'

export const metadata = { title: 'Connect 4 · Downtime' }

export default function DowntimeConnect4Page() {
  return <Connect4Game backHref="/downtime" />
}
