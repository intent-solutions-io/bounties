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
| `screenpipe/` | Rust + Tauri + TS/Bun | $25-500 | AI/screen recording via Algora |
| `posthog/` | Python/Django + React/TS | Varies | Analytics - uses flox environment |
| `calcom/` | TypeScript/Next.js | $20-500 | Scheduling platform |
| `tldraw/` | TypeScript/React | Varies | Drawing library - yarn workspaces |
| `appsmith/` | Java + React/TS | Varies | Low-code platform |
| `vertex-ai-samples/` | Python notebooks | Contrib | Google Cloud - CLA required |
| `zio-blocks/` | Scala 3 + sbt | $2-4K | ZIO Schema library |
| `feishin/` | React + Electron + pnpm | Contrib | Self-hosted music player |
| `filament/` | PHP/Laravel + Livewire | Varies | Has own CLAUDE.md |
| `shadcn-ui/` | TypeScript/React | Varies | Has own CLAUDE.md |
| `bounty-system/` | TypeScript/pnpm | Internal | Custom CLI for tracking + recordings |
| `claude-cookbooks/` | Various | Contrib | Has own CLAUDE.md |

## Tracking

- `000-docs/002-PM-BKLG-bounty-tracker.csv` - Master spreadsheet with status
- `000-docs/001-BL-TRCK-payment-tracker.md` - Payment tracking
- `surgical-bounties.md` - Curated list of small (<100 LOC) template-based bounties
- **CRITICAL**: Always check GitHub for competing PRs before starting work - many bounties get superseded
- Use `gh pr list --repo <owner>/<repo> --search "<issue#>"` to find competing PRs

## Project-Specific Quick Reference

### Screenpipe ($25-500 bounties via Algora)

```bash
cd screenpipe
cargo build                        # Rust core
cd screenpipe-app-tauri && bun install && bun run dev  # Tauri app
```

**Architecture**: CLI + Tauri app that records screens/mics 24/7, extracts OCR/STT, saves to SQLite at `$HOME/.screenpipe/db.sqlite`, connects to AI. Plugins ("pipes") written in TS + Bun.

**Style**:
- Rust: anyhow errors, tokio async, prefer channels over mutex, easy to read for humans
- TS: NextJS + Tailwind + shadcn + lucide + magicui + framer-motion
- **Lowercase for ALL logging and UI text**
- No toast errors - use empty states, skeletons, inline errors, disabled states
- Keep `@ts-ignore` comments unless explicitly asked to remove
- Escape HTML properly in React (use `&apos;` etc. when inside quotes)

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

**Environment**: Uses flox - run commands with `flox activate -- bash -c "<command>"` (never interactive)

```bash
cd posthog
flox activate -- bash -c "pytest path/to/test.py::TestClass::test_method"  # Single test
flox activate -- bash -c "ruff check . --fix && ruff format ."  # Python lint
pnpm --filter=@posthog/frontend test              # Frontend tests
pnpm --filter=@posthog/frontend typescript:check  # TypeScript check
```

**Style**:
- Python: Type hints required, snake_case, no mypy (too slow)
- Frontend: TypeScript required, Tailwind over inline styles, avoid direct dayjs imports (use lib/dayjs)
- Sentence casing for product names (e.g., "Product analytics" not "Product Analytics")
- Conventional commits: `feat(scope):`, `fix(scope):`, `chore:` - lowercase, no period
- Comments: explain WHY not WHAT, no doc comments in Python tests
- Tests: prefer parameterized tests (use `parameterized` library in Python)

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

### Vertex AI Samples (Google Cloud)

**CLA Required**: Sign at https://cla.developers.google.com/

```bash
cd vertex-ai-samples
pip3 install --user -U nbqa black flake8 isort pyupgrade
docker run -v ${PWD}:/setup/app gcr.io/cloud-devrel-public-resources/notebook_linter:latest your_notebook.ipynb
```

**Style**: One notebook per PR, follow Google notebook standards.

### ZIO Blocks ($2-4K bounties)

```bash
cd zio-blocks
sbt compile                        # Compile
sbt test                           # Run tests
sbt scalafmtCheckAll               # Check formatting
```

**Style**: Scala 3, pure FP, uses sbt. See `.scalafmt.conf` for formatting rules.

### Feishin (Music Player)

```bash
cd feishin
pnpm install
pnpm run dev                       # Electron dev
pnpm run lint                      # Lint code + styles
pnpm run lint:fix                  # Auto-fix
```

**Style**: React + Electron, uses pnpm. ESLint + Stylelint for code/CSS.

### Bounty-System (Custom CLI)

The `bounty-system/` directory contains a custom bounty tracking CLI with work session recording.

```bash
cd bounty-system
pnpm install && pnpm build

# Core commands
bounty list                      # List all bounties
bounty list -s open              # List open bounties
bounty show <id>                 # Show bounty details
bounty claim <id>                # Claim a bounty

# Work session recording (uses asciinema)
bounty work start <id>           # Start recording session
bounty work checkpoint "message" # Add progress checkpoint
bounty work stop                 # End session + upload to GCS

# GitHub integration
bounty github sync owner/repo    # Sync labeled issues
```

**Architecture**: pnpm monorepo with `packages/core` (Zod schemas), `packages/cli`, `apps/dashboard`, and `services/` (Cloud Functions for webhooks).

### Claude Cookbooks

```bash
cd claude-cookbooks
# Check its CLAUDE.md for specific instructions
```

### Filament & shadcn-ui

Both have their own `CLAUDE.md` files with detailed instructions. Read those before contributing.

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

`tools/` contains utilities for bounty management:

```bash
cd tools
npm install
node generate-pdf.js               # Generate PDFs from markdown
python sync-airtable.py            # Sync bounty tracker to Airtable (needs AIRTABLE_API_KEY in .env)
```

## Payment

- **Algora**: Platform handles payment automatically
- **Cortex**: Bitcoin (preferred), USDC, or PayPal within 48 hours
