export default function Footer() {
  const productLinks = [
    { label: 'Features', href: '#features' },
    { label: 'Integrations', href: '#integrations' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Pricing', href: '#pricing' },
  ];

  const companyLinks = [
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Press', href: '#' },
  ];

  const legalLinks = [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'Security', href: '#' },
  ];

  return (
    <footer
      style={{
        background: 'var(--color-navy-950)',
        borderTop: '1px solid var(--border)',
        paddingTop: '3.5rem',
        paddingBottom: '2rem',
      }}
      role="contentinfo"
    >
      <div className="container-default">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '2.5rem',
            marginBottom: '3rem',
          }}
        >
          {/* Brand column */}
          <div style={{ gridColumn: 'span 1' }}>
            <a
              href="#hero"
              className="nav-link"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 600,
                fontSize: '1.0625rem',
                color: 'var(--text-primary)',
                marginBottom: '0.75rem',
              }}
              aria-label="NightOwl home"
            >
              <span aria-hidden="true">🦉</span>
              <span>NightOwl</span>
            </a>
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.8125rem',
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Sleep smarter, think sharper.
            </p>
            <div style={{ display: 'flex', gap: '0.875rem', marginTop: '1.25rem' }}>
              {['Twitter', 'LinkedIn', 'GitHub'].map((social) => (
                <a
                  key={social}
                  href="#"
                  className="nav-link"
                  aria-label={`NightOwl on ${social}`}
                  style={{ fontSize: '0.75rem', fontWeight: 500 }}
                >
                  {social}
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <FooterColumn title="Product" links={productLinks} />

          {/* Company */}
          <FooterColumn title="Company" links={companyLinks} />

          {/* Legal */}
          <FooterColumn title="Legal" links={legalLinks} />
        </div>

        {/* Bottom bar */}
        <div
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: '1.5rem',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>
            &copy; 2026 NightOwl. All rights reserved.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>
            NightOwl does not provide medical advice. Individual sleep data is never shared with
            employers or insurers.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3
        style={{
          color: 'var(--text-primary)',
          fontSize: '0.8125rem',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          margin: '0 0 1rem 0',
        }}
      >
        {title}
      </h3>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.625rem',
        }}
      >
        {links.map((link) => (
          <li key={link.label}>
            <a href={link.href} className="nav-link">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
