# Document Management System com GitHub Copilot

<img src="https://octodex.github.com/images/Professortocat_v2.png" align="right" height="200px" />

Hey mcurisilva!

Mona here. I'm done preparing your exercise. Hope you enjoy! 💚

Remember, it's self-paced so feel free to take a break! ☕️

[![](https://img.shields.io/badge/Go%20to%20Exercise-%E2%86%92-1f883d?style=for-the-badge&logo=github&labelColor=197935)](https://github.com/treinamentos-serpro/document-management-system-marcelo-curi/issues/1)

---

## Backend DMS

Execute `npm start` em `backend` (porta padrão `3000`, configurável por `PORT`).
Execute `npm test` no mesmo diretório para validar o backend.

- `POST /upload`: recebe um arquivo não vazio no campo multipart `file` e retorna
  `201` com `{ "document": { ... } }`.
- `GET /documents`: retorna `{ "documents": [...] }` do owner configurado,
  em ordem de envio decrescente.
- `GET /documents/:id/download`: baixa um documento da instância com o nome
  original; documentos inexistentes retornam `404`.
- `GET /health`: mantém a verificação de saúde pública.

O backend associa todos os documentos a `DOCUMENT_OWNER_ID`, configurável no
servidor (padrão: `default`). As rotas não dependem de `req.user.id` nem exigem
contexto de identidade externo. Campos, query parameters ou cabeçalhos enviados
pelo cliente não definem o owner. Esta configuração identifica a instância, não
autentica clientes: todas as chamadas que alcançam o backend compartilham os
mesmos documentos; configure controle de acesso na infraestrutura se necessário.

Os arquivos são gravados exclusivamente em `backend/storage`, criado
automaticamente, com nomes internos UUID. Os metadados ficam em memória e se
perdem ao reiniciar o processo; arquivos remanescentes não reaparecem na API.
`MAX_FILE_SIZE_BYTES` configura o limite por arquivo (padrão: `10485760`, 10 MiB)
e deve ser um inteiro positivo seguro; configuração inválida impede o início.
Falhas retornam `{ "error": { "code": "...", "message": "..." } }`, conforme a
[especificação](docs/specs/dms-spec.md).

O multipart aceita um arquivo e até 10 campos auxiliares de até 1 KiB cada;
esses campos não definem proprietário ou destino. O parser também interrompe
formulários que atinjam 12 partes. Formulários que excedem os limites são rejeitados com
`400 INVALID_MULTIPART`, com tentativa de remoção do arquivo rejeitado.

A configuração do armazenamento fica em `backend/src/config/storage.js`; o
Multer fica no middleware de entrada, não no repositório. Controllers convertem
os dados do Multer para `{ originalName, size, storageKey }` antes de chamar o
serviço. O repositório valida as chaves internas UUID e verifica os arquivos da
listagem em lotes de até 10, preservando a resposta completa e sua ordenação.
Erros HTTP são tratados por um middleware central, inclusive JSON e URLs
malformados. O download continua usando o Express, com suporte a requisições
parciais (`Range`).

Esta fase continua sem autenticação, quota total ou recuperação de metadados.
O limite por arquivo e os limites multipart não impedem uploads repetidos de
esgotarem o disco. Use apenas um processo backend, proteja a API na
infraestrutura, limite frequência/concorrência no proxy e monitore espaço livre.
Arquivos órfãos após reinício exigem uma política operacional de limpeza;
não são apagados automaticamente.

## Frontend DMS

Execute `npm run dev` em `frontend` e abra `http://localhost:5173`.
O proxy Vite encaminha `/api` para `http://localhost:3000`, removendo o prefixo.
Em produção, configure o servidor web para encaminhar `/api` ao backend da
mesma forma; o proxy de desenvolvimento não faz parte do build.

A interface permite enviar um arquivo, atualiza a lista após o envio e baixa
os documentos com seus nomes originais. Estados de carregamento, lista vazia e
erros são exibidos em português; a lista pode ser atualizada manualmente para
tentar novamente após uma falha.

O serviço de API valida os envelopes e metadados recebidos antes de entregá-los
à interface. Respostas JSON válidas com estrutura inválida são apresentadas como
erro, em vez de causarem falhas de renderização. `ApiError` preserva `status` e
`code` quando disponíveis; cancelamentos continuam sendo propagados.

O cliente não envia um proprietário nem implementa autenticação. O owner é
definido exclusivamente pelo backend e compartilhado por todas as chamadas à
instância.

Execute `npm test` em `frontend` para validar o cliente de API e `npm run build`
para gerar o bundle de produção.

&copy; 2025 GitHub &bull; [Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md) &bull; [MIT License](https://gh.io/mit)
