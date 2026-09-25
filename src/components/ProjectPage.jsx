import content from '../content';
import { Footer, Header } from './Layout.jsx';
import ProjectVisual from './ProjectVisual.jsx';
import TagList from './TagList.jsx';

export default function ProjectPage({ project }) {
  return (
    <>
      <a className="skip-link" href="#main">本文へスキップ</a>
      <Header homeAnchors />
      <main id="main" className="project-page wrap">
        <p className="project-back">
          <a href="/#work">← 制作物一覧へ</a>
        </p>
        <article aria-labelledby="project-title">
          <div className="project-detail-layout">
            <ProjectVisual project={project} />
            <div className="project-detail-body">
              <div className="project-heading">
                <h1 id="project-title">{project.title}</h1>
                <span className="project-number">{project.number}</span>
              </div>
              <p className="project-lead">{project.description}</p>
              <dl className="project-detail">
                {project.details.map(({ label, text }) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{text}</dd>
                  </div>
                ))}
              </dl>
              <TagList tags={project.tags} />
              {project.link ? (
                <a
                  className="project-link"
                  href={project.link.href}
                  {...(project.link.href.startsWith('http')
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                >
                  {project.link.label} <span aria-hidden="true">↗</span>
                </a>
              ) : (
                <span className="project-link-pending">{project.pendingLinkText}</span>
              )}
            </div>
          </div>
          {project.diagrams?.length > 0 && (
            <section className="project-diagrams" aria-label="構成図">
              {project.diagrams.map((diagram) => (
                <figure key={diagram.src} className="project-diagram">
                  <img src={diagram.src} alt={diagram.alt} loading="lazy" />
                  {diagram.caption && <figcaption>{diagram.caption}</figcaption>}
                </figure>
              ))}
            </section>
          )}
        </article>
      </main>
      <Footer footer={content.footer} backHref="#main" />
    </>
  );
}
