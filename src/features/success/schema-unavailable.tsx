export function SuccessSchemaUnavailable() {
  return (
    <section className="data-surface empty-state">
      <h2>Customer Success data is unavailable</h2>
      <p>This workspace is missing the optional V13 Customer Success schema. This view will be available after that dependency is installed.</p>
    </section>
  );
}
