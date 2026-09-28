import PrintButton from './PrintButton.jsx';
import ConditionContent from './ConditionContent.jsx';
import content from '../content';
import './documents.css';

function Entries({ entries }) {
  return <dl className="document-entries">{entries.map((entry) => (
    <div key={entry.label}><dt>{entry.label}</dt><dd><ConditionContent condition={entry} /></dd></div>
  ))}</dl>;
}

function Career() {
  return content.career.items.map((item) => <section key={item.title}>
    <h2>{item.title}</h2>
    {item.points ? item.points.map((point) => <div className="document-item" key={`${point.period}-${point.text}`}>
      <h3>{point.period}</h3><p>{point.text}</p>
      {point.responsibilities?.map((entry) => (
        <p key={entry.label}>{entry.label}：{entry.text}</p>
      ))}
      {item.title !== '職歴' && point.skills?.length > 0 && <p>使用技術{point.skillsProvisional ? '（仮・要確認）' : ''}：{point.skills.map((skill) => skill.name).join(' / ')}</p>}
    </div>) : <p>{item.text}{item.link && <a href={item.link.href}>{item.link.label}</a>}{item.afterLink}</p>}
  </section>);
}

export default function DocumentPage() {
  return <div className="document-view">
    <div className="document-toolbar">
      <a href="/">← ホームへ戻る</a>
      <PrintButton />
      <p>印刷画面で保存先を「PDFに保存」、用紙を「A4」に設定してください。ヘッダーとフッターをオフにすると、URLや日付を省けます。</p>
    </div>
    <main className="document-paper">
      <header className="document-heading"><h1>職務経歴書</h1><p>{content.brand}</p></header>
      <section><h2>職務要約</h2><p>{content.hero.intro}</p></section>
      <Career />
      <section><h2>希望条件・連絡先</h2><Entries entries={content.contact.conditions} />
        {content.contact.links.map((link) => {
          const value = link.href.replace(/^mailto:/, '');
          return <p key={link.href}><a href={link.href}>{link.label}：{value}</a></p>;
        })}
        {content.contact.note && <p>{content.contact.note}</p>}
      </section>
    </main>
  </div>;
}
