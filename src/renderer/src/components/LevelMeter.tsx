const SEGMENTS = 24

/**
 * Level meter for the audio being captured. Each lit segment corresponds to the
 * signal's actual RMS — it is measurement, not decoration: if nothing lights up,
 * nothing is being recorded.
 */
export default function LevelMeter({ level }: { level: number }): JSX.Element {
  const active = Math.round(level * SEGMENTS)

  return (
    <div className="level-meter" role="meter" aria-label="Captured audio level">
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span key={i} className={`level-seg ${i < active ? 'on' : ''}`} />
      ))}
    </div>
  )
}
