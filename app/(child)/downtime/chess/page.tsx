import { ChessGame } from '@/components/games/ChessGame'

export const metadata = { title: 'Chess · Downtime' }

export default function DowntimeChessPage() {
  return <ChessGame backHref="/downtime" />
}
