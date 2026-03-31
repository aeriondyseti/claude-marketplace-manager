import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { findMarketplaceRoot, getMarketplaceContext, getPluginContext } from '../lib/context.js';
import { ExternalPluginSource, MarketplacePlugin } from '../types.js';

function isLocalSource(source: MarketplacePlugin['source']): source is string {
  return typeof source === 'string';
}

function resolveLocalPluginVersion(
  marketplaceRoot: string,
  entry: MarketplacePlugin
): string | null {
  if (!isLocalSource(entry.source)) return null;

  const pluginDir = path.resolve(marketplaceRoot, entry.source);
  const pluginJsonPath = path.join(pluginDir, '.claude-plugin', 'plugin.json');

  if (!fs.existsSync(pluginJsonPath)) return null;

  try {
    return getPluginContext(pluginDir).config.version;
  } catch {
    return null;
  }
}

function sourceLabel(source: MarketplacePlugin['source']): string {
  if (typeof source === 'string') return chalk.gray('local');
  const ext = source as ExternalPluginSource;
  switch (ext.source) {
    case 'github':
      return chalk.gray(`github:${ext.repo ?? ''}${ext.ref ? `@${ext.ref}` : ''}`);
    case 'npm':
      return chalk.gray(`npm:${ext.package ?? ''}${ext.version ? `@${ext.version}` : ''}`);
    case 'url':
    case 'git-subdir':
      return chalk.gray(ext.url ?? ext.source);
    default:
      return chalk.gray('external');
  }
}

export function status(): void {
  const cwd = process.cwd();
  const marketplaceRoot = findMarketplaceRoot(cwd);

  if (!marketplaceRoot) {
    console.error(chalk.red('Error: Not inside a marketplace directory.'));
    process.exit(1);
  }

  const marketplace = getMarketplaceContext(marketplaceRoot);
  const marketplaceVersion = marketplace.config.metadata?.version ?? null;

  console.log();
  console.log(
    `${chalk.bold('Marketplace:')} ${chalk.cyan(marketplace.config.name)}` +
      (marketplaceVersion ? `  ${chalk.yellow('v' + marketplaceVersion)}` : chalk.gray('  (unversioned)'))
  );
  if (marketplace.config.owner?.name) {
    console.log(chalk.gray(`             ${marketplace.config.owner.name}`));
  }
  console.log();

  if (marketplace.config.plugins.length === 0) {
    console.log(chalk.gray('  No plugins registered. Run `cmm add <plugin-name>` to add one.'));
    console.log();
    return;
  }

  const nameWidth = Math.max(...marketplace.config.plugins.map((p) => p.name.length), 12) + 2;

  for (const entry of marketplace.config.plugins) {
    const actualVersion = resolveLocalPluginVersion(marketplace.rootDir, entry);
    const entryVersion = entry.version;

    let versionDisplay: string;

    if (actualVersion) {
      if (entryVersion && actualVersion !== entryVersion) {
        // Mismatch between plugin.json and marketplace entry
        versionDisplay =
          chalk.red(`v${actualVersion}`) +
          chalk.gray(` (marketplace: v${entryVersion})`) +
          chalk.red(' ⚠ version mismatch');
      } else {
        versionDisplay = chalk.green(`v${actualVersion}`);
      }
    } else if (entryVersion) {
      versionDisplay = chalk.green(`v${entryVersion}`) + chalk.gray(' (from marketplace entry)');
    } else {
      versionDisplay = chalk.gray('(unknown)');
    }

    const label = sourceLabel(entry.source);
    console.log(`  ${entry.name.padEnd(nameWidth)} ${versionDisplay}`);
    console.log(`  ${''.padEnd(nameWidth)} ${label}`);
    console.log();
  }
}
