export default function SkillGroups({ title, groups }) {
  return (
    <div className="skill-experience">
      <div className="skill-experience-heading">
        <h3>{title}</h3>
        <p className="skill-experience-note">経験の場・担当作業・代表事例を記載しています。</p>
      </div>
      <div className="skill-groups">
        {groups.map((group) => (
          <section key={group.id} className={`skill-group skill-group-${group.id}`} aria-labelledby={`skill-group-${group.id}`}>
            <h4 id={`skill-group-${group.id}`}>{group.title}</h4>
            <p className="skill-group-description">{group.description}</p>
            <ul className="skill-items">
              {group.items.map((item) => (
                <li key={item.name} className={`skill-item skill-item-${item.kind ?? 'other'}`}>
                  <h5 className="skill-item-name">{item.name}</h5>
                  <p className="skill-context">{item.context}</p>
                  <ul className="skill-works" aria-label={`${item.name}の担当作業`}>
                    {item.works.map((work) => <li key={work}>{work}</li>)}
                  </ul>
                  <p className="skill-evidence">{item.evidence}</p>
                  {item.href && <a className="skill-example" href={item.href}>代表事例を見る <span aria-hidden="true">→</span></a>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
