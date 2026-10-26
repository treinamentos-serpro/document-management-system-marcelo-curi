import { useState } from 'react';
import { downloadDocument } from '../services/api.js';

export default function DownloadButton({ document }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');

  async function handleDownload() {
    setError('');
    setIsDownloading(true);
    try {
      const blob = await downloadDocument(document.id);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      try {
        link.href = url;
        link.download = document.originalName;
        window.document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={isDownloading}
        onClick={handleDownload}
        aria-label={`Baixar ${document.originalName}`}
      >
        {isDownloading ? 'Baixando…' : 'Baixar'}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
