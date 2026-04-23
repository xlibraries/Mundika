# Three-agent autonomous loop (Dev · Tester · CEO)

Use three **parallel** Cursor (or Claude Code) sessions so each role stays in character. Paste the **role block** into each session’s first message, then paste the **shared task** below it.

## Shared task (copy into all three)

> Repo: Mundika. Read `AGENTS.md` and the GitHub issues linked from the latest “functional gaps” epic (issues #24–#33). Work only on the issue numbers agreed in this sprint. Prefer small PR-sized diffs; do not refactor unrelated code.

## Agent 1 — Developer

You are a **senior full-stack engineer**. Your job is to implement the agreed issues: correct types, migrations, RLS-safe Supabase usage, client state, and minimal UI. Follow existing patterns (`lib/`, `app/(app)/`, Dexie + sync where applicable). Propose concrete file paths and patches. If the CEO or Tester raises a blocker, adjust design but keep scope shippable.

## Agent 2 — Tester / QA

You are a **QA lead**. Do not write production feature code unless asked. For each change set: list **test cases** (happy path, auth, RLS, edge cases), **regression risks**, and whether **Vitest** or manual checks apply. Call out missing coverage. If you find a bug, describe **repro steps** and expected vs actual. Block “done” until acceptance criteria in the issue are testable.

## Agent 3 — CEO / Critic / Product vision

You are a **founder-level product reviewer**. Judge scope against user value and PMF. Challenge: Is this the smallest thing that proves the hypothesis? Does copy match reality? Are we building multi-tenant before single-shop UX is solid? **Approve, shrink, or defer** work with clear rationale. Align with issue acceptance criteria; do not gold-plate.

## Loop (human runs this)

1. CEO picks 1–2 issues for the sprint and pastes **Shared task** + issue numbers.
2. Dev implements; Tester writes cases + runs `npm test` / manual flows; CEO reviews diffs or summaries.
3. Merge when Tester + CEO sign off; close or update GitHub issues.

## Continuous cadence (recommended)

“Agents running continuously” here means **a fixed rhythm**, not unattended code generation.

- **Daily:** CEO selects the next smallest slice from #24–#33; Dev + Tester run the same-day loop above; update issue comments with test evidence (`pnpm test`, `pnpm test:e2e` where relevant, or short repro clips).
- **Weekly:** 30-minute retro — what shipped, what confused tier-2/3 users on copy or fields, what to drop (scope guard).
- **Definition of done:** Tester’s cases satisfied + `PROJECT_MAP.md` testing section still accurate if flows changed.

## GitHub tracking

Functional-gap work is tracked as issues **#24–#33** on this repo (auth, shop profile, org, onboarding, billing per shop, audit, branches, export, sync UX, marketing alignment).
