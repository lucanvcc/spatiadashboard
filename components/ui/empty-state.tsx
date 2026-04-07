import { type LucideIcon } from "lucide-react"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-3">
      {Icon && <Icon size={24} strokeWidth={1} className="text-muted-foreground/40" />}
      <div className="space-y-1">
        <p className="text-sm text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground max-w-xs">{description}</p>
        )}
      </div>
      {action && (
        action.href ? (
          <a
            href={action.href}
            className="spatia-label text-xs border border-border px-3 py-1.5 hover:bg-accent transition-colors"
          >
            {action.label}
          </a>
        ) : (
          <button
            onClick={action.onClick}
            className="spatia-label text-xs border border-border px-3 py-1.5 hover:bg-accent transition-colors"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  )
}
