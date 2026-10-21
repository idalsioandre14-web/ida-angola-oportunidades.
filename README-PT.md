# IDA Angola Oportunidades — publicação no Render

## O que está incluído
- Página pública de vagas aprovadas.
- Formulário gratuito para submeter vagas; todas ficam pendentes até aprovação do criador.
- Área privada do criador com sessão no servidor, cookies HttpOnly/SameSite, limite de tentativas de login e palavra-passe verificada por hash bcrypt.
- PostgreSQL para vagas e sessões.
- Vagas externas apresentadas com resumo e botão para abrir o anúncio original. A inserção deve respeitar os termos de cada fonte; este pacote não faz scraping automático.

## Importante sobre o plano gratuito
Os serviços gratuitos podem adormecer e as bases de dados gratuitas podem ter limites ou prazo de expiração. Confirma as condições atuais do Render antes de usar dados importantes. Para operação contínua, escolhe uma base de dados persistente e faz cópias de segurança.

## Publicar
1. Cria uma conta em https://github.com/signup e outra em https://dashboard.render.com/register
2. Cria um repositório no GitHub e envia os ficheiros deste ZIP para a raiz do repositório.
3. No Render, escolhe **New + → Blueprint**, liga o GitHub e seleciona o repositório. O Render lê `render.yaml`.
4. Antes de publicar, prepara o e-mail do criador e o hash bcrypt da palavra-passe. Não coloques a palavra-passe em texto no código.
5. Para gerar o hash num computador com Node.js: executa `npm install` e depois `npm run hash-password`. No telemóvel Android, podes gerar o hash num ambiente Node confiável ou num computador; não uses sites desconhecidos para palavras-passe.
6. No Render, abre o serviço → **Environment** e define `CREATOR_EMAIL` e `CREATOR_PASSWORD_HASH` com o e-mail e hash gerados. O `SESSION_SECRET` é gerado pelo Blueprint. Nunca partilhes esses valores.
7. Confirma a criação da base de dados e o deploy. Abre o endereço `onrender.com` do serviço e testa o formulário e a área do criador.

## Limitações atuais
- Não há importação automática de vagas externas: adiciona vagas externas pelo formulário de submissão, usando um resumo original, nome da fonte e link autorizado.
- A base de dados gratuita do Render pode ser temporária. Não publiques informações sensíveis e mantém backups.
- Antes de produção, recomenda-se adicionar proteção CSRF, verificação de e-mail, moderação anti-spam e testes de segurança adicionais.
