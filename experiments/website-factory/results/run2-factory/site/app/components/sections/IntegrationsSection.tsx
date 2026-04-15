type Integration = {
  name: string;
  category: string;
  emoji: string;
};

const integrations: Integration[] = [
  // Wearables
  { name: 'Apple Watch', category: 'Wearable', emoji: '⌚' },
  { name: 'Oura Ring', category: 'Wearable', emoji: '💍' },
  { name: 'Fitbit', category: 'Wearable', emoji: '📟' },
  { name: 'Garmin', category: 'Wearable', emoji: '🏃' },
  { name: 'Whoop', category: 'Wearable', emoji: '💪' },
  // Developer
  { name: 'GitHub', category: 'Developer', emoji: '🐙' },
  { name: 'GitLab', category: 'Developer', emoji: '🦊' },
  { name: 'Linear', category: 'Developer', emoji: '📐' },
  { name: 'Jira', category: 'Developer', emoji: '🔷' },
  // Productivity
  { name: 'Notion', category: 'Productivity', emoji: '📝' },
  { name: 'Google Calendar', category: 'Productivity', emoji: '📅' },
  { name: 'Toggl', category: 'Productivity', emoji: '⏱' },
  // Communication
  { name: 'Slack', category: 'Communication', emoji: '💬' },
  // Data
  { name: 'CSV Export', category: 'Data', emoji: '📊' },
  { name: 'JSON / API', category: 'Data', emoji: '🔌' },
  { name: 'Zapier', category: 'Data', emoji: '⚡' },
];

export default function IntegrationsSection() {
  return (
    <section
      id="integrations"
      aria-labelledby="integrations-heading"
      className="section-padding"
      style={{ background: 'var(--color-navy-950)' }}
    >
      <div className="container-default">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <span className="eyebrow" style={{ marginBottom: '1rem', display: 'inline-block' }}>
            Integrations
          </span>
          <h2
            id="integrations-heading"
            className="heading-xl"
            style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}
          >
            NightOwl lives inside <span className="gradient-text">the tools you already use.</span>
          </h2>
          <p className="body-md" style={{ maxWidth: '520px', margin: '0 auto' }}>
            Connect once. Insights flow automatically.
          </p>
        </div>

        {/* Integration logo grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: '0.75rem',
            marginBottom: '2rem',
          }}
        >
          {integrations.map((integration) => (
            <div key={integration.name} className="integration-logo" role="listitem">
              <span aria-hidden="true" style={{ fontSize: '1.5rem', lineHeight: 1 }}>
                {integration.emoji}
              </span>
              <span>{integration.name}</span>
              <span
                style={{
                  fontSize: '0.625rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {integration.category}
              </span>
            </div>
          ))}
        </div>

        {/* Request CTA */}
        <div style={{ textAlign: 'center' }}>
          <a
            href="#"
            style={{
              color: 'var(--color-indigo-400)',
              fontSize: '0.875rem',
              fontWeight: 500,
              textDecoration: 'none',
              borderBottom: '1px solid rgba(79,110,247,0.35)',
              paddingBottom: '0.1rem',
              transition: 'color 0.2s ease, border-color 0.2s ease',
            }}
          >
            Don&apos;t see your tool? Request an integration →
          </a>
        </div>
      </div>
    </section>
  );
}
