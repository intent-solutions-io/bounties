/**
 * Hunt Command - Index-First Bounty Discovery
 *
 * Queries the local issues_index for bounty opportunities.
 * No live GitHub API calls by default - instant results from cached data.
 * Use --refresh to trigger ingestion before hunting.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig } from '../lib/config';
import { getDb, closeDb } from '../lib/db';
import { sendSlackNotification, type SlackMessage } from '../lib/slack';

interface IndexedIssue {
  id: number;
  source_id: number | null;
  repo: string;
  url: string;
  issue_number: number;
  title: string;
  body_excerpt: string | null;
  labels_json: string | null;
  state: string;
  updated_at_remote: string | null;
  ingested_at: string;
  bounty_amount: number | null;
  bounty_currency: string | null;
  is_paid: number;
  is_bounty_like: number;
  credibility_score_hint: number | null;
  score_cached: number | null;
  last_scored_at: string | null;
}

interface HuntResult {
  issue: IndexedIssue;
  score: number;
  labels: string[];
  recommendation: 'claim' | 'consider' | 'skip';
}

export const huntCommand = new Command('hunt')
  .description('Search local index for bounty opportunities (instant)')
  .option('--paid', 'Only show paid bounties (has value)')
  .option('--rep', 'Only show reputation opportunities (no payout)')
  .option('-t, --tech <tech>', 'Filter by technology keyword in labels')
  .option('-r, --repo <repo>', 'Filter by repo (owner/repo or partial match)')
  .option('--min-value <n>', 'Minimum bounty value', '0')
  .option('--min-score <n>', 'Minimum score threshold', '0')
  .option('-n, --limit <n>', 'Max results to show', '20')
  .option('--refresh', 'Run ingestion before hunting')
  .option('--stale', 'Show stale sources that need refresh')
  .option('--no-slack', 'Skip Slack notification')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (options) => {
    const spinner = ora('Hunting bounties...').start();

    try {
      const db = getDb();
      const config = await getConfig();

      // Check if index is empty
      const countResult = await db.execute("SELECT COUNT(*) as count FROM issues_index WHERE state = 'open'");
      const issueCount = (countResult.rows[0] as unknown as { count: number }).count;

      if (issueCount === 0) {
        spinner.warn('No issues in index');
        console.log(chalk.dim('Run: bounty ingest --all'));
        return;
      }

      // Run refresh if requested
      if (options.refresh) {
        spinner.text = 'Running ingestion...';
        // Import dynamically to avoid circular dependency
        const { execSync } = await import('child_process');
        try {
          execSync('node dist/index.js ingest --due --no-slack', {
            cwd: process.cwd(),
            stdio: 'pipe'
          });
        } catch {
          // Ingest may fail but we continue with existing data
        }
      }

      spinner.text = 'Querying local index...';

      // Build query (use single quotes for string literals)
      let sql = `
        SELECT i.*, r.maintainer_score_cached, r.repo_score_cached, rm.ttfg_p50_minutes
        FROM issues_index i
        LEFT JOIN repos r ON i.repo = r.repo
        LEFT JOIN repo_metrics rm ON i.repo = rm.repo
        WHERE i.state = 'open'`;
      const args: (string | number)[] = [];

      // Filter: paid vs rep
      if (options.paid) {
        sql += ' AND i.is_paid = 1';
      } else if (options.rep) {
        sql += ' AND i.is_paid = 0 AND i.is_bounty_like = 1';
      }

      // Filter: min value
      if (options.minValue && parseInt(options.minValue, 10) > 0) {
        sql += ' AND (i.bounty_amount IS NULL OR i.bounty_amount >= ?)';
        args.push(parseInt(options.minValue, 10));
      }

      // Filter: tech (search in labels_json)
      if (options.tech) {
        sql += ' AND LOWER(i.labels_json) LIKE ?';
        args.push(`%${options.tech.toLowerCase()}%`);
      }

      // Filter: repo
      if (options.repo) {
        sql += ' AND i.repo LIKE ?';
        args.push(`%${options.repo}%`);
      }

      // Order by score (cached or computed)
      sql += ` ORDER BY
        CASE WHEN i.bounty_amount IS NOT NULL THEN i.bounty_amount ELSE 0 END DESC,
        COALESCE(r.maintainer_score_cached, 50) DESC,
        i.updated_at_remote DESC
        LIMIT ?`;
      args.push(parseInt(options.limit, 10));

      const result = await db.execute({ sql, args });
      spinner.stop();

      if (result.rows.length === 0) {
        console.log(chalk.yellow('\nNo bounties match your criteria'));
        console.log(chalk.dim('Try adjusting filters or run: bounty ingest --all'));
        return;
      }

      // Score and rank results
      const huntResults: HuntResult[] = result.rows.map(row => {
        const issue = row as unknown as IndexedIssue & {
          maintainer_score_cached: number | null;
          repo_score_cached: number | null;
          ttfg_p50_minutes: number | null;
        };
        const labels = issue.labels_json ? JSON.parse(issue.labels_json) : [];
        const score = computeHuntScore(issue, config);
        const recommendation = score >= 70 ? 'claim' : score >= 40 ? 'consider' : 'skip';

        return { issue, score, labels, recommendation };
      });

      // Sort by score
      huntResults.sort((a, b) => b.score - a.score);

      // Apply min-score filter
      const minScore = parseInt(options.minScore, 10);
      const filtered = minScore > 0
        ? huntResults.filter(r => r.score >= minScore)
        : huntResults;

      // Print results
      console.log(chalk.bold(`\nFound ${filtered.length} opportunities (from ${issueCount} indexed)\n`));
      printHuntResults(filtered);

      // Show stale sources if requested
      if (options.stale) {
        await printStaleSources(db);
      }

      // Recommend next step
      const claimable = filtered.filter(r => r.recommendation === 'claim');
      if (claimable.length > 0) {
        console.log(chalk.bold('\nNext step:'));
        console.log(chalk.cyan(`  bounty qualify ${claimable[0].issue.url}`));
        console.log('');
      }

      // Notify Slack if significant results
      if (options.slack !== false && claimable.length > 0) {
        const slackContent = buildSlackSummary(filtered.slice(0, 5), issueCount);
        await sendSlackNotification({
          type: 'bounty_qualified',
          content: slackContent
        } as SlackMessage);
      }

    } catch (error) {
      spinner.fail('Hunt failed');
      console.error(error);
      process.exit(1);
    } finally {
      closeDb();
    }
  });

/**
 * Compute hunt score for an issue
 *
 * Score factors:
 * - Bounty value (30%)
 * - Maintainer score (20%)
 * - TTFTG penalty (15%)
 * - Age freshness (15%)
 * - Complexity hints (20%)
 */
function computeHuntScore(issue: IndexedIssue & {
  maintainer_score_cached: number | null;
  ttfg_p50_minutes: number | null;
}, config: any): number {
  let score = 50; // Base score

  // Value bonus (up to +30)
  if (issue.bounty_amount) {
    if (issue.bounty_amount >= 500) score += 30;
    else if (issue.bounty_amount >= 200) score += 25;
    else if (issue.bounty_amount >= 100) score += 20;
    else if (issue.bounty_amount >= 50) score += 15;
    else score += 10;
  }

  // Maintainer score bonus (up to +20)
  if (issue.maintainer_score_cached) {
    score += Math.round((issue.maintainer_score_cached / 100) * 20);
  }

  // TTFTG penalty (up to -15)
  if (issue.ttfg_p50_minutes) {
    if (issue.ttfg_p50_minutes > 60) score -= 15;
    else if (issue.ttfg_p50_minutes > 30) score -= 10;
    else if (issue.ttfg_p50_minutes > 15) score -= 5;
  }

  // Freshness bonus (up to +10)
  if (issue.updated_at_remote) {
    const daysSinceUpdate = (Date.now() - new Date(issue.updated_at_remote).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 7) score += 10;
    else if (daysSinceUpdate < 30) score += 5;
    else if (daysSinceUpdate > 90) score -= 10;
  }

  // Tech fit bonus from config
  const scoring = config.scoring || {};
  const labels = issue.labels_json ? JSON.parse(issue.labels_json) : [];
  const labelsLower = labels.map((l: string) => l.toLowerCase());

  if (scoring.preferredTechnologies) {
    const preferred = scoring.preferredTechnologies.map((t: string) => t.toLowerCase());
    if (preferred.some((t: string) => labelsLower.some((l: string) => l.includes(t)))) {
      score += 10;
    }
  }

  if (scoring.avoidTechnologies) {
    const avoid = scoring.avoidTechnologies.map((t: string) => t.toLowerCase());
    if (avoid.some((t: string) => labelsLower.some((l: string) => l.includes(t)))) {
      score -= 20;
    }
  }

  // Familiar repo bonus
  if (scoring.familiarRepos?.includes(issue.repo)) {
    score += 15;
  }
  if (scoring.expertRepos?.includes(issue.repo)) {
    score += 25;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Print hunt results table
 */
function printHuntResults(results: HuntResult[]) {
  console.log(chalk.dim('─'.repeat(100)));
  console.log(
    chalk.bold(padRight('Score', 8)) +
    chalk.bold(padRight('Rec', 8)) +
    chalk.bold(padRight('Value', 10)) +
    chalk.bold(padRight('Repo', 25)) +
    chalk.bold('Title')
  );
  console.log(chalk.dim('─'.repeat(100)));

  for (const { issue, score, recommendation } of results) {
    const scoreColor = score >= 70 ? chalk.green
      : score >= 50 ? chalk.greenBright
      : score >= 40 ? chalk.yellow
      : chalk.red;

    const recEmoji = { claim: ' ✅', consider: ' 🤔', skip: ' ❌' };

    const value = issue.bounty_amount
      ? chalk.green(`$${issue.bounty_amount}`)
      : issue.is_bounty_like ? chalk.cyan('rep') : chalk.dim('-');

    const repoShort = truncate(issue.repo, 23);
    const title = truncate(issue.title, 45);

    console.log(
      scoreColor(padRight(`${score}`, 8)) +
      padRight(recEmoji[recommendation], 8) +
      padRight(String(issue.bounty_amount ? `$${issue.bounty_amount}` : (issue.is_bounty_like ? 'rep' : '-')), 10) +
      padRight(repoShort, 25) +
      title
    );

    // Show URL on second line
    console.log(chalk.dim(`        ${truncate(issue.url, 85)}`));
  }

  console.log(chalk.dim('─'.repeat(100)));

  // Summary
  const claimable = results.filter(r => r.recommendation === 'claim');
  const consider = results.filter(r => r.recommendation === 'consider');

  console.log(
    `\n${chalk.green('✅')} Claim: ${claimable.length}  ` +
    `${chalk.yellow('🤔')} Consider: ${consider.length}  ` +
    `${chalk.red('❌')} Skip: ${results.length - claimable.length - consider.length}`
  );
}

/**
 * Print stale sources
 */
async function printStaleSources(db: ReturnType<typeof getDb>) {
  const now = Date.now();
  const result = await db.execute(`
    SELECT name, type, cadence_minutes, last_run_at
    FROM sources
    WHERE enabled = 1
    ORDER BY last_run_at ASC
  `);

  const stale: { name: string; type: string; hoursOverdue: number }[] = [];

  for (const row of result.rows) {
    const source = row as unknown as { name: string; type: string; cadence_minutes: number; last_run_at: string | null };
    if (!source.last_run_at) {
      stale.push({ name: source.name, type: source.type, hoursOverdue: 999 });
      continue;
    }

    const lastRun = new Date(source.last_run_at).getTime();
    const nextDue = lastRun + (source.cadence_minutes * 60 * 1000);
    if (now > nextDue) {
      const hoursOverdue = Math.round((now - nextDue) / (1000 * 60 * 60));
      stale.push({ name: source.name, type: source.type, hoursOverdue });
    }
  }

  if (stale.length > 0) {
    console.log(chalk.bold('\nStale Sources:'));
    for (const s of stale) {
      console.log(`  ${chalk.yellow('!')} ${s.name} (${s.type}) - ${s.hoursOverdue}h overdue`);
    }
    console.log(chalk.dim('\nRun: bounty ingest --due'));
  }
}

/**
 * Build Slack summary
 */
function buildSlackSummary(results: HuntResult[], totalIndexed: number): string {
  const lines: string[] = [];

  lines.push('*HUNT RESULTS*');
  lines.push(`Found ${results.length} top opportunities (from ${totalIndexed} indexed)`);
  lines.push('');

  for (const r of results.slice(0, 5)) {
    const value = r.issue.bounty_amount ? `$${r.issue.bounty_amount}` : 'rep';
    const rec = r.recommendation === 'claim' ? ':white_check_mark:' : ':thinking_face:';
    lines.push(`${rec} *${r.issue.repo}* - ${truncate(r.issue.title, 40)} (${value})`);
    lines.push(`    <${r.issue.url}|View issue>`);
  }

  lines.push('');
  lines.push('Run `bounty qualify <url>` to evaluate');

  return lines.join('\n');
}

function padRight(s: string, len: number): string {
  return s.padEnd(len);
}

function truncate(s: string, len: number): string {
  return s.length > len ? s.slice(0, len - 3) + '...' : s;
}
