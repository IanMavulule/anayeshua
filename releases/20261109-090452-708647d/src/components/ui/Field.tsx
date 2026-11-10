import type { InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

type FieldProps = { id: string; label: string; hint?: ReactNode; error?: string }

function Wrapper({ id, label, hint, error, children }: FieldProps & { children: ReactNode }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}</label>
      {children}
      {hint && <span className="field__hint" id={`${id}-hint`}>{hint}</span>}
      {error && <span className="field__error" role="alert">{error}</span>}
    </div>
  )
}

export function TextField({ id, label, hint, error, ref, ...input }: FieldProps & InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return (
    <Wrapper id={id} label={label} hint={hint} error={error}>
      <input id={id} ref={ref} className="input" aria-describedby={hint ? `${id}-hint` : undefined} aria-invalid={Boolean(error)} {...input} />
    </Wrapper>
  )
}

export function TextAreaField({ id, label, hint, error, ...input }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Wrapper id={id} label={label} hint={hint} error={error}>
      <textarea id={id} className="textarea" aria-describedby={hint ? `${id}-hint` : undefined} aria-invalid={Boolean(error)} {...input} />
    </Wrapper>
  )
}

export function SelectField({ id, label, hint, error, children, ...input }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Wrapper id={id} label={label} hint={hint} error={error}>
      <select id={id} className="select" {...input}>{children}</select>
    </Wrapper>
  )
}
