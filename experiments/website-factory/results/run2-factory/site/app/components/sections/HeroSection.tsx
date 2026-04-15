export default function HeroSection() {
  return (
    <section
      id="hero"
      aria-label="Hero"
      style={{
        position: 'relative',
        overflow: 'hidden',
        paddingTop: '8rem',
        paddingBottom: '6rem',
        background: 'linear-gradient(180deg, var(--color-navy-950) 0%, var(--color-navy-900) 100%)',
      }}
    >
      {/* Decorative glow orbs */}
      <div
        aria-hidden="true"
        className="glow-orb"
        style={{
          width: '600px',
          height: '600px',
          background: 'var(--color-indigo-500)',
          top: '-200px',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />
      <div
        aria-hidden="true"
        className="glow-orb"
        style={{
          width: '300px',
          height: '300px',
          background: 'var(--color-teal-400)',
          bottom: '0',
          right: '10%',
          opacity: 0.15,
        }}
      />

      <div
        className="container-default"
        style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}
      >
        {/* Eyebrow */}
        <div className="animate-fade-in-up" style={{ marginBottom: '1.5rem' }}>
          <span className="eyebrow">Sleep tracking for knowledge workers</span>
        </div>

        {/* Headline */}
        <h1
          className="heading-display animate-fade-in-up animation-delay-100"
          style={{
            color: 'var(--text-primary)',
            marginBottom: '1.25rem',
            maxWidth: '800px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Sleep smarter, <span className="gradient-text">think sharper.</span>
        </h1>

        {/* Subheadline */}
        <p
          className="body-lg animate-fade-in-up animation-delay-200"
          style={{
            maxWidth: '620px',
            margin: '0 auto 2.25rem',
          }}
        >
          NightOwl connects your sleep quality to your cognitive performance — so engineers,
          researchers, and writers can make decisions backed by their own data, not generic advice.
        </p>

        {/* CTAs */}
        <div
          className="animate-fade-in-up animation-delay-300"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.875rem',
            justifyContent: 'center',
            marginBottom: '3rem',
          }}
        >
          <a href="#pricing" className="btn-primary">
            Start tracking free — 14 days, no card required
          </a>
          <a href="#how-it-works" className="btn-secondary">
            See how it works
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              style={{ marginLeft: '0.25rem' }}
            >
              <path
                d="M3 8h10M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>

        {/* Trust signals */}
        <div
          className="animate-fade-in-up animation-delay-400"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.5rem',
            justifyContent: 'center',
            marginBottom: '4rem',
          }}
        >
          {[
            '✓ Works with Apple Watch, Oura, Fitbit, Garmin',
            '✓ No credit card required',
            '✓ Individual data never shared',
          ].map((trust) => (
            <span
              key={trust}
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.8125rem',
                fontWeight: 500,
              }}
            >
              {trust}
            </span>
          ))}
        </div>

        {/* Abstract data visualization */}
        <div
          className="animate-fade-in-up animation-delay-500"
          aria-hidden="true"
          style={{
            maxWidth: '760px',
            margin: '0 auto',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.75rem',
            boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
          }}
        >
          {/* Fake dashboard header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              {['#ef4444', '#f59e0b', '#22c55e'].map((c) => (
                <div
                  key={c}
                  style={{ width: 10, height: 10, borderRadius: '50%', background: c }}
                />
              ))}
            </div>
            <div
              style={{
                flex: 1,
                height: '1.5rem',
                background: 'var(--surface-elevated)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '0.75rem',
              }}
            >
              <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>
                nightowl.app/dashboard
              </span>
            </div>
          </div>

          {/* Fake sleep graph bars */}
          <div
            style={{
              display: 'flex',
              gap: '0.25rem',
              alignItems: 'flex-end',
              height: '80px',
              marginBottom: '0.75rem',
            }}
          >
            {[55, 70, 45, 85, 60, 90, 75, 65, 80, 50, 88, 72, 95, 68].map((h, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${h}%`,
                  borderRadius: '3px 3px 0 0',
                  background:
                    h >= 85
                      ? 'linear-gradient(180deg, var(--color-indigo-400), var(--color-indigo-500))'
                      : h >= 65
                        ? 'rgba(79,110,247,0.45)'
                        : 'rgba(79,110,247,0.2)',
                  transition: 'height 0.3s ease',
                }}
              />
            ))}
          </div>

          {/* Labels row */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>14 days ago</span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'rgba(45,212,191,0.1)',
                border: '1px solid rgba(45,212,191,0.25)',
                borderRadius: 'var(--radius-pill)',
                padding: '0.2rem 0.75rem',
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--color-teal-400)',
                }}
              />
              <span
                style={{ color: 'var(--color-teal-300)', fontSize: '0.6875rem', fontWeight: 600 }}
              >
                +23% focus time this week
              </span>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>Today</span>
          </div>
        </div>
      </div>
    </section>
  );
}
