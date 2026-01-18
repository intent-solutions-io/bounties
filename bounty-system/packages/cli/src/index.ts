#!/usr/bin/env node
import { Command } from 'commander';
import { listCommand } from './commands/list';
import { showCommand } from './commands/show';
import { createCommand } from './commands/create';
import { claimCommand, unclaimCommand } from './commands/claim';
import { configCommand } from './commands/config';
import { workCommand } from './commands/work';
import { submitCommand } from './commands/submit';
import { githubCommand } from './commands/github';
import { vetCommand } from './commands/vet';
import { scoreCommand } from './commands/score';

const program = new Command();

program
  .name('bounty')
  .description('Bounty hunting CLI - track, record, and prove your work')
  .version('0.1.0');

// Core commands
program.addCommand(listCommand);
program.addCommand(showCommand);
program.addCommand(createCommand);
program.addCommand(claimCommand);
program.addCommand(unclaimCommand);
program.addCommand(submitCommand);

// Workflow commands
program.addCommand(workCommand);

// Config command
program.addCommand(configCommand);

// GitHub integration
program.addCommand(githubCommand);

// Vetting pipeline
program.addCommand(vetCommand);

// Scoring (pre-work evaluation)
program.addCommand(scoreCommand);

// Quick aliases
program
  .command('open')
  .description('List open bounties (alias for list -s open)')
  .action(async () => {
    await listCommand.parseAsync(['node', 'bounty', 'list', '-s', 'open']);
  });

program
  .command('mine')
  .description('List my claimed/in-progress bounties')
  .action(async () => {
    await listCommand.parseAsync(['node', 'bounty', 'list', '-s', 'claimed']);
  });

program.parse();
