Plano de melhorias de UX — Cesar Home Plan

Objetivo: tornar o app mais confiável e agradável no dia a dia da família, mantendo o layout atual da planilha semanal.

Melhorias selecionadas (prioridade do usuário):
1. Confirmação e feedback visual
2. Indicador de sincronização e modo offline

---

1. CONFIRMAÇÃO E FEEDBACK VISUAL

Problema: hoje, ao clicar na lixeira, a tarefa some imediatamente. Crianças podem apagar tarefas por engano, e o usuário não recebe confirmação de que a ação funcionou.

Solução:
- Adicionar diálogo de confirmação ao excluir uma tarefa (tanto as tarefas originais quanto as adicionadas).
- Usar toast (Sonner) para confirmar ações: tarefa adicionada, tarefa removida, tarefa editada, tarefa marcada como concluída, desfazer aplicado.
- Garantir que o botão "Desfazer" no cabeçalho mostre no tooltip a ação que será revertida.

O que muda na tela:
- Um alert-dialog do Radix (já disponível no projeto) aparece ao clicar na lixeira, com botões "Cancelar" e "Excluir".
- Toasts discretos no canto superior direito (ou inferior em mobile) para cada ação importante.
- Nenhuma mudança na posição dos botões, no grid de dias ou na impressão.

---

2. INDICADOR DE SINCRONIZAÇÃO E MODO OFFLINE

Problema: o app sincroniza via Supabase, mas o usuário não sabe se a última ação já foi salva na nuvem, se está offline ou se houve erro de rede. Em uma família com vários aparelhos, isso gera dúvida se a outra pessoa já vai ver a mudança.

Solução:
- Adicionar um indicador de status no cabeçalho (próximo aos botões de imprimir/desfazer):
  - "Sincronizado" — última ação salva no Supabase.
  - "Salvando..." — ação em andamento.
  - "Offline — salvo localmente" — quando o navegador perde conexão.
  - "Falha ao sincronizar" — quando o Supabase retorna erro; com botão "Tentar novamente".
- Escutar eventos `online`/`offline` do navegador.
- Manter as ações que falharem em uma fila local e tentar reenviar automaticamente quando voltar online (usando localStorage + debounce).
- Mostrar timestamp do último sync bem-sucedido ("Visto por todos há X segundos").

O que muda na tela:
- Pequeno badge/status no cabeçalho, à direita dos botões de ação.
- Em mobile, o status pode ficar abaixo do título para não comprimir os botões.
- Sem alteração no grid, abas ou impressão.

---

Melhorias futuras (não incluídas neste plano, para próximos passos):
- Reset semanal: botão para desmarcar todas as tarefas e começar uma nova semana.
- Destaque do dia atual e progresso semanal: mostrar dia de hoje e quantas tarefas faltam.
- Exportar/backup dos dados para JSON.
- Reordenar tarefas por arrastar e soltar dentro do mesmo dia.
- Lembretes diários via notificação push (requer permissão do navegador).

---

Implementação técnica resumida:
- Adicionar `<Toaster />` do Sonner em `src/routes/__root.tsx` (o componente já existe em `src/components/ui/sonner.tsx`).
- Em `src/routes/index.tsx`:
  - Criar estado de sync (`idle`, `saving`, `saved`, `offline`, `error`).
  - Monitorar `navigator.onLine` e eventos de rede.
  - Enfileirar mutações que falharam e reenviar no `online`.
  - Chamar `toast.success()` / `toast.error()` / `toast()` após ações.
  - Substituir remoção direta por `AlertDialog` para confirmação.
- Ajustar testes Playwright existentes para lidar com o diálogo de confirmação ao remover tarefas.
- Nenhuma mudança no banco de dados é necessária.

---

Critérios de aceitação:
- Ao excluir uma tarefa, o app pede confirmação e, após confirmar, exibe toast "Tarefa removida".
- Ao adicionar/editar/marcar uma tarefa, aparece toast de confirmação breve.
- O status de sync mostra "Salvando..." durante a ação e "Sincronizado" após sucesso.
- Se desligar a internet, o status muda para "Offline" e as ações continuam funcionando localmente; ao voltar online, reenviam automaticamente.
- Se ocorrer erro no Supabase, o status mostra "Falha ao sincronizar" com opção de tentar novamente.
- O layout visual da planilha, dos cards de dias e da impressão permanece inalterado.