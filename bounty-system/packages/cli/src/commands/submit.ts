import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { getBounty, updateBounty, createProof, getSessions } from '../lib/firestore';
import { nowISO, generateId } from '@bounty-system/core';

export const submitCommand = new Command('submit')
  .description('Submit a bounty for review')
  .argument('<id>', 'Bounty ID')
  .option('-p, --pr <url>', 'Pull request URL')
  .option('-n, --notes <notes>', 'Submission notes')
  .option('--skip-vetting', 'Skip automated vetting (not recommended)')
  .action(async (id, options) => {
    const spinner = ora('Preparing submission...').start();

    try {
      const bounty = await getBounty(id);
      if (!bounty) {
        spinner.fail(`Bounty not found: ${id}`);
        process.exit(1);
      }

      if (!['claimed', 'in_progress'].includes(bounty.status)) {
        spinner.fail(`Cannot submit - bounty status is: ${bounty.status}`);
        process.exit(1);
      }

      // Gather work sessions
      spinner.text = 'Gathering work sessions...';
      const sessions = await getSessions(id);

      if (sessions.length === 0) {
        spinner.warn('No work sessions recorded');
        console.log(chalk.yellow('\n  Consider recording work sessions for better proof of work.'));
        console.log(chalk.dim('  Use: bounty work start <id>'));
      }

      // Calculate stats
      const recordings = sessions.flatMap(s => s.recordings || []);
      const checkpoints = sessions.flatMap(s => s.checkpoints || []);

      spinner.text = 'Creating proof bundle...';
      const now = nowISO();
      const proofId = generateId('proof');

      // Create proof bundle
      await createProof({
        id: proofId,
        bountyId: id,
        sessions: sessions.map(s => s.id),
        recordings: recordings.map(r => ({
          sessionId: r.sessionId,
          filename: r.filename,
          duration: r.duration,
          url: r.url
        })),
        screenshots: [],
        checkpoints: checkpoints.length,
        linesAdded: 0,  // TODO: Calculate from git
        linesDeleted: 0,
        filesChanged: 0,
        prUrl: options.pr,
        notes: options.notes,
        createdAt: now,
        vetting: options.skipVetting ? undefined : { status: 'pending' }
      });

      // Update bounty status
      await updateBounty(id, {
        status: 'submitted',
        pr: options.pr ? extractPrNumber(options.pr) : undefined,
        prUrl: options.pr,
        proofId,
        timeline: [
          ...(bounty.timeline || []),
          {
            timestamp: now,
            message: options.notes || 'Submitted for review',
            type: 'status_change'
          }
        ]
      });

      spinner.succeed(`Submitted bounty: ${chalk.bold(bounty.title)}`);

      console.log(`\n${chalk.bold('Proof Bundle:')}`);
      console.log(`  ID: ${proofId}`);
      console.log(`  Sessions: ${sessions.length}`);
      console.log(`  Recordings: ${recordings.length}`);
      console.log(`  Checkpoints: ${checkpoints.length}`);
      if (options.pr) {
        console.log(`  PR: ${options.pr}`);
      }

      if (!options.skipVetting) {
        console.log(`\n${chalk.yellow('Vetting pipeline will run automatically.')}`);
        console.log(chalk.dim('Check status with: bounty show ' + id + ' --proof'));
      }

      console.log(`\n${chalk.bold('Next steps:')}`);
      console.log(`  1. Wait for vetting to complete`);
      console.log(`  2. Address any review feedback`);
      console.log(`  3. Once approved, bounty will be marked completed`);

    } catch (error) {
      spinner.fail('Failed to submit bounty');
      console.error(error);
      process.exit(1);
    }
  });

function extractPrNumber(url: string): number | undefined {
  const match = url.match(/\/pull\/(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}
