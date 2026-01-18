# Bounty System

A comprehensive bounty tracking + proof-of-work system.

## Quick Start

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run CLI (development)
node packages/cli/dist/index.js --help
```

## CLI Commands

```bash
bounty list              # List all bounties
bounty list -s open      # List open bounties
bounty show <id>         # Show bounty details
bounty create -t "Title" -v 100  # Create bounty
bounty claim <id>        # Claim a bounty
bounty unclaim <id>      # Return to open

# Work session tracking
bounty work start <id>   # Start recording work
bounty work checkpoint "message"  # Add progress checkpoint
bounty work stop         # End session
bounty work status       # Show active session

# Submission
bounty submit <id> --pr <url>  # Submit for review

# Configuration
bounty config show       # Show config
bounty config set <key> <value>
```

## Project Structure

```
bounty-system/
├── apps/                    # Web applications (Phase 5)
│   └── dashboard/           # Private portal
├── packages/
│   ├── core/                # Shared schemas (Zod)
│   └── cli/                 # bounty CLI
├── services/                # Cloud Functions (Phase 3)
├── firestore/               # Firestore rules & indexes
└── scripts/                 # Migration & utilities
```

## Configuration

Set your GCP project:

```bash
bounty config set projectId your-gcp-project
```

Environment variables:
- `GOOGLE_CLOUD_PROJECT` - GCP project ID
- `GOOGLE_APPLICATION_CREDENTIALS` - Service account key path

## Migration

Import existing CSV bounties:

```bash
# Dry run (preview)
npx ts-node scripts/migrate-csv.ts --dry-run

# Actual migration
npx ts-node scripts/migrate-csv.ts
```

## Recording System

Terminal sessions are recorded using asciinema. Install it first:

```bash
pip install asciinema
# or: brew install asciinema
```

### Recording Commands

```bash
bounty work start <id>       # Start session + recording
bounty work checkpoint "msg" # Add progress checkpoint
bounty work stop             # Stop and upload recording
bounty work status           # Show active session
bounty work recordings       # List local recordings
bounty work record           # Standalone recording mode
bounty work embed <file>     # Generate HTML player embed
```

### Cloud Storage

Configure proof bucket for uploads:

```bash
bounty config set proofBucket gs://your-bucket-name
```

Recordings are saved locally to `~/.bounty/recordings/` and uploaded to GCS on `work stop`.

## Infrastructure (Terraform)

```bash
cd infra/terraform
terraform init
terraform plan -var="project_id=your-project"
terraform apply
```

Creates:
- GCS bucket for proof recordings
- Service account for CLI
- IAM bindings

## GitHub Integration

Bounties auto-create when GitHub issues are labeled.

### Setup Webhook

```bash
# Configure GitHub token
bounty config set githubToken ghp_xxxxx

# Set up webhook for a repo
bounty github setup owner/repo \
  --url https://REGION-PROJECT.cloudfunctions.net/github-webhook \
  --secret your-webhook-secret

# List existing webhooks
bounty github list owner/repo

# Sync existing labeled issues
bounty github sync owner/repo --dry-run
```

### How It Works

1. **Add "bounty" label** to issue → Bounty created
2. **Add value label** (e.g., "$100") → Value set
3. **Open PR** with "Fixes #123" → PR linked to bounty
4. **Merge PR** → Bounty marked completed
5. **Close issue** without merge → Bounty returned to open

### Slash Commands (in issue comments)

```
/bounty claim    - Claim the bounty
/bounty unclaim  - Release the bounty
/bounty status   - Check bounty status
/bounty value $100 - Set bounty value
```

### Deploy Webhook Function

```bash
cd services/functions
npm install
npm run deploy
```

## Development Phases

- [x] Phase 1: Foundation (Firestore, CLI core)
- [x] Phase 2: Recording System (asciinema)
- [x] Phase 3: GitHub Integration (webhooks)
- [ ] Phase 4: Vetting Pipeline
- [ ] Phase 5: Web Dashboard
- [ ] Phase 6: Multi-Site Integration
- [ ] Phase 7: Public Proof Wall
- [ ] Phase 8: Notifications & Automation
