import {
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react'

type IconName = 'close' | 'download' | 'plane' | 'lock' | 'image' | 'progress'
const paths: Record<IconName, string> = {
  close: 'M6 6l12 12M6 18 18 6',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  plane: 'M10 21v-7l-7 3v-3l7-5V4a2 2 0 0 1 4 0v5l7 5v3l-7-3v7l-2-1-2 1Z',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5ZM12 14v3',
  image: 'M3 3h18v18H3ZM3 16l6-6 12 11M14 8h.01',
  progress: 'M20 12a8 8 0 1 1-8-8',
}

export function ActionIcon({ name }: { name: IconName }) {
  return (
    <svg className="action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={paths[name]} />
    </svg>
  )
}

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  icon: IconName
  tooltip?: string
  children?: ReactNode
  ref?: Ref<HTMLButtonElement>
}

export default function ActionButton({
  label,
  icon,
  children,
  tooltip = children ? undefined : label,
  className = '',
  disabled,
  onFocus,
  onBlur,
  onClick,
  ...props
}: ActionButtonProps) {
  const tooltipId = useId()
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const showTooltip = Boolean(tooltip) && !disabled && (focused || hovered) && !dismissed
  useEffect(() => {
    if (!showTooltip) return
    function dismiss(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setDismissed(true)
    }
    document.addEventListener('keydown', dismiss, true)
    return () => document.removeEventListener('keydown', dismiss, true)
  }, [showTooltip])
  return (
    <span
      className="action-control"
      onMouseEnter={() => {
        setHovered(true)
        setDismissed(false)
      }}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        {...props}
        type={props.type ?? 'button'}
        className={`button action-button ${children ? '' : 'action-button--icon'} ${className}`}
        aria-label={label}
        aria-describedby={
          [props['aria-describedby'], showTooltip ? tooltipId : null].filter(Boolean).join(' ') ||
          undefined
        }
        disabled={disabled}
        onClick={(event) => {
          setDismissed(true)
          onClick?.(event)
        }}
        onFocus={(event) => {
          setFocused(true)
          setDismissed(false)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setFocused(false)
          onBlur?.(event)
        }}
      >
        <ActionIcon name={icon} />
        {children}
      </button>
      {showTooltip && (
        <span id={tooltipId} role="tooltip" className="action-tooltip">
          {tooltip}
        </span>
      )}
    </span>
  )
}

export function PanelCloseButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <ActionButton label={label} icon="close" className="panel-close" onClick={onClick} />
}
