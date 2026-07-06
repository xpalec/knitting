import type { FormEvent, PropsWithChildren } from 'react'

interface SmartImageDialogProps extends PropsWithChildren {
  open: boolean
  title: string
  submitLabel?: string
  destructiveLabel?: string
  onClose: () => void
  onSubmit?: () => void
  onDestructive?: () => void
}

export function SmartImageDialog({
  open,
  title,
  submitLabel = 'Save',
  destructiveLabel,
  onClose,
  onSubmit,
  onDestructive,
  children,
}: SmartImageDialogProps) {
  if (!open) {
    return null
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit?.()
  }

  return (
    <div
      className="smart-image-dialog-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <form
        className="smart-image-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={handleSubmit}
      >
        <header className="smart-image-dialog__header">
          <h3>{title}</h3>
          <button
            type="button"
            className="smart-image-icon-button"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="smart-image-dialog__body">{children}</div>

        <footer className="smart-image-dialog__footer">
          {destructiveLabel && onDestructive ? (
            <button
              type="button"
              className="smart-image-button smart-image-button--danger"
              onClick={onDestructive}
            >
              {destructiveLabel}
            </button>
          ) : (
            <span />
          )}

          <div className="smart-image-dialog__footer-actions">
            <button
              type="button"
              className="smart-image-button"
              onClick={onClose}
            >
              Cancel
            </button>
            {onSubmit ? (
              <button
                type="submit"
                className="smart-image-button smart-image-button--primary"
              >
                {submitLabel}
              </button>
            ) : null}
          </div>
        </footer>
      </form>
    </div>
  )
}
