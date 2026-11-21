export function BusinessCard(): JSX.Element {
  return (
    <div className="card business-card">
      <h3>Why switch from WhatsApp &amp; notebooks</h3>
      <ul className="business-card-grid">
        <li>
          <strong>Cash timing</strong>
          See who owes what, how long they have owed it, and which bills fall due before the money arrives. No
          chasing from memory.
        </li>
        <li>
          <strong>Minimal effort</strong>
          About 10 minutes a week. Log payments as they come in, send reminders with one click, and the rest runs
          automatically.
        </li>
        <li>
          <strong>Solo-tutor value</strong>
          Example: one tutor with 20 students at ₹2,000 a month averages ₹40,000 in monthly fees. One avoided
          late-payment month or one missed rent cycle is worth more than the subscription.
        </li>
      </ul>
      <p className="business-card-pricing">
        <strong>Proposed pricing:</strong> Solo ₹299/month · Up to 5 tutors ₹599/month · First 30 days free.
      </p>
      <p className="muted small">Prices are proposals for validation, not yet billed.</p>
    </div>
  );
}
