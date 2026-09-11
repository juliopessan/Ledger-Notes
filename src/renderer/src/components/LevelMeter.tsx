const SEGMENTS = 24

/**
 * Medidor de nível do áudio que está sendo capturado. Cada segmento aceso
 * corresponde ao RMS real do sinal — é medição, não enfeite: se nada acender,
 * nada está sendo gravado.
 */
export default function LevelMeter({ level }: { level: number }): JSX.Element {
  const active = Math.round(level * SEGMENTS)

  return (
    <div className="level-meter" role="meter" aria-label="Nível do áudio capturado">
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span key={i} className={`level-seg ${i < active ? 'on' : ''}`} />
      ))}
    </div>
  )
}
