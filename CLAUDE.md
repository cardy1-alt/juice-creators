# Nayba — Claude Code Instructions

## Design authority
All design decisions are defined in NAYBA_REVERT.txt. When making any visual changes, follow that file exclusively. Do not infer design patterns from any other source.

## Hard rules
- No swipe, stack, or tinder-style UI patterns anywhere in this app
- The explore/discovery feed is a vertical scroll feed with horizontal card rows
- Corben 400 is used for the wordmark in Logo.tsx and section/page titles only
- All other fonts use Instrument Sans — no Plus Jakarta Sans anywhere
- Background is #F6F3EE — never pure white
- Terra (#C4674A) is the only accent colour

## Architecture
- Single-page app, state-based routing via App.tsx
- No React Router
- CreatorApp.tsx contains the full creator experience
- BusinessPortal.tsx contains the full business experience
- Do not restructure routing without explicit instruction
