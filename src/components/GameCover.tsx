import { useEffect, useMemo, useState } from 'react'
import type { Game } from '../lib/models'
import { useArenaStore } from '../state/arenaStore'

const GRADIENTS = [
  'from-indigo-500 to-fuchsia-500',
  'from-emerald-500 to-teal-500',
  'from-sky-500 to-indigo-500',
  'from-amber-500 to-rose-500',
  'from-violet-500 to-cyan-500',
  'from-lime-500 to-emerald-500',
  'from-rose-500 to-violet-500',
  'from-orange-500 to-amber-500',
]

export function GameCover({ game, className }: { game: Game; className?: string }) {
  const [failed, setFailed] = useState(false)
  const gradient = GRADIENTS[hash(game.id) % GRADIENTS.length]

  const customCover = useArenaStore((s) => s.customGameCovers[game.id] ?? '')

  const coverUrl = useMemo(() => {
    if (customCover) return customCover
    const base = import.meta.env.BASE_URL || '/'
    const normalized = base.endsWith('/') ? base : `${base}/`
    return `${normalized}covers/${encodeURIComponent(game.id)}.svg`
  }, [customCover, game.id])

  useEffect(() => {
    setFailed(false)
  }, [coverUrl])

  return (
    <div
      className={[
        'relative aspect-[3/4] w-full overflow-hidden rounded-xl',
        'ring-1 ring-white/10',
        className ?? '',
      ].join(' ')}
    >
      {!failed ? (
        <img
          src={coverUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
          draggable={false}
        />
      ) : (
        <div className={['absolute inset-0 bg-gradient-to-br', gradient].join(' ')} />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-end p-3">
        <div className="text-sm font-semibold leading-snug text-white drop-shadow">{game.name}</div>
        {game.genres?.length ? <div className="mt-1 text-[11px] text-white/80">{game.genres[0]}</div> : null}
      </div>
    </div>
  )
}

function hash(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}
