export interface ErrorBannerProps {
  message: string;
  onDismiss(): void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps): JSX.Element {
  return (
    <div className="banner banner-error" role="alert">
      <span>{message}</span>
      <button type="button" className="btn btn-small" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
