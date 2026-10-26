import DownloadButton from './DownloadButton.jsx';

export default function DocumentList({ documents, isLoading, error }) {
  if (isLoading) return <p role="status">Carregando documentos…</p>;
  if (error) return <p role="alert">{error}</p>;
  if (documents.length === 0) return <p>Nenhum documento enviado.</p>;

  return (
    <table>
      <caption>Documentos disponíveis para download</caption>
      <thead>
        <tr>
          <th scope="col">Nome</th>
          <th scope="col">Tamanho (bytes)</th>
          <th scope="col">Data de envio</th>
          <th scope="col">Ações</th>
        </tr>
      </thead>
      <tbody>
        {documents.map((document) => (
          <tr key={document.id}>
            <td>{document.originalName}</td>
            <td>{document.size.toLocaleString('pt-BR')}</td>
            <td>
              <time dateTime={document.uploadedAt}>
                {new Date(document.uploadedAt).toLocaleString('pt-BR')}
              </time>
            </td>
            <td><DownloadButton document={document} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
