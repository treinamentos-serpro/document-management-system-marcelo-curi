import { useState } from 'react';
import { uploadDocument } from '../services/api.js';

export default function UploadComponent({ onUpload }) {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!file || file.size === 0) {
      setError('Selecione um arquivo não vazio para enviar.');
      return;
    }

    const form = event.currentTarget;
    setIsUploading(true);
    try {
      await uploadDocument(file);
      form.reset();
      setFile(null);
      setMessage('Documento enviado com sucesso.');
      onUpload();
    } catch (error) {
      setError(error.message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section aria-labelledby="upload-title">
      <h2 id="upload-title">Enviar documento</h2>
      <form onSubmit={handleSubmit} aria-busy={isUploading}>
        <label htmlFor="document-file">Arquivo</label>{' '}
        <input
          id="document-file"
          name="file"
          type="file"
          required
          disabled={isUploading}
          onChange={(event) => {
            setFile(event.target.files[0] ?? null);
            setError('');
            setMessage('');
          }}
        />{' '}
        <button type="submit" disabled={!file || isUploading}>
          {isUploading ? 'Enviando…' : 'Enviar'}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
