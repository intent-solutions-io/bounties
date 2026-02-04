/**
 * Database Migrations
 *
 * Schema for bounties, repo profiles, workflow state, and config.
 * Uses libSQL (SQLite-compatible) with automatic version tracking.
 *
 * v1: Core bounties, repo_profiles, workflow_state, config
 * v2: Index-first architecture with sources, engagements, maintainer intel
 */

import { getDb } from './db';

// Current schema version
const SCHEMA_VERSION = 9;

/**
 * Migration definitions
 */
const migrations: Record<number, string[]> = {
  1: [
    // Bounties table - replaces CSV tracker
    `CREATE TABLE IF NOT EXISTS bounties (
      id TEXT PRIMARY KEY,
      repo TEXT NOT NULL,
      issue INTEGER,
      title TEXT,
      description TEXT,
      value REAL DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      status TEXT DEFAULT 'open',
      pr_number INTEGER,
      pr_url TEXT,
      score INTEGER,
      grade TEXT,
      labels TEXT,
      technologies TEXT,
      source TEXT DEFAULT 'github',
      source_url TEXT,
      claimed_at TEXT,
      submitted_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      -- Payment tracking
      payment_method TEXT,
      payment_terms TEXT,
      payment_status TEXT DEFAULT 'pending',
      payment_due_date TEXT,
      paid_at TEXT,
      payment_amount REAL,
      payment_currency TEXT,
      payment_reference TEXT,
      payment_notes TEXT
    )`,

    // Bounties indexes
    `CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status)`,
    `CREATE INDEX IF NOT EXISTS idx_bounties_repo ON bounties(repo)`,
    `CREATE INDEX IF NOT EXISTS idx_bounties_source ON bounties(source)`,

    // Repo profiles - CONTRIBUTING.md cache
    `CREATE TABLE IF NOT EXISTS repo_profiles (
      repo TEXT PRIMARY KEY,
      contributing_md TEXT,
      contributing_url TEXT,
      cla_required INTEGER DEFAULT 0,
      cla_url TEXT,
      test_framework TEXT,
      lint_command TEXT,
      build_command TEXT,
      pr_template TEXT,
      pr_naming_convention TEXT,
      review_time_hours INTEGER,
      languages TEXT,
      maintainers TEXT,
      last_fetched TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    // Workflow state - progressive steps
    `CREATE TABLE IF NOT EXISTS workflow_state (
      bounty_id TEXT PRIMARY KEY,
      step TEXT DEFAULT 'hunt',
      slack_thread_ts TEXT,
      slack_channel TEXT,
      contributing_reviewed INTEGER DEFAULT 0,
      plan_approved INTEGER DEFAULT 0,
      draft_approved INTEGER DEFAULT 0,
      plan_content TEXT,
      draft_content TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bounty_id) REFERENCES bounties(id)
    )`,

    // Workflow state index
    `CREATE INDEX IF NOT EXISTS idx_workflow_step ON workflow_state(step)`,

    // Config table - key-value store
    `CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    // Schema version tracking
    `CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    // Insert initial version
    `INSERT OR REPLACE INTO schema_version (version) VALUES (1)`
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // V2: Index-First Architecture + EV Scoring + Maintainer Intel
  // ═══════════════════════════════════════════════════════════════════════════
  2: [
    // ─────────────────────────────────────────────────────────────────────────
    // 2.1 Sources & Indexing (No-Waste Search)
    // ─────────────────────────────────────────────────────────────────────────

    // Sources: where bounties come from
    `CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      name TEXT NOT NULL UNIQUE,
      config_json TEXT,
      enabled INTEGER DEFAULT 1,
      cadence_minutes INTEGER DEFAULT 720,
      adapter_type TEXT DEFAULT 'github_label',
      adapter_config_json TEXT,
      last_run_at TEXT,
      last_status TEXT,
      last_error TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    // Repos: canonical registry
    `CREATE TABLE IF NOT EXISTS repos (
      repo TEXT PRIMARY KEY,
      default_branch TEXT DEFAULT 'main',
      language_hint TEXT,
      tags_json TEXT,
      credibility_tier TEXT,
      maintainer_score_cached INTEGER,
      repo_score_cached INTEGER,
      last_seen_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    // Repo-Source edges with backoff
    `CREATE TABLE IF NOT EXISTS repo_sources (
      repo TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      priority INTEGER DEFAULT 50,
      cadence_minutes INTEGER,
      last_checked_at TEXT,
      last_ingested_at TEXT,
      last_change_at TEXT,
      last_result_count INTEGER DEFAULT 0,
      last_signal_score INTEGER DEFAULT 50,
      consecutive_zero_runs INTEGER DEFAULT 0,
      backoff_state_json TEXT,
      notes TEXT,
      PRIMARY KEY (repo, source_id),
      FOREIGN KEY (repo) REFERENCES repos(repo),
      FOREIGN KEY (source_id) REFERENCES sources(id)
    )`,

    // Ingest run tracking
    `CREATE TABLE IF NOT EXISTS ingest_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT,
      scanned_repos INTEGER DEFAULT 0,
      scanned_items INTEGER DEFAULT 0,
      new_items INTEGER DEFAULT 0,
      updated_items INTEGER DEFAULT 0,
      error_text TEXT,
      FOREIGN KEY (source_id) REFERENCES sources(id)
    )`,

    // Normalized issue/bounty index
    `CREATE TABLE IF NOT EXISTS issues_index (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER,
      repo TEXT NOT NULL,
      url TEXT UNIQUE NOT NULL,
      issue_number INTEGER,
      title TEXT,
      body_excerpt TEXT,
      labels_json TEXT,
      state TEXT DEFAULT 'open',
      updated_at_remote TEXT,
      ingested_at TEXT DEFAULT CURRENT_TIMESTAMP,
      bounty_amount REAL,
      bounty_currency TEXT,
      is_paid INTEGER DEFAULT 0,
      is_bounty_like INTEGER DEFAULT 0,
      credibility_score_hint INTEGER,
      score_cached INTEGER,
      last_scored_at TEXT,
      FOREIGN KEY (source_id) REFERENCES sources(id),
      FOREIGN KEY (repo) REFERENCES repos(repo)
    )`,

    `CREATE INDEX IF NOT EXISTS idx_issues_repo ON issues_index(repo)`,
    `CREATE INDEX IF NOT EXISTS idx_issues_paid ON issues_index(is_paid, state)`,
    `CREATE INDEX IF NOT EXISTS idx_issues_score ON issues_index(score_cached DESC)`,

    // ─────────────────────────────────────────────────────────────────────────
    // 2.2 Engagements (Paid + Reputation)
    // ─────────────────────────────────────────────────────────────────────────

    // Engagements: both paid bounties and reputation PRs
    `CREATE TABLE IF NOT EXISTS engagements (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      source TEXT,
      repo TEXT NOT NULL,
      issue_url TEXT,
      pr_url TEXT,
      title TEXT,
      status TEXT DEFAULT 'discovered',
      bounty_id TEXT,
      issue_index_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (repo) REFERENCES repos(repo),
      FOREIGN KEY (bounty_id) REFERENCES bounties(id),
      FOREIGN KEY (issue_index_id) REFERENCES issues_index(id)
    )`,

    `CREATE INDEX IF NOT EXISTS idx_engagements_status ON engagements(status)`,
    `CREATE INDEX IF NOT EXISTS idx_engagements_kind ON engagements(kind)`,

    // Engagement metrics: EV, time estimates, actuals
    `CREATE TABLE IF NOT EXISTS engagement_metrics (
      engagement_id TEXT PRIMARY KEY,
      payout_amount REAL,
      payout_currency TEXT,
      payout_received_at TEXT,
      payment_delay_hours INTEGER,
      est_minutes_lo INTEGER,
      est_minutes_best INTEGER,
      est_minutes_hi INTEGER,
      actual_minutes INTEGER,
      hourly_target REAL DEFAULT 100,
      ttfg_minutes INTEGER,
      win_probability REAL,
      winprob_breakdown_json TEXT,
      ev_amount REAL,
      buybox_result TEXT,
      buybox_reasons_json TEXT,
      files_touched INTEGER,
      loc_added INTEGER,
      loc_deleted INTEGER,
      tests_added INTEGER,
      test_runtime_minutes INTEGER,
      review_rounds INTEGER,
      time_to_first_response_minutes INTEGER,
      time_to_merge_minutes INTEGER,
      outcome TEXT,
      computed_at TEXT,
      complexity_stage TEXT DEFAULT 'C0',
      complexity_confidence REAL DEFAULT 0.2,
      complexity_score INTEGER,
      complexity_drivers_json TEXT,
      env_mode TEXT DEFAULT 'local',
      env_escalation_reason TEXT,
      competition_risk_score INTEGER,
      competition_data_json TEXT,
      recommended_action TEXT,
      FOREIGN KEY (engagement_id) REFERENCES engagements(id)
    )`,

    // ─────────────────────────────────────────────────────────────────────────
    // 2.3 Maintainer Intel (Private CRM)
    // ─────────────────────────────────────────────────────────────────────────

    // Maintainers
    `CREATE TABLE IF NOT EXISTS maintainers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      github_login TEXT UNIQUE NOT NULL,
      display_name TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    // Maintainer-Repo edges
    `CREATE TABLE IF NOT EXISTS maintainer_repo_edges (
      maintainer_id INTEGER NOT NULL,
      repo TEXT NOT NULL,
      relationship_score INTEGER DEFAULT 50,
      last_interaction_at TEXT,
      PRIMARY KEY (maintainer_id, repo),
      FOREIGN KEY (maintainer_id) REFERENCES maintainers(id),
      FOREIGN KEY (repo) REFERENCES repos(repo)
    )`,

    // Maintainer events (audit trail)
    `CREATE TABLE IF NOT EXISTS maintainer_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      maintainer_id INTEGER NOT NULL,
      repo TEXT,
      type TEXT NOT NULL,
      issue_or_pr_url TEXT,
      ts TEXT DEFAULT CURRENT_TIMESTAMP,
      payload_json TEXT,
      FOREIGN KEY (maintainer_id) REFERENCES maintainers(id)
    )`,

    // Maintainer scores
    `CREATE TABLE IF NOT EXISTS maintainer_scores (
      maintainer_id INTEGER NOT NULL,
      repo TEXT NOT NULL,
      responsiveness_score INTEGER,
      fairness_score INTEGER,
      merge_velocity_score INTEGER,
      comms_quality_score INTEGER,
      reliability_score INTEGER,
      overall_score INTEGER,
      computed_at TEXT,
      PRIMARY KEY (maintainer_id, repo),
      FOREIGN KEY (maintainer_id) REFERENCES maintainers(id)
    )`,

    // ─────────────────────────────────────────────────────────────────────────
    // 2.4 Repo Metrics & Events
    // ─────────────────────────────────────────────────────────────────────────

    // Repo metrics (TTFG, CI health, merge velocity)
    `CREATE TABLE IF NOT EXISTS repo_metrics (
      repo TEXT PRIMARY KEY,
      ttfg_last_minutes INTEGER,
      ttfg_p50_minutes INTEGER,
      ttfg_p90_minutes INTEGER,
      ci_flake_rate REAL,
      median_merge_minutes INTEGER,
      last_bootstrap_at TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (repo) REFERENCES repos(repo)
    )`,

    // Events (audit trail for all state changes)
    `CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      type TEXT NOT NULL,
      ts TEXT DEFAULT CURRENT_TIMESTAMP,
      payload_json TEXT
    )`,

    `CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id)`,

    // ─────────────────────────────────────────────────────────────────────────
    // 2.5 Extend existing repo_profiles for env detection
    // ─────────────────────────────────────────────────────────────────────────

    // Add environment detection columns to repo_profiles
    `ALTER TABLE repo_profiles ADD COLUMN preferred_env TEXT DEFAULT 'local'`,
    `ALTER TABLE repo_profiles ADD COLUMN env_reasons_json TEXT`,
    `ALTER TABLE repo_profiles ADD COLUMN last_env_check_at TEXT`,

    // Update schema version
    `INSERT OR REPLACE INTO schema_version (version) VALUES (2)`
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // V3: Repo Rules Profile System
  // ═══════════════════════════════════════════════════════════════════════════
  3: [
    // Extend repo_profiles with rules tracking
    `ALTER TABLE repo_profiles ADD COLUMN content_hash TEXT`,
    `ALTER TABLE repo_profiles ADD COLUMN etag TEXT`,
    `ALTER TABLE repo_profiles ADD COLUMN rules_json TEXT`,
    `ALTER TABLE repo_profiles ADD COLUMN rules_summary TEXT`,
    `ALTER TABLE repo_profiles ADD COLUMN rules_version INTEGER DEFAULT 1`,
    `ALTER TABLE repo_profiles ADD COLUMN rules_acknowledged_at TEXT`,
    `ALTER TABLE repo_profiles ADD COLUMN rules_acknowledged_hash TEXT`,

    // Add index for fast repo lookup
    `CREATE INDEX IF NOT EXISTS idx_repo_profiles_repo ON repo_profiles(repo)`,

    // Update schema version
    `INSERT OR REPLACE INTO schema_version (version) VALUES (3)`
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // V4: Repo Style Profiles (Culture Sampler)
  // ═══════════════════════════════════════════════════════════════════════════
  4: [
    // Extend repo_profiles with style sampling
    `ALTER TABLE repo_profiles ADD COLUMN style_sampled_at TEXT`,
    `ALTER TABLE repo_profiles ADD COLUMN style_ttl_days INTEGER DEFAULT 30`,
    `ALTER TABLE repo_profiles ADD COLUMN style_guide_json TEXT`,
    `ALTER TABLE repo_profiles ADD COLUMN style_guide_summary TEXT`,
    `ALTER TABLE repo_profiles ADD COLUMN style_corpus_json TEXT`,
    `ALTER TABLE repo_profiles ADD COLUMN style_version INTEGER DEFAULT 1`,

    // Update schema version
    `INSERT OR REPLACE INTO schema_version (version) VALUES (4)`
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // V5: CLA/DCO Status Tracking + Eligibility Assessment
  // ═══════════════════════════════════════════════════════════════════════════
  5: [
    // CLA/DCO status per user per repo
    `CREATE TABLE IF NOT EXISTS cla_status (
      repo TEXT PRIMARY KEY,
      cla_required INTEGER DEFAULT 0,
      cla_url TEXT,
      cla_type TEXT,
      cla_provider TEXT,
      cla_status TEXT DEFAULT 'unknown',
      cla_completed_at TEXT,
      cla_evidence TEXT,
      dco_required INTEGER DEFAULT 0,
      dco_status TEXT DEFAULT 'unknown',
      dco_enabled_at TEXT,
      signoff_required INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    // Eligibility assessments per engagement
    `ALTER TABLE engagement_metrics ADD COLUMN eligibility TEXT DEFAULT 'unknown'`,
    `ALTER TABLE engagement_metrics ADD COLUMN eligibility_confidence REAL DEFAULT 0`,
    `ALTER TABLE engagement_metrics ADD COLUMN eligibility_reasons_json TEXT`,
    `ALTER TABLE engagement_metrics ADD COLUMN eligibility_prework_json TEXT`,
    `ALTER TABLE engagement_metrics ADD COLUMN cla_ack INTEGER DEFAULT 0`,
    `ALTER TABLE engagement_metrics ADD COLUMN rules_gate_passed INTEGER DEFAULT 0`,
    `ALTER TABLE engagement_metrics ADD COLUMN style_gate_passed INTEGER DEFAULT 0`,

    // Update schema version
    `INSERT OR REPLACE INTO schema_version (version) VALUES (5)`
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // V6: Evidence Bundles + Test Runs + Judge Runs (PR Merge-Ready Gates)
  // ═══════════════════════════════════════════════════════════════════════════
  6: [
    // Evidence bundles - artifacts proving work quality
    `CREATE TABLE IF NOT EXISTS evidence_bundles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      engagement_id TEXT NOT NULL,
      path TEXT NOT NULL,
      hash TEXT,
      summary_json TEXT,
      files_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (engagement_id) REFERENCES engagements(id)
    )`,

    `CREATE INDEX IF NOT EXISTS idx_evidence_engagement ON evidence_bundles(engagement_id)`,

    // Test runs - test execution records
    `CREATE TABLE IF NOT EXISTS test_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      engagement_id TEXT NOT NULL,
      command TEXT NOT NULL,
      env TEXT DEFAULT 'local',
      status TEXT NOT NULL,
      exit_code INTEGER,
      duration_seconds INTEGER,
      output_excerpt TEXT,
      full_output_path TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (engagement_id) REFERENCES engagements(id)
    )`,

    `CREATE INDEX IF NOT EXISTS idx_test_runs_engagement ON test_runs(engagement_id)`,

    // Judge runs - gate evaluation records
    `CREATE TABLE IF NOT EXISTS judge_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      engagement_id TEXT NOT NULL,
      status TEXT NOT NULL,
      checks_json TEXT,
      required_fixes_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (engagement_id) REFERENCES engagements(id)
    )`,

    `CREATE INDEX IF NOT EXISTS idx_judge_runs_engagement ON judge_runs(engagement_id)`,

    // Add gate tracking columns to engagement_metrics
    `ALTER TABLE engagement_metrics ADD COLUMN evidence_bundle_id INTEGER`,
    `ALTER TABLE engagement_metrics ADD COLUMN last_test_run_id INTEGER`,
    `ALTER TABLE engagement_metrics ADD COLUMN last_judge_run_id INTEGER`,
    `ALTER TABLE engagement_metrics ADD COLUMN tone_lint_passed INTEGER DEFAULT 0`,
    `ALTER TABLE engagement_metrics ADD COLUMN all_gates_passed INTEGER DEFAULT 0`,

    // Update schema version
    `INSERT OR REPLACE INTO schema_version (version) VALUES (6)`
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // V7: Competition Checks + Engagement Adapters
  // ═══════════════════════════════════════════════════════════════════════════
  7: [
    // Competition checks - tracking competing PRs and risk over time
    `CREATE TABLE IF NOT EXISTS competition_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      engagement_id TEXT NOT NULL,
      ts TEXT DEFAULT CURRENT_TIMESTAMP,
      risk_score INTEGER NOT NULL,
      drivers_json TEXT,
      competing_items_json TEXT,
      recommended_action TEXT,
      FOREIGN KEY (engagement_id) REFERENCES engagements(id)
    )`,

    `CREATE INDEX IF NOT EXISTS idx_competition_engagement ON competition_checks(engagement_id)`,
    `CREATE INDEX IF NOT EXISTS idx_competition_ts ON competition_checks(ts DESC)`,

    // Add adapter field to engagements for engagement-specific workflow
    `ALTER TABLE engagements ADD COLUMN adapter TEXT DEFAULT 'comment_intent'`,
    `ALTER TABLE engagements ADD COLUMN adapter_reason TEXT`,

    // Update schema version
    `INSERT OR REPLACE INTO schema_version (version) VALUES (7)`
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // V8: Seed & Baseline Discovery System
  // ═══════════════════════════════════════════════════════════════════════════
  8: [
    // ─────────────────────────────────────────────────────────────────────────
    // 8.1 Extend repos table for seed scoring
    // ─────────────────────────────────────────────────────────────────────────
    `ALTER TABLE repos ADD COLUMN stars INTEGER`,
    `ALTER TABLE repos ADD COLUMN forks INTEGER`,
    `ALTER TABLE repos ADD COLUMN seed_score INTEGER`,
    `ALTER TABLE repos ADD COLUMN bounty_like_issues_90d INTEGER DEFAULT 0`,
    `ALTER TABLE repos ADD COLUMN bounty_like_issues_365d INTEGER DEFAULT 0`,
    `ALTER TABLE repos ADD COLUMN payout_hint_count INTEGER DEFAULT 0`,
    `ALTER TABLE repos ADD COLUMN maintainer_activity_score INTEGER`,
    `ALTER TABLE repos ADD COLUMN merge_velocity_score INTEGER`,
    `ALTER TABLE repos ADD COLUMN preferred_env TEXT DEFAULT 'local'`,
    `ALTER TABLE repos ADD COLUMN preferred_env_reasons_json TEXT`,
    `ALTER TABLE repos ADD COLUMN last_seeded_at TEXT`,
    `ALTER TABLE repos ADD COLUMN seed_score_breakdown_json TEXT`,

    // ─────────────────────────────────────────────────────────────────────────
    // 8.2 Repo signals table for tracking discovery signals
    // ─────────────────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS repo_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo TEXT NOT NULL,
      signal_type TEXT NOT NULL,
      value_numeric REAL,
      value_text TEXT,
      observed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      source_url TEXT,
      FOREIGN KEY (repo) REFERENCES repos(repo)
    )`,

    `CREATE INDEX IF NOT EXISTS idx_repo_signals_repo ON repo_signals(repo)`,
    `CREATE INDEX IF NOT EXISTS idx_repo_signals_type ON repo_signals(signal_type)`,

    // ─────────────────────────────────────────────────────────────────────────
    // 8.3 Extend issues_index for payout detection
    // ─────────────────────────────────────────────────────────────────────────
    `ALTER TABLE issues_index ADD COLUMN detected_payout_amount REAL`,
    `ALTER TABLE issues_index ADD COLUMN detected_currency TEXT`,
    `ALTER TABLE issues_index ADD COLUMN detected_payout_hint_text TEXT`,

    // ─────────────────────────────────────────────────────────────────────────
    // 8.4 Seed runs tracking table
    // ─────────────────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS seed_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT,
      queries_executed INTEGER DEFAULT 0,
      total_results INTEGER DEFAULT 0,
      unique_repos INTEGER DEFAULT 0,
      unique_issues INTEGER DEFAULT 0,
      rate_limit_hits INTEGER DEFAULT 0,
      errors_json TEXT,
      config_json TEXT
    )`,

    // ─────────────────────────────────────────────────────────────────────────
    // 8.5 Query execution tracking
    // ─────────────────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS seed_query_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seed_run_id INTEGER NOT NULL,
      query_id TEXT NOT NULL,
      query_category TEXT NOT NULL,
      executed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      results_count INTEGER DEFAULT 0,
      unique_repos_found INTEGER DEFAULT 0,
      rate_limited INTEGER DEFAULT 0,
      error_text TEXT,
      FOREIGN KEY (seed_run_id) REFERENCES seed_runs(id)
    )`,

    `CREATE INDEX IF NOT EXISTS idx_seed_query_run ON seed_query_results(seed_run_id)`,

    // Update schema version
    `INSERT OR REPLACE INTO schema_version (version) VALUES (8)`
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // V9: Repo Reputation + Blocklist System (Historical Evidence)
  // ═══════════════════════════════════════════════════════════════════════════
  9: [
    // ─────────────────────────────────────────────────────────────────────────
    // 9.1 Repo blocklist - known bad/bunk repos
    // ─────────────────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS repo_blocklist (
      repo TEXT PRIMARY KEY,
      reason TEXT NOT NULL,
      blocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
      blocked_by TEXT DEFAULT 'manual',
      evidence_json TEXT,
      notes TEXT
    )`,

    `CREATE INDEX IF NOT EXISTS idx_blocklist_reason ON repo_blocklist(reason)`,

    // ─────────────────────────────────────────────────────────────────────────
    // 9.2 Repo reputation - track payout history
    // ─────────────────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS repo_reputation (
      repo TEXT PRIMARY KEY,
      -- Payout history
      total_bounties_paid INTEGER DEFAULT 0,
      total_payout_amount REAL DEFAULT 0,
      avg_payout_amount REAL,
      last_payout_at TEXT,
      -- Activity signals
      bounties_posted_90d INTEGER DEFAULT 0,
      bounties_claimed_90d INTEGER DEFAULT 0,
      bounties_paid_90d INTEGER DEFAULT 0,
      -- Quality signals
      avg_time_to_merge_hours INTEGER,
      avg_review_rounds REAL,
      maintainer_response_hours INTEGER,
      -- Computed reputation score (0-100)
      reputation_score INTEGER DEFAULT 50,
      reputation_tier TEXT DEFAULT 'unknown',
      -- Tracking
      first_seen_at TEXT,
      last_updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE INDEX IF NOT EXISTS idx_repo_rep_score ON repo_reputation(reputation_score DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_repo_rep_tier ON repo_reputation(reputation_tier)`,

    // ─────────────────────────────────────────────────────────────────────────
    // 9.3 Payout events - historical evidence of actual payouts
    // ─────────────────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS payout_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo TEXT NOT NULL,
      issue_url TEXT,
      pr_url TEXT,
      payout_amount REAL NOT NULL,
      payout_currency TEXT DEFAULT 'USD',
      paid_at TEXT NOT NULL,
      source TEXT,
      evidence_url TEXT,
      notes TEXT,
      FOREIGN KEY (repo) REFERENCES repos(repo)
    )`,

    `CREATE INDEX IF NOT EXISTS idx_payout_repo ON payout_events(repo)`,
    `CREATE INDEX IF NOT EXISTS idx_payout_date ON payout_events(paid_at DESC)`,

    // ─────────────────────────────────────────────────────────────────────────
    // 9.4 Extend repos table with reputation link
    // ─────────────────────────────────────────────────────────────────────────
    `ALTER TABLE repos ADD COLUMN is_blocklisted INTEGER DEFAULT 0`,
    `ALTER TABLE repos ADD COLUMN blocklist_reason TEXT`,
    `ALTER TABLE repos ADD COLUMN reputation_tier TEXT DEFAULT 'unknown'`,

    // Update schema version
    `INSERT OR REPLACE INTO schema_version (version) VALUES (9)`
  ]
};

/**
 * Run all pending migrations
 */
export async function runMigrations(): Promise<{ applied: number; current: number }> {
  const db = getDb();
  let applied = 0;

  // Check current version
  let currentVersion = 0;
  try {
    const result = await db.execute(
      'SELECT MAX(version) as version FROM schema_version'
    );
    currentVersion = (result.rows[0]?.version as number) || 0;
  } catch {
    // Table doesn't exist yet, start from 0
    currentVersion = 0;
  }

  // Run pending migrations
  for (let version = currentVersion + 1; version <= SCHEMA_VERSION; version++) {
    const statements = migrations[version];
    if (statements) {
      for (const sql of statements) {
        await db.execute(sql);
      }
      applied++;
    }
  }

  return { applied, current: SCHEMA_VERSION };
}

/**
 * Get current schema version
 */
export async function getSchemaVersion(): Promise<number> {
  try {
    const db = getDb();
    const result = await db.execute(
      'SELECT MAX(version) as version FROM schema_version'
    );
    return (result.rows[0]?.version as number) || 0;
  } catch {
    return 0;
  }
}

/**
 * Get table counts for status check
 */
export async function getTableCounts(): Promise<Record<string, number>> {
  const db = getDb();
  const tables = [
    // v1 tables
    'bounties',
    'repo_profiles',
    'workflow_state',
    'config',
    // v2 tables
    'sources',
    'repos',
    'repo_sources',
    'ingest_runs',
    'issues_index',
    'engagements',
    'engagement_metrics',
    'maintainers',
    'maintainer_repo_edges',
    'maintainer_events',
    'maintainer_scores',
    'repo_metrics',
    'events',
    // v5 tables
    'cla_status',
    // v6 tables
    'evidence_bundles',
    'test_runs',
    'judge_runs',
    // v7 tables
    'competition_checks',
    // v8 tables
    'repo_signals',
    'seed_runs',
    'seed_query_results',
    // v9 tables
    'repo_blocklist',
    'repo_reputation',
    'payout_events'
  ];
  const counts: Record<string, number> = {};

  for (const table of tables) {
    try {
      const result = await db.execute(`SELECT COUNT(*) as count FROM ${table}`);
      counts[table] = (result.rows[0]?.count as number) || 0;
    } catch {
      counts[table] = 0;
    }
  }

  return counts;
}

/**
 * Reset database (drops all tables)
 */
export async function resetDatabase(): Promise<void> {
  const db = getDb();
  // Order matters for foreign key constraints (drop dependents first)
  const tables = [
    // v8 tables (newest first)
    'seed_query_results',
    'seed_runs',
    'repo_signals',
    // v7 tables
    'competition_checks',
    // v6 tables
    'judge_runs',
    'test_runs',
    'evidence_bundles',
    // v2 tables (dependents first)
    'events',
    'repo_metrics',
    'maintainer_scores',
    'maintainer_events',
    'maintainer_repo_edges',
    'maintainers',
    'engagement_metrics',
    'engagements',
    'issues_index',
    'ingest_runs',
    'repo_sources',
    'repos',
    'sources',
    // v5 tables
    'cla_status',
    // v1 tables
    'workflow_state',
    'bounties',
    'repo_profiles',
    'config',
    'schema_version'
  ];

  for (const table of tables) {
    await db.execute(`DROP TABLE IF EXISTS ${table}`);
  }
}
