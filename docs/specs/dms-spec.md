# Especificação - Document Management System

> Especificação funcional e técnica para orientar a implementação do DMS.
> Este documento descreve o trabalho futuro; não implementa arquivos de
> backend ou frontend.

## 1. Objetivo

Permitir que usuários enviem, consultem e baixem seus documentos por meio de
uma aplicação web que armazena os arquivos localmente e mantém seus metadados em
memória.

## 2. Escopo

### Dentro do escopo

- Enviar um arquivo por requisição.
- Listar os documentos do usuário identificado no contexto da aplicação.
- Baixar um documento pertencente ao usuário identificado.
- Exibir no frontend a lista, os estados vazio/carregando e os erros das
  operações.
- Armazenar o conteúdo em `backend/storage` usando `multer` com `diskStorage`.
- Manter metadados em memória durante a execução do processo.

### Fora do escopo

- Armazenamento externo, nuvem, banco de dados ou persistência de metadados em
  disco.
- Versionamento, edição, exclusão ou compartilhamento de documentos.
- Cadastro de usuários, autenticação ou implementação de um provedor de
  identidade.
- Endpoints além dos três definidos nesta especificação.
- Restrições por extensão ou lista de tipos de arquivo. Todos os tipos de
  arquivo são aceitos, sujeitos ao limite de tamanho e à validação de upload.

### Premissas de identidade e propriedade

- O backend obtém o identificador `owner` de `DOCUMENT_OWNER_ID`, configurado no
  servidor, com padrão `default` quando a variável não estiver definida.
- O cliente nunca define o owner por campo, query parameter ou cabeçalho.
- Esta fase usa um owner único por instância, sem autenticação ou isolamento
  entre clientes. Todas as chamadas à instância podem operar nos mesmos
  documentos; proteção de acesso é responsabilidade da infraestrutura.

## 3. Requisitos funcionais

| ID     | Requisito |
| ------ | --------- |
| RF-01  | O usuário pode enviar um arquivo usando o campo multipart `file`. A requisição aceita exatamente um arquivo. |
| RF-02  | O sistema rejeita upload sem arquivo, com mais de um arquivo ou acima do limite configurado, informando um erro HTTP apropriado. |
| RF-03  | No upload bem-sucedido, o sistema gera um identificador único, registra os metadados em memória, grava o arquivo no armazenamento local e retorna `201 Created` com os metadados. |
| RF-04  | O sistema associa cada documento ao owner configurado no servidor; o cliente não pode atribuir ou alterar `owner`. |
| RF-05  | A API lista todos os documentos da instância. A resposta é ordenada por `uploadedAt` decrescente e, em caso de empate, por `id` crescente. |
| RF-06  | Todas as chamadas da instância usam o mesmo owner. Se não houver documentos, a listagem retorna uma lista vazia com `200 OK`. |
| RF-07  | A API permite baixar um documento da instância informando seu identificador. A resposta contém o conteúdo binário e usa o nome original como nome de download. |
| RF-08  | O sistema retorna `404 Not Found` para identificador desconhecido ou documento indisponível. |
| RF-09  | Se a gravação do arquivo ou o registro de metadados falhar durante o upload, a operação não é considerada concluída; um arquivo parcial ou sem metadados deve ser removido quando possível e o erro deve ser reportado. |
| RF-10  | O frontend permite selecionar e enviar um arquivo, apresenta o resultado da operação, atualiza a lista após upload bem-sucedido e permite iniciar o download dos documentos listados. |
| RF-11  | O frontend informa os estados de carregamento, lista vazia e falha de rede/servidor sem apresentar uma operação com falha como bem-sucedida. |

## 4. Requisitos não funcionais

| ID      | Requisito |
| ------- | --------- |
| RNF-01  | Os arquivos são gravados exclusivamente no filesystem local da aplicação, em `backend/storage`, usando `multer` configurado com `diskStorage`. Não usar serviços ou provedores externos. |
| RNF-02  | Os metadados são mantidos em memória. Uma reinicialização do processo remove os registros; arquivos que permaneçam no diretório sem metadados não aparecem na API. |
| RNF-03  | O limite máximo inicial por arquivo é `10 MiB` (`10485760` bytes), configurável pela variável `MAX_FILE_SIZE_BYTES`. O limite é aplicado no Multer e valores inválidos na configuração devem impedir a inicialização com erro explícito. |
| RNF-04  | A porta HTTP é configurada por `PORT`, com padrão `3000`, conforme o seed do backend. |
| RNF-05  | Os diretórios de armazenamento necessários devem existir ou ser criados localmente antes da gravação. Falha de criação ou escrita é tratada como erro, não como sucesso. |
| RNF-06  | O nome fornecido pelo usuário não pode ser usado como caminho de armazenamento. O arquivo deve receber nome interno único derivado do identificador ou outro nome gerado pelo sistema, evitando travessia de diretório e colisões. |
| RNF-07  | O nome original pode ser retornado como metadado e usado no cabeçalho de download, mas deve ser codificado/formatado com segurança para cabeçalhos HTTP. Caminhos internos do servidor não são expostos em respostas. |
| RNF-08  | Todos os horários são representados em UTC no formato ISO 8601. O tamanho é expresso em bytes como inteiro não negativo. |
| RNF-09  | O backend segue a Clean Architecture simples: `routes -> controllers -> services -> repositories`. Regras de negócio não dependem de Express nem de detalhes de filesystem. |
| RNF-10  | O frontend usa componentes funcionais React e `fetch`. Em desenvolvimento, chamadas com prefixo `/api` são encaminhadas pelo proxy Vite para o backend, removendo esse prefixo. |
| RNF-11  | Respostas JSON de erro não incluem stack trace, caminho local, conteúdo de arquivo ou detalhes internos de filesystem. Erros internos devem ser registrados pelo backend sem serem ocultados por respostas de sucesso. |
| RNF-12  | Como os metadados são em memória e não há coordenação entre instâncias, a implementação inicial destina-se a um único processo backend. Não há garantia de disponibilidade ou recuperação dos metadados após reinicialização. |

### Configuração

| Variável | Padrão | Uso |
| -------- | ------ | --- |
| `PORT` | `3000` | Porta HTTP do backend. |
| `MAX_FILE_SIZE_BYTES` | `10485760` | Tamanho máximo permitido para um arquivo enviado. Deve ser inteiro positivo. |

O caminho de armazenamento desta fase é fixo em `backend/storage`; não é
substituído por configuração de armazenamento externo.

## 5. Modelo de dados (metadados do documento)

Os metadados são mantidos em uma coleção em memória, acessada pela camada de
repositório.

| Campo | Tipo | Obrigatório | Descrição |
| ----- | ---- | ----------- | --------- |
| `id` | string | Sim | Identificador único, gerado pelo servidor (UUID). |
| `originalName` | string | Sim | Nome original informado no upload, mantido apenas como metadado e nome de apresentação/download. |
| `size` | number | Sim | Tamanho do arquivo persistido em bytes; inteiro não negativo. |
| `uploadedAt` | string | Sim | Data/hora de recebimento do upload em ISO 8601 UTC, por exemplo `2026-10-26T19:17:06.198Z`. |
| `owner` | string | Sim | Identificador configurado pelo servidor via `DOCUMENT_OWNER_ID` (padrão `default`). |

O caminho/nome interno usado no filesystem é detalhe de persistência do
repositório e não deve ser incluído na representação pública do documento.
Metadados públicos têm a forma:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "originalName": "relatorio.pdf",
  "size": 24576,
  "uploadedAt": "2026-10-26T19:17:06.198Z",
  "owner": "user-123"
}
```

## 6. Contratos de API

Os caminhos abaixo são relativos ao backend. No frontend de desenvolvimento,
usar o prefixo `/api` (por exemplo, `/api/documents`); o proxy Vite remove o
prefixo antes de encaminhar a chamada. Respostas de erro seguem o formato:

```json
{
  "error": {
    "code": "FILE_REQUIRED",
    "message": "Envie um arquivo no campo file."
  }
}
```

As mensagens podem ser localizadas, mas o campo `code` é estável para tratamento
programático. O servidor não deve retornar detalhes internos em `message`.

### POST `/upload`

- **Objetivo:** receber um arquivo e criar metadados do documento.
- **Content-Type:** `multipart/form-data`.
- **Entrada:** uma parte de arquivo chamada `file`. Campos `owner` ou caminho de
  destino enviados pelo cliente são ignorados ou rejeitados; não alteram a
  propriedade nem o destino de armazenamento.
- **Sucesso — `201 Created`:**

```json
{
  "document": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "originalName": "relatorio.pdf",
    "size": 24576,
    "uploadedAt": "2026-10-26T19:17:06.198Z",
    "owner": "user-123"
  }
}
```

- **Erros:**

| HTTP | Código | Situação |
| ---- | ------ | -------- |
| `400` | `FILE_REQUIRED` | Campo `file` ausente ou arquivo vazio. |
| `400` | `INVALID_MULTIPART` | Requisição multipart inválida ou múltiplos arquivos enviados. |
| `413` | `FILE_TOO_LARGE` | Arquivo excede `MAX_FILE_SIZE_BYTES`. |
| `500` | `UPLOAD_FAILED` | Falha ao gravar o arquivo ou registrar os metadados. |

### GET `/documents`

- **Objetivo:** listar documentos associados ao owner configurado para a instância.
- **Entrada:** sem corpo. Não aceita parâmetro para selecionar outro proprietário.
- **Sucesso — `200 OK`:**

```json
{
  "documents": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "originalName": "relatorio.pdf",
      "size": 24576,
      "uploadedAt": "2026-10-26T19:17:06.198Z",
      "owner": "user-123"
    }
  ]
}
```

- Quando não houver documentos, retornar `{"documents":[]}`.
- **Erros:** `500 DOCUMENT_LIST_FAILED` em falha inesperada ao obter a lista.

### GET `/documents/:id/download`

- **Objetivo:** transmitir o arquivo correspondente ao owner da instância.
- **Entrada:** `id` no caminho; não aceita caminho de filesystem do cliente.
- **Sucesso — `200 OK`:** corpo binário, `Content-Type:
  application/octet-stream`, `Content-Length` correspondente ao tamanho
  armazenado e `Content-Disposition: attachment` com `originalName` codificado
  com segurança.
- **Erros:** `404 DOCUMENT_NOT_FOUND` quando o documento não existir ou não
  puder ser localizado no armazenamento; `500 DOWNLOAD_FAILED` em falha
  inesperada de leitura. Respostas de erro usam o formato JSON padrão.

### Códigos de erro

| Código | Significado |
| ------ | ----------- |
| `FILE_REQUIRED` | Arquivo obrigatório ausente ou vazio. |
| `INVALID_MULTIPART` | Formato multipart inválido ou quantidade de arquivos não permitida. |
| `FILE_TOO_LARGE` | Limite configurado de upload excedido. |
| `UPLOAD_FAILED` | Falha durante gravação ou registro do upload. |
| `DOCUMENT_LIST_FAILED` | Falha inesperada ao consultar os metadados. |
| `DOCUMENT_NOT_FOUND` | Documento não encontrado, não pertencente ao usuário ou indisponível no filesystem. |
| `DOWNLOAD_FAILED` | Falha inesperada ao transmitir o arquivo. |

## 7. Decisões arquiteturais

### Backend

O fluxo de dependência é `routes -> controllers -> services -> repositories`.

| Camada | Responsabilidade |
| ------ | ---------------- |
| `routes/` | Declarar `/upload`, `/documents` e `/documents/:id/download`; conectar middlewares e controllers sem regras de negócio. |
| `controllers/` | Ler os dados HTTP, usar o owner atribuído pelo backend, validar formato básico da requisição e mapear resultado/erro para status e resposta HTTP. |
| `services/` | Aplicar regras de upload, propriedade, listagem e download; não depender de Express ou de detalhes de persistência. |
| `repositories/` | Persistir e recuperar arquivos em `backend/storage` com filesystem local e metadados em memória; ocultar esses detalhes das camadas internas. |

O middleware de upload usa `multer` com `diskStorage`, limite configurado e
nome interno gerado pelo sistema. O repositório expõe apenas operações
necessárias ao serviço. O controller não acessa o filesystem diretamente.

### Frontend

- Organizar a interface em componentes funcionais React dentro das áreas
  existentes `components/`, `pages/` e `services/`.
- O serviço de API usa `fetch` e prefixo `/api`; não reproduz regras de
  propriedade ou persistência no navegador.
- A interface deve permitir upload, listagem e download e apresentar erros
  recebidos da API sem expor detalhes internos.

### Persistência e consistência

- Arquivos ficam no filesystem local em `backend/storage`; metadados ficam em
  memória apenas enquanto o processo está ativo.
- A API só considera disponível um documento que possua metadados válidos e
  arquivo correspondente. Arquivos órfãos não são listados nem baixados.
- Uma falha durante o upload deve tentar remover o arquivo incompleto/órfão.
  Limpeza geral de órfãos, recuperação após reinicialização e sincronização
  entre múltiplos processos estão fora desta fase.

## 8. Plano de execução

As etapas abaixo orientam uma implementação futura e **não fazem parte da
execução desta tarefa**, cujo entregável é somente este documento.

1. Definir e testar o modelo de metadados, os códigos de erro e as regras de
   propriedade, incluindo a configuração server-side do owner.
2. Implementar o repositório local: `diskStorage` do Multer, diretório
   `backend/storage`, metadados em memória e tratamento de falhas/limites.
3. Implementar os serviços de upload, listagem e download sem dependência de
   HTTP ou Express.
4. Implementar controllers e rotas Express para os três contratos, incluindo
   mapeamento consistente de erros e uso do owner configurado na instância.
5. Cobrir regras e contratos do backend com testes unitários e de integração,
   incluindo falhas de filesystem, limites e tentativas de alterar owner pelo cliente.
6. Construir a interface React para upload, listagem, estados de carregamento e
   vazio, erros e download.
7. Integrar o frontend pela API `/api` via proxy Vite e validar o fluxo completo
   com o backend local.
8. Executar os testes e build pertinentes, revisar a documentação operacional e
   confirmar que o armazenamento continua exclusivamente local.
