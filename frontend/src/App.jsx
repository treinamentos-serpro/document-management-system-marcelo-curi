import { useEffect, useState } from 'react';
import UploadComponent from './components/UploadComponent.jsx';
import DocumentList from './components/DocumentList.jsx';
import { listDocuments } from './services/api.js';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  function refreshDocuments() {
    setReloadKey((key) => key + 1);
  }

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError('');

    async function loadDocuments() {
      try {
        const documents = await listDocuments({ signal: controller.signal });
        if (!controller.signal.aborted) setDocuments(documents);
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    loadDocuments();
    return () => controller.abort();
  }, [reloadKey]);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Document Management System</h1>
      <UploadComponent onUpload={refreshDocuments} />
      <section aria-labelledby="documents-title">
        <h2 id="documents-title">Meus documentos</h2>
        <button type="button" onClick={refreshDocuments} disabled={isLoading}>
          Atualizar lista
        </button>
        <DocumentList documents={documents} isLoading={isLoading} error={error} />
      </section>
    </main>
  );
}
