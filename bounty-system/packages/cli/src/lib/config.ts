import Conf from 'conf';
import { homedir } from 'os';
import { join } from 'path';

interface BountyConfig {
  projectId: string;
  defaultDomain: string;
  proofBucket?: string;
  autoClaimThreshold: number;
  slackWebhook?: string;
  githubToken?: string;
}

const config = new Conf<BountyConfig>({
  projectName: 'bounty-system',
  cwd: join(homedir(), '.bounty'),
  defaults: {
    projectId: 'bounty-system-prod',
    defaultDomain: 'default',
    autoClaimThreshold: 80
  }
});

export function getConfig(): BountyConfig {
  return {
    projectId: config.get('projectId'),
    defaultDomain: config.get('defaultDomain'),
    proofBucket: config.get('proofBucket'),
    autoClaimThreshold: config.get('autoClaimThreshold'),
    slackWebhook: config.get('slackWebhook'),
    githubToken: config.get('githubToken')
  };
}

export function setConfig(key: keyof BountyConfig, value: string | number): void {
  config.set(key, value);
}

export function showConfig(): Record<string, unknown> {
  return config.store;
}

export function configPath(): string {
  return config.path;
}

export function resetConfig(): void {
  config.clear();
}
