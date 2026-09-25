export default function TagList({ tags, label = '使用技術' }) {
  return (
    <ul className="tags" aria-label={label}>
      {tags.map((tag) => {
        const name = typeof tag === 'string' ? tag : tag.name;
        const kind = typeof tag === 'string' ? undefined : tag.kind;
        return (
          <li key={name} className={kind ? `skill-tag skill-${kind}` : 'skill-tag'}>
            {name}
          </li>
        );
      })}
    </ul>
  );
}
