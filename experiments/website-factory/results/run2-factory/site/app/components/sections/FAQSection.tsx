'use client';

import { useState } from 'react';

// FAQSection — NightOwl marketing site

type FAQItem = {
  question: string;
  answer: string;
};

const faqs: FAQItem[] = [
  {
    question: 'Do I need a specific wearable device?',
    answer:
      "NightOwl works with Apple Watch, Oura Ring, Fitbit, Garmin, and Whoop. If you already own one of these, you're ready. We're adding support for additional devices — check our integration page for the current list. You can also use phone-based tracking (microphone + accelerometer) with no hardware at all.",
  },
  {
    question: 'What work data does NightOwl actually read?',
    answer:
      'Only what you explicitly connect and authorize. For GitHub, that means commit timestamps and PR activity — not code content. For Linear or Jira, it reads task completion timestamps. For Toggl, it reads session durations. NightOwl never reads the content of your work, only the timing and volume signals you choose to share.',
  },
  {
    question: "I'm an engineering manager. Can I see my team members' individual sleep data?",
    answer:
      'No. And this is intentional, not an oversight. Team Insights shows aggregated, anonymized patterns across the team. Individual data is anonymized at the source and is never surfaced to any admin, manager, or employer — ever. Your team opts in individually, and their personal data stays personal.',
  },
  {
    question: 'Can I export my raw data?',
    answer:
      'Yes. Pro and Team plan users can export full sleep datasets in CSV or JSON format at any time. The REST API is available for direct programmatic access on the Pro plan. You own your data and can delete it entirely at any time.',
  },
  {
    question: 'How is this different from the sleep app that came with my wearable?',
    answer:
      "Wearable sleep apps show you sleep data in isolation — a score, a graph, a generic insight. NightOwl correlates that data with your actual work output to answer a different question: not 'how did you sleep?' but 'what does that sleep mean for your performance today and your patterns over time?' It also aggregates across multiple wearables if you switch devices.",
  },
  {
    question: 'Is my health data secure?',
    answer:
      'Sleep data is encrypted at rest and in transit. We do not sell data to advertisers, insurers, or third parties. We do not share individual data with employers. Our privacy policy is written in plain English — because we work with health data and believe transparency is non-negotiable. You can delete all your data at any time.',
  },
  {
    question: 'Is there a free trial?',
    answer:
      'The Solo plan is free forever with basic features. The Pro plan includes a 14-day free trial with full access — no credit card required. You will not be charged until you decide to upgrade.',
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="section-padding"
      style={{ background: 'var(--color-navy-950)' }}
    >
      <div className="container-default" style={{ maxWidth: '760px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <span className="eyebrow" style={{ marginBottom: '1rem', display: 'inline-block' }}>
            FAQ
          </span>
          <h2 id="faq-heading" className="heading-xl" style={{ color: 'var(--text-primary)' }}>
            Questions from people who <span className="gradient-text">ask good questions.</span>
          </h2>
        </div>

        {/* Accordion */}
        <dl>
          {faqs.map((faq, i) => (
            <div key={i} className="faq-item">
              <dt>
                <button
                  className="faq-trigger"
                  aria-expanded={openIndex === i}
                  aria-controls={`faq-answer-${i}`}
                  id={`faq-question-${i}`}
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                >
                  <span>{faq.question}</span>
                  <svg
                    className={`faq-chevron${openIndex === i ? ' open' : ''}`}
                    width="18"
                    height="18"
                    viewBox="0 0 18 18"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 6l5 5 5-5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </dt>
              <dd
                id={`faq-answer-${i}`}
                aria-labelledby={`faq-question-${i}`}
                className={`faq-content${openIndex === i ? ' open' : ''}`}
              >
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.9375rem',
                    lineHeight: 1.75,
                    margin: 0,
                  }}
                >
                  {faq.answer}
                </p>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
