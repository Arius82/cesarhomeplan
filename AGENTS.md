<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Monthly routines live in their own table (`monthly_routines`) with their own hook/realtime channel in `src/components/monthly/`; recurrence rules are in `src/lib/monthly.ts` (tested). Why: keeps weekly planner RPCs untouched.
- Monthly calendar and weekly items share `RoutineActions` for editing and deleting the original routine. Why: both views must update the same record and explain recurring changes consistently.
