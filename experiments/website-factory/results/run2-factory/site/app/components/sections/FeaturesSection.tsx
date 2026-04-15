type Feature = {
  icon: string;
  headline: string;
  body: string;
  proof: string;
};

const features: Feature[] = [
  {
    icon: '📡',
    headline: 'Passive. Accurate. Already running.',
    body: 'NightOwl reads data from your Apple Watch, Oura Ring, Fitbit, or Garmin device. No manual logging. No changing your routine. Connect your wearable and it starts building your baseline — quietly, in the background.',
    proof: 'Supports 12+ wearable devices. Setup takes 3 minutes.',
  },
  {
    icon: '🧠',
    headline: 'The connection your other apps never made.',
    body: "NightOwl analyzes your sleep against your work output signals — GitHub commits, Notion pages, Toggl sessions, Linear issues closed. It surfaces patterns you couldn't see: the 6-hour-sleep mornings that produce your most bug-dense PRs, the deep-sleep nights before your best writing days.",
    proof: 'Correlation reports refresh daily. You choose which signals to include.',
  },
  {
    icon: '🔮',
    headline: 'Advice that knows your chronotype.',
    body: "Generic advice says 8 hours. Your recommendation engine knows you're a night owl who hits flow state at 10pm and peaks cognitively at 11am. Recommendations are built from your actual data — optimized for your schedule, not an averaged population.",
    proof: 'Recommendations update as your patterns shift. No two users get the same plan.',
  },
  {
    icon: '👥',
    headline: 'Burnout signals, not surveillance.',
    body: "For engineering managers: aggregate team sleep patterns, trend alerts, and on-call rotation impact analysis — all without accessing anyone's individual data. Spot the sprint where your whole team is running on five hours before it shows up in your velocity chart.",
    proof: 'Individual data is permanently anonymized at the source. Managers see trends only.',
  },
  {
    icon: '🔗',
    headline: 'Lives where your work already lives.',
    body: 'Connect NightOwl to the tools your team already uses. Insights surface inside Notion pages, Linear priorities, GitHub PR timelines, and Slack status summaries — without adding another dashboard to check.',
    proof: '20+ integrations. Connect in one click. Disconnect any time.',
  },
];

export default function FeaturesSection() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="section-padding"
      style={{ background: 'var(--color-navy-950)' }}
    >
      <div className="container-default">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <span className="eyebrow" style={{ marginBottom: '1rem', display: 'inline-block' }}>
            Features
          </span>
          <h2
            id="features-heading"
            className="heading-xl"
            style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}
          >
            Everything your sleep data has been{' '}
            <span className="gradient-text">waiting to tell you.</span>
          </h2>
          <p className="body-lg" style={{ maxWidth: '560px', margin: '0 auto' }}>
            Five capabilities designed for people who think for a living.
          </p>
        </div>

        {/* Feature grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {features.map((feature, i) => (
            <article
              key={i}
              className="card card-hover"
              style={
                i === 4
                  ? {
                      gridColumn: '1 / -1',
                    }
                  : undefined
              }
            >
              <div
                style={{
                  fontSize: '1.75rem',
                  marginBottom: '1rem',
                  lineHeight: 1,
                }}
                aria-hidden="true"
              >
                {feature.icon}
              </div>
              <h3
                className="heading-lg"
                style={{
                  color: 'var(--text-primary)',
                  marginBottom: '0.75rem',
                  fontSize: '1.125rem',
                }}
              >
                {feature.headline}
              </h3>
              <p className="body-md" style={{ marginBottom: '1rem' }}>
                {feature.body}
              </p>
              <p
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: 'var(--color-teal-400)',
                  margin: 0,
                }}
              >
                {feature.proof}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
