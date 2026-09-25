import content from './content';
import { Footer, Header } from './components/Layout.jsx';
import ProjectCard from './components/ProjectCard.jsx';
import SkillGroups from './components/SkillGroups.jsx';


function HeroArt({ hero }) {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="art-meta">
        <span>{hero.artMeta}</span>
        <span>FIG. 01</span>
      </div>
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="sculpture">
        <div className="arch" />
        <div className="sphere" />
        <div className="block" />
      </div>
      <div className="art-caption">
        <span className="tiny-cross">+</span>
        <span>
          {hero.artCaption}
          <br />
          {hero.artYear}
        </span>
      </div>
    </div>
  );
}

function Hero({ hero }) {
  return (
    <section className="hero wrap" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow">
          <span className="status-dot" aria-hidden="true" />
          {hero.eyebrow}
        </p>
        <h1 id="hero-title">
          {hero.titleBefore}
          <br />
          {hero.titleMiddle}
          <span className="accent">{hero.titleAccent}</span>
          {hero.titleAfter}
        </h1>
        <p className="intro">{hero.intro}</p>
        <ul className="hero-services" aria-label="対応できること">
          {hero.services.map((service) => (
            <li key={service.title}><h2>{service.title}</h2><p>{service.text}</p></li>
          ))}
        </ul>
        <a className="button" href="#work">
          {hero.button} <span aria-hidden="true">↘</span>
        </a>
        <p className="hero-note">{hero.note}</p>
      </div>
      <HeroArt hero={hero} />
    </section>
  );
}

function Work({ heading, projects }) {
  return (
    <section className="work wrap section" id="work" aria-labelledby="work-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{heading.eyebrow}</p>
          <h2 id="work-title">{heading.title}</h2>
        </div>
        <p className="section-note">
          {heading.notePrefix}
          {projects.length}
          {heading.noteSuffix}
        </p>
      </div>
      <div className="project-grid">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
}

function About({ about }) {
  return (
    <section className="about section wrap" id="about" aria-labelledby="about-title">
      <div className="about-intro">
        <div>
          <p className="eyebrow">{about.eyebrow}</p>
          <h2 id="about-title">
            {about.title.map((line, index) => (
              <span key={line}>
                {index > 0 && <br />}
                {line}
              </span>
            ))}
          </h2>
        </div>
        <div className="about-detail">
          {about.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
      <SkillGroups title={about.skillsTitle} groups={about.skillGroups} />
    </section>
  );
}

function Career({ career }) {
  return (
    <section className="career section wrap" id="career" aria-labelledby="career-title">
      <div>
        <p className="eyebrow">{career.eyebrow}</p>
        <h2 id="career-title">{career.title}</h2>
        <p className="career-intro">{career.intro}</p>
      </div>
      <div className="career-list">
        {career.items.map((item) => (
          <div className="career-item" key={item.title}>
            <h3>{item.title}</h3>
            {item.points ? (
              <ul className="career-points">
                {item.points.map((point) => (
                  <li key={`${point.period}-${point.text}`}>
                    <span className="career-period">{point.period}</span>
                    <div className="career-point-body">
                      <span className="career-point-text">{point.text}</span>
                      {point.responsibilities && (
                        <dl className="career-responsibilities">
                          {point.responsibilities.map((entry) => (
                            <div key={entry.label}><dt>{entry.label}</dt><dd>{entry.text}</dd></div>
                          ))}
                        </dl>
                      )}
                      {point.skills?.length > 0 && (
                        <ul className="tags career-skills" aria-label="使用スキル">
                          {point.skills.map((skill) => (
                            <li key={skill.name} className={`skill-tag skill-${skill.kind}`}>
                              {skill.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                {item.text}
                {item.link && (
                  <>
                    <a href={item.link.href}>{item.link.label}</a>
                    {item.afterLink}
                  </>
                )}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Contact({ contact }) {
  return (
    <section className="contact wrap" id="contact" aria-labelledby="contact-title">
      <p className="eyebrow">{contact.eyebrow}</p>
      <h2 id="contact-title">{contact.title}</h2>
      <p>{contact.description}</p>
      <dl className="contact-conditions">
        {contact.conditions.map((condition) => (
          <div key={condition.label}><dt>{condition.label}</dt><dd>{condition.text}</dd></div>
        ))}
      </dl>
      <div className="contact-links">
        {contact.links.map((link) => (
          <a
            key={link.href}
            className="contact-link"
            href={link.href}
            {...(link.href.startsWith('http')
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
          >
            {link.label} <span aria-hidden="true">{link.href.startsWith('mailto:') ? '→' : '↗'}</span>
          </a>
        ))}
      </div>
      {contact.note && <p className="contact-note">{contact.note}</p>}
    </section>
  );
}

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">本文へスキップ</a>
      <Header />
      <main id="main">
        <Hero hero={content.hero} />
        <Work heading={content.work} projects={content.projects} />
        <About about={content.about} />
        <Career career={content.career} />
        <Contact contact={content.contact} />
      </main>
      <Footer footer={content.footer} />
    </>
  );
}
