# Praça Segura — Recife

Mini app acadêmico para participação cidadã e registro demonstrativo de problemas em espaços públicos do Recife.

## Requisitos
- Node.js 18 ou superior
- npm

## Como executar

```bash
npm install
npm run dev
```

Abra o endereço local exibido pelo Vite (normalmente http://localhost:5173).

## Como gerar a versão de apresentação

```bash
npm run build
npm run preview
```

## O que já funciona nesta versão
- Navegação entre Início, Praças, Ocorrências e Sobre.
- Lista demonstrativa de praças do Recife.
- Formulário de registro de ocorrência.
- Anexo opcional de imagem (limite de 1,5 MB nesta demonstração).
- Geração de protocolo e consulta dos registros.
- Filtros por praça e busca textual.
- Painel administrativo demonstrativo para atualizar status.
- Persistência local no navegador via `localStorage`.
- Layout responsivo para celular e computador.

## Limitações importantes
Esta é uma primeira versão de demonstração. Os registros ficam apenas no navegador em que foram criados. Não há login real, banco de dados remoto, envio à Prefeitura do Recife, geolocalização validada, nem canal 0800 integrado. O painel administrativo não tem autenticação e não deve ser usado em produção.

## Próxima etapa técnica
Integrar Supabase para autenticação, banco de dados, armazenamento de imagens e políticas de acesso. Antes de qualquer implantação pública, validar a lista de praças, categorias, fluxo de atendimento e canal institucional com a Prefeitura.

## Dados de demonstração
A lista de praças e as ocorrências iniciais são exemplos para apresentação acadêmica. Devem ser conferidos antes de serem tratados como cadastro oficial ou informação atualizada.
