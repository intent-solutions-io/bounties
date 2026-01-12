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
| `cortex/` | Python 3.10+ | $50-200 | AI-native OS - CLA required |
| `screenpipe/` | Rust + Tauri + TS/Bun | $25-500 | AI/screen recording |
| `posthog/` | Python/Django + React/TS | Varies | Analytics platform |
| `calcom/` | TypeScript/Next.js | $20-500 | Scheduling platform |
| `tldraw/` | TypeScript/React | Varies | Drawing library |
| `filament/` | PHP/Laravel | Varies | Admin panel |
| `feishin/` | TypeScript/React | Varies | Music player |
| `appsmith/` | Java + React/TS | Varies | Low-code platform |
| `shadcn-ui/` | TypeScript/React | Varies | Component library |

## Tracking

- `000-docs/002-PM-BKLG-bounty-tracker.csv` - Master spreadsheet with status
- `surgical-bounties.md` - Curated list of small, template-based bounties
- Always check GitHub for competing PRs before starting work

## Project-Specific Quick Reference

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

### Cortex ($50-200 bounties)

**CLA Required**: Must sign before first PR - see [CLA.md](cortex/CLA.md)

```bash
cd cortex
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
pip install -e .                   # Development install
pytest tests/ -v                   # Run tests
pytest tests/ --cov=cortex --cov-report=html  # Coverage
black cortex/ --check              # Check formatting
```

**PR Requirements**:
- Demo video (before/after for bugs, feature demo for new work)
- AI disclosure in PR template
- Tests with >80% coverage
- No force push - use merge commits only

### PostHog

```bash
cd posthog
flox activate -- pytest path/to/test.py::TestClass::test_method  # Single test
ruff check . --fix && ruff format .  # Python lint
pnpm --filter=@posthog/frontend test  # Frontend tests
pnpm --filter=@posthog/frontend typescript:check  # TypeScript check
```

**Style**:
- Python: Type hints required, snake_case
- Frontend: TypeScript required, Tailwind over inline styles
- Use Sentence casing for product names (e.g., "Product analytics" not "Product Analytics")
- Conventional commits: `feat(scope): description`, `fix(scope): description`, `chore: description`

### CalCom

```bash
cd calcom
yarn install
yarn dev                           # Development
yarn test                          # Tests
```

### Tldraw

```bash
cd tldraw
yarn install
yarn dev                           # Development
yarn test                          # Tests
```

**Style**: TypeScript, uses yarn workspaces (monorepo)

## Cloud Dev Environment

**ALWAYS use the cloud VM for development and testing** - do not run heavy tests locally.

```bash
# SSH into bounty-dev VM
gcloud compute ssh bounty-dev --zone=us-central1-a

# Run command on VM without interactive shell
gcloud compute ssh bounty-dev --zone=us-central1-a --command="<command>"

# Example: Run tests on VM
gcloud compute ssh bounty-dev --zone=us-central1-a --command="cd vertex-ai-samples && pytest"
```

**VM Details:**
- Name: `bounty-dev`
- Zone: `us-central1-a`
- Type: `e2-standard-4`
- Use for: Running tests, linting, notebook validation, heavy builds

## Bounty Hunting Workflow

1. **Research**: Check `000-docs/002-PM-BKLG-bounty-tracker.csv` for open bounties
2. **Verify**: Check GitHub for competing PRs on the target issue
3. **Claim**: Comment on issue or use `/bounty` on Algora
4. **Track**: `bd update <id> --status in_progress`
5. **Develop**: Follow project-specific guidelines above
6. **Test**: Run full test suite on cloud VM - ALL TESTS MUST PASS
7. **Human Approval**: STOP and ask user for approval before submitting PR
8. **Submit**: PR with required screenshots/videos (only after approval)
9. **Close**: `bd close <id> --reason "PR #xyz"`

## MANDATORY: Pre-PR Checklist

**Before submitting ANY pull request, you MUST:**

1. **Run all tests on cloud VM** - not locally
   ```bash
   gcloud compute ssh bounty-dev --zone=us-central1-a --command="cd <repo> && <test-command>"
   ```

2. **Verify test results** - ALL tests must pass, report coverage %

3. **Run project-specific linters** - no lint errors allowed

4. **ASK USER FOR APPROVAL** - Do NOT submit PR without explicit human approval
   - Show test results summary
   - Show what files changed
   - Wait for "yes" or "approved" before creating PR

**NEVER auto-submit PRs. Always wait for human approval.**

## Tools

`tools/` contains PDF generation utilities for creating bounty guides:

```bash
cd tools
npm install
node generate-pdf.js               # Generate PDFs from markdown
```

## Payment

- **Algora**: Platform handles payment automatically
- **Cortex**: Bitcoin (preferred), USDC, or PayPal within 48 hours
