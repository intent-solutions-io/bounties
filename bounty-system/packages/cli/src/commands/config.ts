import { Command } from 'commander';
import chalk from 'chalk';
import { getConfig, setConfig, resetConfig } from '../lib/config';

export const configCommand = new Command('config')
  .description('Manage CLI configuration');

configCommand
  .command('show')
  .description('Show current configuration')
  .action(() => {
    const config = getConfig();
    console.log(chalk.bold('\nBounty CLI Configuration\n'));
    console.log(`  ${chalk.dim('Project ID:')}    ${config.projectId || chalk.yellow('not set')}`);
    console.log(`  ${chalk.dim('Default Domain:')} ${config.defaultDomain}`);
    console.log(`  ${chalk.dim('Proof Bucket:')}  ${config.proofBucket || chalk.yellow('not set')}`);
    console.log('');
  });

configCommand
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action((key, value) => {
    const validKeys = ['projectId', 'defaultDomain', 'proofBucket'];
    if (!validKeys.includes(key)) {
      console.error(chalk.red(`Invalid key: ${key}`));
      console.log(`Valid keys: ${validKeys.join(', ')}`);
      process.exit(1);
    }
    setConfig(key as keyof ReturnType<typeof getConfig>, value);
    console.log(chalk.green(`Set ${key} = ${value}`));
  });

configCommand
  .command('reset')
  .description('Reset configuration to defaults')
  .action(() => {
    resetConfig();
    console.log(chalk.green('Configuration reset to defaults'));
  });
