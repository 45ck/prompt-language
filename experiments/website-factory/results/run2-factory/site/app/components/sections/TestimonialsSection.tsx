type Testimonial = {
  quote: string;
  name: string;
  role: string;
  avatar: string;
};

const testimonials: Testimonial[] = [
  {
    quote:
      'I always suspected my late-night sessions were counterproductive. NightOwl showed me that every PR I pushed after midnight had a 3x higher bug rate in code review. That data actually changed my behavior — I stopped coding after 11pm.',
    name: 'Maya C.',
    role: 'Senior Backend Engineer, Series B startup',
    avatar: 'MC',
  },
  {
    quote:
      'I can see when my team is burning out before it hits our velocity. The aggregate sprint view showed me that our on-call rotation was costing the team an average of 1.2 hours of deep sleep per night. We redesigned the rotation based on that data.',
    name: 'James O.',
    role: 'Engineering Manager, distributed team of 12',
    avatar: 'JO',
  },
  {
    quote:
      "I exported my 90-day sleep dataset and ran my own regression analysis against my GitHub activity. The correlation between my deep sleep percentage and commit quality was 0.67. I'd been skeptical of consumer sleep apps — this felt like the real thing.",
    name: 'Dr. Priya S.',
    role: 'Data Scientist, health-tech company',
    avatar: 'PS',
  },
  {
    quote:
      'I had a hypothesis that my late-night writing sessions were less productive than my morning sessions. NightOwl confirmed it with six weeks of data. I restructured my client schedule and my output quality — and my client retention — both improved.',
    name: 'Alex R.',
    role: 'Freelance content strategist',
    avatar: 'AR',
  },
];

export default function TestimonialsSection() {
  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-heading"
      className="section-padding"
      style={{ background: 'var(--color-navy-950)' }}
    >
      <div className="container-default">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <span className="eyebrow" style={{ marginBottom: '1rem', display: 'inline-block' }}>
            What people are saying
          </span>
          <h2
            id="testimonials-heading"
            className="heading-xl"
            style={{ color: 'var(--text-primary)', marginBottom: '0.75rem' }}
          >
            What engineers, researchers, and writers are{' '}
            <span className="gradient-text">building with better sleep.</span>
          </h2>
        </div>

        {/* Testimonial grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {testimonials.map((t, i) => (
            <figure key={i} className="card card-hover" style={{ margin: 0 }}>
              {/* Stars */}
              <div
                aria-label="5 out of 5 stars"
                style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem' }}
              >
                {Array.from({ length: 5 }).map((_, j) => (
                  <svg
                    key={j}
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="var(--color-amber-400)"
                  >
                    <path d="M7 1l1.5 4H13l-3.5 2.5 1.3 4L7 9 3.2 11.5l1.3-4L1 5h4.5z" />
                  </svg>
                ))}
              </div>

              <blockquote
                style={{
                  margin: '0 0 1.25rem 0',
                  color: 'var(--text-secondary)',
                  fontSize: '0.9375rem',
                  lineHeight: 1.7,
                  fontStyle: 'italic',
                }}
              >
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              <figcaption style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {/* Avatar */}
                <div
                  aria-hidden="true"
                  style={{
                    width: '2.25rem',
                    height: '2.25rem',
                    borderRadius: '50%',
                    background:
                      'linear-gradient(135deg, var(--color-indigo-500), var(--color-teal-400))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {t.avatar}
                </div>
                <div>
                  <div
                    style={{
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                    }}
                  >
                    {t.name}
                  </div>
                  <div
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                    }}
                  >
                    {t.role}
                  </div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
