# Plano: App de Organização de Tarefas Domésticas

## Visão geral
App em página única que reproduz a planilha enviada, com 4 usuários fixos (Miguel, Davi, Danelle, Eduardo). Cada usuário tem suas tarefas distribuídas pelos dias da semana (Segunda a Sábado). É possível adicionar novas tarefas e gerar um PDF/impressão em A4 da planilha de cada usuário.

## Manutenção do design
- Mantidas as cores atuais do design system (tokens em `src/styles.css`, sem alterações).
- Layout fiel à planilha: cabeçalho "Uma casa organizada é uma casa feliz 😊", nome do usuário, campo "Semana: ____", grade 3x2 dos dias (Seg/Ter/Qua / Qui/Sex/Sáb) com checkboxes.

## Estrutura
- Rota única `/` (`src/routes/index.tsx`) com abas/seletor por usuário.
- Dados iniciais (tarefas extraídas da planilha) em `src/lib/initial-tasks.ts`.
- Estado persistido em `localStorage` (sem backend) — checkboxes marcados e tarefas adicionadas ficam salvos no navegador.
- Componentes:
  - `UserTabs` — alterna entre os 4 usuários.
  - `WeekGrid` — grade dos 6 dias.
  - `DayCard` — lista de tarefas do dia + botão "+ Adicionar tarefa" (input inline).
  - `PrintSheet` — versão imprimível A4 (oculta na tela, visível só no print).

## Funcionalidades
1. **Checkboxes**: marcar/desmarcar tarefas (estado persistido).
2. **Adicionar tarefa**: botão por dia/usuário abre input para nova tarefa.
3. **Remover tarefa**: ícone de lixeira por tarefa (apenas tarefas adicionadas pelo usuário; as originais também podem ser removidas se desejado — confirmar).
4. **Imprimir / Gerar PDF**: botão "Imprimir planilha" por usuário usa `window.print()` com CSS `@media print` configurado para A4 paisagem (mesma orientação da planilha original), escondendo navegação e mostrando só a folha do usuário ativo. O usuário salva como PDF pelo diálogo de impressão do navegador.

## Impressão A4
- `@page { size: A4 landscape; margin: 10mm }` em `src/styles.css`.
- Classes utilitárias `print:hidden` e `print:block` para alternar elementos.
- Grade dos dias em 3 colunas x 2 linhas, com tipografia ajustada para caber em uma página.

## Pontos a confirmar
- Manter exatamente os 4 usuários atuais sem opção de adicionar/editar usuários? (entendi que sim)
- Tarefas originais devem ser removíveis ou somente as adicionadas?
