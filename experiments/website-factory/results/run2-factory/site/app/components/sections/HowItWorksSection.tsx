const steps = [
  {
    number: '01',
    label: 'Connect',
    headline: 'Link your wearable and your work tools.',
    body: 'Connect the device you already wear and the tools you already use — GitHub, Notion, Linear, Toggl, or any of our 20+ integrations. Takes about three minutes.',
  },
  {
    number: '02',
    label: 'Track',
    headline: 'Sleep normally. NightOwl does the work.',
    body: 'Your wearable continues doing what it already does. NightOwl reads the data in the background, builds your sleep baseline, and begins correlating it with your work output signals — no input required from you.',
  },
  {
    number: '03',
    label: 'Act',
    headline: 'Get insights that change what you do next.',
    body: "Every morning, NightOwl surfaces the one or two things worth knowing: when your peak focus window opens today, what last night's sleep means for your afternoon, and whether you're trending toward a rough sprint.",
  },
];

export default function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="section-padding"
      style={{ background: 'var(--surface)' }}
    >
      <div className="container-default">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <span className="eyebrow" style={{ marginBottom: '1rem', display: 'inline-block' }}>
            How It Works
          </span>
          <h2
            id="how-heading"
            className="heading-xl"
            style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}
          >
            Three steps. <span className="gradient-text">Then it just runs.</span>
          </h2>
        </div>

        {/* Steps */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '2rem',
            position: 'relative',
          }}
        >
          {steps.map((step, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.875rem',
              }}
            >
              {/* Step number */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginBottom: '0.25rem',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '2rem',
                    fontWeight: 700,
                    lineHeight: 1,
                    background:
                      'linear-gradient(135deg, var(--color-indigo-400), var(--color-teal-300))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                  aria-hidden="true"
                >
                  {step.number}
                </span>
                <span className="eyebrow" style={{ fontSize: '0.6875rem' }}>
                  {step.label}
                </span>
              </div>

              <h3
                style={{
                  color: 'var(--text-primary)',
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  lineHeight: 1.3,
                  margin: 0,
                }}
              >
                {step.headline}
              </h3>
              <p className="body-md" style={{ margin: 0 }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <a href="#pricing" className="btn-primary">
            Start your 14-day free trial — no card required
          </a>
        </div>
      </div>
    </section>
  );
}
