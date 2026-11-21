export interface RecoveryBannerProps {
  /** Why the stored data could not be used. */
  message: string;
  /** False when there is no raw text to back up (e.g. storage could not be read). */
  hasRaw: boolean;
  onDownloadRaw(): void;
  onReplaceWithDemo(): void;
}

export function RecoveryBanner({ message, hasRaw, onDownloadRaw, onReplaceWithDemo }: RecoveryBannerProps): JSX.Element {
  function handleReplace(): void {
    const ok = window.confirm(
      'Replace the stored data with demo data? The current stored data will be overwritten. Download a raw backup first if you may need it.',
    );
    if (ok) onReplaceWithDemo();
  }

  return (
    <div className="banner banner-warning" role="alert">
      <span>
        Your saved data could not be used, so nothing has been overwritten. ({message})
      </span>
      <div className="form-actions">
        <button type="button" className="btn btn-small" onClick={onDownloadRaw} disabled={!hasRaw}>
          Download raw backup
        </button>
        <button type="button" className="btn btn-small" onClick={handleReplace}>
          Replace with demo data
        </button>
      </div>
    </div>
  );
}
