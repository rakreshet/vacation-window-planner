import { createContext, useContext, useEffect, useId, type ReactNode } from 'react'

export type FieldProblem = { message: string; fields: string[] }
const ValidationContext = createContext<{ prefix: string; problem: FieldProblem | null }>({
  prefix: '',
  problem: null,
})

function target(prefix: string, field: string): HTMLElement | null {
  const path = field.split('.')
  while (path.length) {
    const element = document.getElementById(`${prefix}${path.join('.')}`)
    if (element) return element
    path.pop()
  }
  return null
}

export function FieldValidation({
  problem,
  children,
}: {
  problem: FieldProblem | null
  children: ReactNode
}) {
  const prefix = useId()
  useEffect(() => {
    if (problem)
      (
        target(prefix, problem.fields[0] ?? '') ?? document.getElementById(`${prefix}summary`)
      )?.focus()
  }, [prefix, problem])
  return (
    <ValidationContext.Provider value={{ prefix, problem }}>
      {problem && (
        <div role="alert" tabIndex={-1} id={`${prefix}summary`}>
          <p>{problem.message}</p>
          {problem.fields.map((field, index) => (
            <a
              key={field}
              href={`#${prefix}${field}`}
              onClick={(event) => {
                event.preventDefault()
                target(prefix, field)?.focus()
              }}
            >
              Review {index + 1 === 1 ? 'affected field' : `affected field ${index + 1}`}
            </a>
          ))}
        </div>
      )}
      {children}
    </ValidationContext.Provider>
  )
}

export function useFieldValidation() {
  const { prefix, problem } = useContext(ValidationContext)
  return (field: string) => ({
    id: prefix ? `${prefix}${field}` : undefined,
    'aria-invalid': problem?.fields.includes(field) || undefined,
    'aria-describedby': problem?.fields.includes(field) ? `${prefix}${field}-error` : undefined,
  })
}

export function FieldError({ field }: { field: string }) {
  const { prefix, problem } = useContext(ValidationContext)
  return problem?.fields.includes(field) ? (
    <small id={`${prefix}${field}-error`}>{problem.message}</small>
  ) : null
}

export function FieldLink({ field, children }: { field: string; children: ReactNode }) {
  const { prefix } = useContext(ValidationContext)
  if (!prefix) return null
  return (
    <a
      href={`#${prefix}${field}`}
      onClick={(event) => {
        event.preventDefault()
        target(prefix, field)?.focus()
      }}
    >
      {children}
    </a>
  )
}
