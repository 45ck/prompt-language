export default function ProofBar() {
  return (
    <section
      aria-label="Social proof bar"
      style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        padding: '1.25rem 0',
      }}
    >
      <div
        className="container-default"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2rem',
        }}
      >
        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.8125rem',
            fontWeight: 500,
          }}
        >
          Trusted by <strong style={{ color: 'var(--text-secondary)' }}>12,000+</strong> knowledge
          workers
        </span>

        <div
          aria-hidden="true"
          style={{ width: '1px', height: '1.25rem', background: 'var(--border)' }}
        />

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.5rem',
            alignItems: 'center',
          }}
        >
          {['Ness Labs', 'Hacker News', 'The Pragmatic Programmer', 'Morning Brew Tech'].map(
            (pub) => (
              <span
                key={pub}
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                {pub}
              </span>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
