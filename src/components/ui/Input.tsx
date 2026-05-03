interface InputProps {
  label?:    string
  value:     string
  onChange:  (v: string) => void
  type?:     string
  error?:    string
  disabled?: boolean
}

export function Input({ label, value, onChange, type = 'text', error, disabled }: InputProps) {
  const hasValue = value.length > 0
  return (
    <div className="relative pt-5">
      {label && (
        <label
          className={`absolute left-0 transition-all duration-200 pointer-events-none ${
            hasValue
              ? 'top-0 text-caption-3 text-brand-500'
              : 'top-5 text-regular text-contentLight-secondary dark:text-content-secondary'
          }`}
        >
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full bg-transparent border-b py-2 text-regular outline-none ${
          error
            ? 'border-status-danger'
            : 'border-stroke-light dark:border-stroke-dark focus:border-brand-500'
        } text-contentLight-primary dark:text-content-primary`}
      />
      {error && (
        <span className="text-caption-2 text-status-danger mt-1 block">{error}</span>
      )}
    </div>
  )
}
