export default function ConditionContent({ condition }) {
  return <>
    {condition.text}
    {condition.items && <ul className="condition-time-list">
      {condition.items.map((item) => <li key={item}>{item}</li>)}
    </ul>}
    {condition.note && <aside className="condition-supplement" aria-label={condition.note.label}>
      <strong>{condition.note.label}</strong>
      <p>{condition.note.text}</p>
    </aside>}
  </>;
}
