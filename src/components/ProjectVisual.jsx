const visualTone = {
  portfolio: 'portfolio',
  cozyctrl: 'cozyctrl',
};

export default function ProjectVisual({ project }) {
  const visual = {
    portfolio: <div className="site-preview"><div className="site-preview-nav"><span>T.S.</span><span>WORK　 ABOUT　 CONTACT</span></div><div className="site-preview-body"><strong>暮らしの課題を、<br />仕組みで解決</strong><span>REACT / JSON / AWS</span></div></div>,
    cozyctrl: <div className="logo-preview"><img src="/cozyctrl-logo.svg" alt="" /></div>,
  }[project.visual];

  return (
    <div
      className={`project-visual visual-${visualTone[project.visual] ?? 'portfolio'}`}
      role="img"
      aria-label={project.visualDescription}
    >
      <span className="visual-label">{project.visualLabel}</span>
      {visual}
    </div>
  );
}
