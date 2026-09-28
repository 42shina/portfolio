import { useState } from 'react';

export default function PrintButton({ label = 'PDFに保存 / 印刷' }) {
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState('');

  async function print() {
    setPrinting(true);
    setError('');
    try {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images, (img) => img.decode()));
      window.print();
    } catch {
      setError('画像の読み込みに失敗しました。ページを再読み込みしてから、もう一度お試しください。');
    } finally {
      setPrinting(false);
    }
  }

  return <>
    <button className="button print-button" type="button" onClick={print} disabled={printing}>
      {printing ? '準備中…' : label}
    </button>
    {error && <p role="alert">{error}</p>}
  </>;
}
