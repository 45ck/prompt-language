'use client';

import { useState } from 'react';

type PricingTier = {
  name: string;
  price: { monthly: string; annual: string };
  audience: string;
  features: string[];
  cta: string;
  ctaHref: string;
  featured?: boolean;
};

const tiers: PricingTier[] = [
  {
    name: 'Solo',
    price: { monthly: 'Free', annual: 'Free' },
    audience: 'For individuals getting started',
    features: [
      '7-day sleep history',
      'Basic correlation reports',
      '1 work tool integration',
      'Mobile app access',
      'Sleep quality trends',
    ],
    cta: 'Start free',
    ctaHref: '#',
  },
  {
    name: 'Pro',
    price: { monthly: '$12/mo', annual: '$96/yr' },
    audience: 'For knowledge workers serious about performance',
    features: [
      'Full sleep history + trend analysis',
      'Cognitive correlation across all tools',
      'Unlimited integrations',
      'Personalized daily recommendations',
      'Chronotype analysis',
      'Raw data export (CSV + JSON)',
      'API access',
      'Priority support',
    ],
    cta: 'Start 14-day free trial',
    ctaHref: '#',
    featured: true,
  },
  {
    name: 'Team',
    price: { monthly: '$8/seat/mo', annual: '$8/seat/mo' },
    audience: 'For engineering managers and distributed teams',
    features: [
      'Everything in Pro for each member',
      'Team Insights dashboard (aggregate only)',
      'Sprint health monitoring',
      'On-call rotation impact analysis',
      'Privacy controls + team admin',
      'Slack team trend integration',
      'Dedicated onboarding',
    ],
    cta: 'Talk to us',
    ctaHref: '#',
  },
];

export default function PricingSection() {
  const [annual, setAnnual] = useState(true);

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="section-padding"
      style={{ background: 'var(--surface)' }}
    >
      <div className="container-default">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span className="eyebrow" style={{ marginBottom: '1rem', display: 'inline-block' }}>
            Pricing
          </span>
          <h2
            id="pricing-heading"
            className="heading-xl"
            style={{ color: 'var(--text-primary)', marginBottom: '0.75rem' }}
          >
            Pricing that matches <span className="gradient-text">how you work.</span>
          </h2>
          <p className="body-md" style={{ marginBottom: '1.75rem' }}>
            Start free. Upgrade when the insights earn it.
          </p>

          {/* Billing toggle */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-pill)',
              padding: '0.3rem',
            }}
          >
            <button
              onClick={() => setAnnual(false)}
              aria-pressed={!annual}
              style={{
                padding: '0.375rem 1rem',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                background: !annual ? 'var(--color-indigo-500)' : 'transparent',
                color: !annual ? '#fff' : 'var(--text-muted)',
                fontWeight: 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'background 0.2s ease, color 0.2s ease',
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              aria-pressed={annual}
              style={{
                padding: '0.375rem 1rem',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                background: annual ? 'var(--color-indigo-500)' : 'transparent',
                color: annual ? '#fff' : 'var(--text-muted)',
                fontWeight: 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'background 0.2s ease, color 0.2s ease',
              }}
            >
              Annual{' '}
              <span
                style={{
                  background: 'var(--color-teal-400)',
                  color: '#000',
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-pill)',
                  padding: '0.1rem 0.4rem',
                  marginLeft: '0.375rem',
                }}
              >
                SAVE 33%
              </span>
            </button>
          </div>
        </div>

        {/* Tier cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.5rem',
            alignItems: 'start',
          }}
        >
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`card ${tier.featured ? 'pricing-card-featured' : ''}`}
              style={{ position: 'relative' }}
            >
              {tier.featured && (
                <div
                  aria-label="Most popular plan"
                  style={{
                    position: 'absolute',
                    top: '-0.75rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--color-indigo-500)',
                    color: '#fff',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    borderRadius: 'var(--radius-pill)',
                    padding: '0.25rem 0.875rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Most popular
                </div>
              )}

              <div style={{ marginBottom: '0.5rem' }}>
                <span
                  style={{
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '1.0625rem',
                  }}
                >
                  {tier.name}
                </span>
              </div>

              <div style={{ marginBottom: '0.5rem' }}>
                <span
                  style={{
                    color: 'var(--text-primary)',
                    fontSize: '2rem',
                    fontWeight: 700,
                    letterSpacing: '-0.03em',
                  }}
                >
                  {annual ? tier.price.annual : tier.price.monthly}
                </span>
              </div>

              <p
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.8125rem',
                  marginBottom: '1.5rem',
                }}
              >
                {tier.audience}
              </p>

              <a
                href={tier.ctaHref}
                className={tier.featured ? 'btn-primary' : 'btn-secondary'}
                style={{ width: '100%', justifyContent: 'center', marginBottom: '1.5rem' }}
              >
                {tier.cta}
              </a>

              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.625rem',
                }}
                aria-label={`${tier.name} plan features`}
              >
                {tier.features.map((f) => (
                  <li
                    key={f}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      color: 'var(--text-secondary)',
                      fontSize: '0.875rem',
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      style={{ flexShrink: 0, marginTop: '0.15rem' }}
                    >
                      <circle
                        cx="8"
                        cy="8"
                        r="7"
                        stroke="var(--color-teal-400)"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M5 8l2 2 4-4"
                        stroke="var(--color-teal-400)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Privacy callout */}
        <p
          style={{
            textAlign: 'center',
            marginTop: '2rem',
            color: 'var(--text-muted)',
            fontSize: '0.8125rem',
          }}
        >
          <strong style={{ color: 'var(--text-secondary)' }}>Team plan privacy note:</strong>{' '}
          Individual sleep data is never visible to team admins. The Team plan uses aggregated,
          anonymized data only.
        </p>
      </div>
    </section>
  );
}
