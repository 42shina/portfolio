import content from '../content';

function homeHref(href) {
  if (href.startsWith('#')) return `/${href}`;
  return href;
}

export function Wordmark() {
  return (
    <a className="wordmark" href="/" aria-label={`${content.brand}のポートフォリオ ホーム`}>
      {content.brand}<span className="dot">.</span>
    </a>
  );
}

export function Header({ homeAnchors = false } = {}) {
  return (
    <header className="header wrap">
      <Wordmark />
      <nav aria-label="メインナビゲーション">
        {content.navigation.map((item) => (
          <a key={item.href} href={homeAnchors ? homeHref(item.href) : item.href}>
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

export function Footer({ footer, backHref = '#main' }) {
  return (
    <footer className="footer wrap">
      <Wordmark />
      <small>{footer.copyright}</small>
      <a href={backHref}>{footer.backToTop}</a>
    </footer>
  );
}
