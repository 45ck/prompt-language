export default function CTAFooterSection() {
  return (
    <section
      aria-labelledby="cta-footer-heading"
      style={{
        position: 'relative',
        overflow: 'hidden',
        background:
          'linear-gradient(135deg, var(--color-navy-900) 0%, var(--color-navy-800) 50%, var(--color-navy-900) 100%)',
        borderTop: '1px solid var(--border)',
        padding: '5rem 0',
        textAlign: 'center',
      }}
    >
      {/* Decorative glow */}
      <div
        aria-hidden="true"
        className="glow-orb"
        style={{
          width: '500px',
          height: '500px',
          background: 'var(--color-indigo-500)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: 0.2,
        }}
      />

      <div className="container-default" style={{ position: 'relative', zIndex: 1 }}>
        <h2
          id="cta-footer-heading"
          className="heading-xl"
          style={{
            color: 'var(--text-primary)',
            marginBottom: '1rem',
            maxWidth: '600px',
            margin: '0 auto 1rem',
          }}
        >
          Your data is already there. <span className="gradient-text">Start reading it.</span>
        </h2>

        <p
          className="body-lg"
          style={{
            maxWidth: '480px',
            margin: '0 auto 2.25rem',
          }}
        >
          14 days free. No card. Cancel any time. Your sleep data, finally connected to the work
          that matters.
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.875rem',
            justifyContent: 'center',
          }}
        >
          <a href="#" className="btn-primary">
            Start tracking free
          </a>
          <a href="#" className="btn-secondary">
            Talk to our team
          </a>
        </div>
      </div>
    </section>
  );
}
