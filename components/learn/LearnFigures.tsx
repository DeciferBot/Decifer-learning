export interface LearnFigure {
  url: string
  alt?: string
  caption?: string
}

interface Props {
  images: LearnFigure[]
}

/**
 * Raster figure block for Learn pages — the escape hatch for photos and rich
 * illustrations the inline-SVG diagram registry can't cover. Mirrors the
 * foundation_images render in QuizShell; URLs point at Supabase Storage and are
 * cached by the service worker (see next.config.js runtimeCaching) so figures
 * survive offline.
 *
 * SVG-first: prefer a `diagram` widget where possible; reach for this only for
 * genuine photography / complex artwork.
 */
export function LearnFigures({ images }: Props) {
  if (!images?.length) return null

  return (
    <div className="rounded-2xl border border-black/5 bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        {images.map((img, i) => (
          <figure key={i} className="m-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a build asset */}
            <img
              src={img.url}
              alt={img.alt ?? 'Lesson illustration'}
              loading="lazy"
              decoding="async"
              className="mx-auto w-full rounded-xl border border-black/8 object-contain"
              style={{ maxHeight: 320 }}
            />
            {img.caption && (
              <figcaption className="mt-2 text-center text-sm text-muted">{img.caption}</figcaption>
            )}
          </figure>
        ))}
      </div>
    </div>
  )
}
