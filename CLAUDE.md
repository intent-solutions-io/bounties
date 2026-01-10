# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a bounty hunting workspace containing clones of open source projects with active bounty programs. Each subdirectory is a separate project with its own stack and contribution guidelines.

## Task Tracking with Beads

```bash
bd sync                           # Sync with git
bd list --status in_progress      # What was I working on?
bd ready                          # Available bounties
bd update <id> --status in_progress  # Before starting work
bd close <id> --reason "PR #123"     # After completing
```

## Project Directory

| Directory | Stack | Bounties | Notes |
|-----------|-------|----------|-------|
| `gumroad/` | Ruby/Rails + React/TS | $1,500/file | Tailwind CSS migration |
| `screenpipe/` | Rust + Tauri + TS/Bun | $25-500 | AI/screen recording |
| `posthog/` | Python/Django + React/TS | Varies | Analytics platform |
| `calcom/` | TypeScript/Next.js | $20-500 | Scheduling platform |
| `filament/` | PHP/Laravel | Varies | Admin panel |
| `feishin/` | TypeScript/React | Varies | Music player |
| `appsmith/` | Java + React/TS | Varies | Low-code platform |
| `shadcn-ui/` | TypeScript/React | Varies | Component library |

## Tracking

- `bounty-tracker.csv` - Master spreadsheet of all bounties with status
- Check for competing PRs before starting work on any bounty

## Project-Specific Quick Reference

### Gumroad (Primary Target - $1,500/file)

**Bounty**: SCSS to Tailwind migration per file ([Issue #1055](https://github.com/antiwork/gumroad/issues/1055))

```bash
cd gumroad
bundle install && npm install
make build                         # Docker build
docker compose -f docker-compose-local.yml up  # Local dev
```

**Tailwind Migration Rules**:
- No `@apply` directives - classes in markup only
- No arbitrary values without justification
- Mobile-first responsive (`sm:`, `md:`, `lg:` only where values change)
- Use `classNames()` utility, not `cx` or ternaries
- No `!important` bang modifiers

**PR Requirements**:
- Before/after screenshots (light/dark, mobile/desktop)
- Video demonstration
- E2E tests
- AI disclosure
- Self-review comments

**Commit Format**: `feat(scope): title` (Conventional Commits)

### Screenpipe ($25-500 bounties via Algora)

```bash
cd screenpipe
cargo build                        # Rust core
cd screenpipe-app-tauri && bun install && bun run dev  # Tauri app
```

**Style**:
- Rust: anyhow errors, tokio async, prefer channels over mutex
- TS: NextJS + Tailwind + shadcn + lucide + framer-motion
- Lowercase for all logging and UI text
- No toast errors - use empty states, skeletons, inline errors

### PostHog

```bash
cd posthog
flox activate -- pytest path/to/test.py::TestClass::test_method  # Single test
ruff check . --fix && ruff format .  # Python lint
pnpm --filter=@posthog/frontend test  # Frontend tests
```

### CalCom

```bash
cd calcom
yarn install
yarn dev                           # Development
yarn test                          # Tests
```

## Bounty Hunting Workflow

1. **Research**: Check `bounty-tracker.csv` for open bounties
2. **Verify**: Check GitHub for competing PRs on the target issue
3. **Claim**: Comment on issue or use `/bounty` on Algora
4. **Track**: `bd update <id> --status in_progress`
5. **Develop**: Follow project-specific guidelines above
6. **Submit**: PR with required screenshots/videos
7. **Close**: `bd close <id> --reason "PR #xyz"`

## Payment

- **Gumroad**: Email `bounties@antiwork.com` after merge
- **Algora**: Platform handles payment automatically
