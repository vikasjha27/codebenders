/** CSS spinner shown while data is loading. */
export function Spinner(): JSX.Element {
  return (
    <div className="spinner-wrap">
      <div className="spinner" role="status" aria-label="Loading" />
    </div>
  );
}
