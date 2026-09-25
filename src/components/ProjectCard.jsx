import ProjectVisual from './ProjectVisual.jsx';
import TagList from './TagList.jsx';

export default function ProjectCard({ project }) {
  const detailHref = `/projects/${project.id}/`;
  const body = (
    <div className={project.wide ? 'project-body' : undefined}>
      <div className="project-heading">
        <h3>
          <a href={detailHref}>{project.title}</a>
        </h3>
        <span className="project-number">{project.number}</span>
      </div>
      <p>{project.description}</p>
      {project.highlights && (
        <dl className="project-highlights">
          {project.highlights.map((item) => (
            <div key={item.label}><dt>{item.label}</dt><dd>{item.text}</dd></div>
          ))}
        </dl>
      )}
      <TagList tags={project.tags} />
      <a className="project-link" href={detailHref}>
        詳細を見る <span aria-hidden="true">→</span>
      </a>
    </div>
  );

  return (
    <article className={`project${project.wide ? ' project-wide' : ''}`}>
      <a className="project-visual-link" href={detailHref} aria-label={`${project.title}の詳細`}>
        <ProjectVisual project={project} />
      </a>
      {body}
    </article>
  );
}
