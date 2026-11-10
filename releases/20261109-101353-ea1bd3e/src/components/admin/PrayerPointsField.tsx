import { useState } from 'react'
import { cleanPrayerPoints, plural } from './adminData'

type Props = {
  id: string
  label: string
  points: string[]
  onChange: (points: string[]) => void
  placeholder?: string
}

/** Pontos de oração: um por linha. As linhas vazias são descartadas ao gravar. */
export function PrayerPointsField({ id, label, points, onChange, placeholder }: Props) {
  const count = cleanPrayerPoints(points).length
  return (
    <div className="adm-field adm-prayer">
      <div className="adm-label-row">
        <label htmlFor={id}>{label}</label>
        <span className="adm-count">{count ? plural(count, 'ponto', 'pontos') : 'Opcional'}</span>
      </div>
      <textarea
        className="adm-textarea"
        id={id}
        rows={Math.min(Math.max(points.length, 3), 8)}
        placeholder={placeholder ?? 'Um ponto de oração por linha'}
        value={points.join('\n')}
        onChange={(event) => onChange(event.target.value.split('\n'))}
      />
      <p className="adm-hint">Um ponto por linha. Deixe vazio se não houver pontos de oração.</p>
    </div>
  )
}

/** Versão recolhida para cada aula: abre ao clicar ou quando já tem pontos. */
export function LessonPrayerPoints({ lessonId, points, onChange }: { lessonId: string; points: string[]; onChange: (points: string[]) => void }) {
  const count = cleanPrayerPoints(points).length
  const [open, setOpen] = useState(count > 0)
  if (!open) {
    return (
      <button className="adm-prayer-toggle" type="button" onClick={() => setOpen(true)}>
        + Pontos de oração <span>(opcional)</span>
      </button>
    )
  }
  return (
    <PrayerPointsField
      id={`pp-${lessonId}`}
      label="Pontos de oração depois desta aula"
      points={points}
      onChange={onChange}
      placeholder={'Ex.: Ore pela sua família\nAgradeça a Deus pela Sua fidelidade'}
    />
  )
}
