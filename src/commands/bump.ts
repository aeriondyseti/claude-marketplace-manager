import path from 'path';
import chalk from 'chalk';
import { confirm, select } from '@inquirer/prompts';
import { resolveContext, findPluginRoot, findMarketplaceRoot, getMarketplaceContext } from '../lib/context.js';
import { writeMarketplace } from '../lib/marketplace.js';
import { writePlugin } from '../lib/plugin.js';
import { bumpVersion } from '../lib/semver.js';
import { gitCommitAndTag, isGitRepo, detectBumpTypeFromHistory } from '../lib/git.js';
import { BumpType, MarketplacePlugin } from '../types.js';

export interface BumpOptions {
  dryRun?: boolean;
}

export async function bump(
  type: BumpType | 'auto',
  pluginName: string | undefined,
  opts: BumpOptions
): Promise<void> {
  const cwd = process.cwd();

  // If no plugin name and not inside a plugin dir, show an interactive picker
  if (!pluginName && !findPluginRoot(cwd)) {
    const marketplaceRoot = findMarketplaceRoot(cwd);
    if (!marketplaceRoot) {
      console.error(chalk.red('Error: Not inside a marketplace directory.'));
      process.exit(1);
    }
    const marketplace = getMarketplaceContext(marketplaceRoot);
    const localPlugins = marketplace.config.plugins.filter(
      (p) => typeof p.source === 'string'
    );
    if (localPlugins.length === 0) {
      console.error(chalk.red('Error: No local plugins registered in this marketplace.'));
      process.exit(1);
    }
    pluginName = await select({
      message: 'Select a plugin to bump:',
      choices: localPlugins.map((p) => ({
        name: `${p.name.padEnd(30)} ${chalk.gray('v' + (p.version ?? '?'))}`,
        value: p.name,
      })),
    });
  }

  let context;
  try {
    context = resolveContext(cwd, pluginName);
  } catch (err: unknown) {
    console.error(chalk.red('Error: ' + (err instanceof Error ? err.message : String(err))));
    process.exit(1);
  }

  const { marketplace, plugin } = context;

  // Resolve 'auto' by reading conventional commits from git history
  if (type === 'auto') {
    const detected = await detectBumpTypeFromHistory(marketplace.rootDir, plugin.pluginDir);
    if (!detected) {
      console.error(
        chalk.red('Error: No commits found since last tag. Cannot auto-detect bump type.') +
          '\nSpecify a type explicitly: cmm bump patch|minor|major'
      );
      process.exit(1);
    }
    type = detected;
    console.log(chalk.gray(`Auto-detected bump type from git history: ${chalk.bold(type)}\n`));
  }

  // Compute new versions
  const currentPluginVersion = plugin.config.version;
  const currentMarketplaceVersion = marketplace.config.metadata?.version ?? '0.0.0';

  const newPluginVersion = bumpVersion(currentPluginVersion, type);
  const newMarketplaceVersion = bumpVersion(currentMarketplaceVersion, type);

  // Check if plugin is registered in marketplace.json
  let pluginEntry = marketplace.config.plugins.find((p) => p.name === plugin.config.name);

  if (!pluginEntry && !opts.dryRun) {
    const shouldRegister = await confirm({
      message: `"${plugin.config.name}" is not registered in marketplace.json. Register it now?`,
      default: true,
    });
    if (!shouldRegister) {
      console.log(chalk.yellow('Aborting. Register the plugin with `cmm add` first.'));
      process.exit(0);
    }
    // Add a placeholder entry — it will be populated with the new version below
    const newEntry: MarketplacePlugin = {
      name: plugin.config.name,
      source: marketplace.isSinglePlugin ? './' : `./${plugin.config.name}`,
      version: newPluginVersion,
    };
    marketplace.config.plugins.push(newEntry);
    pluginEntry = newEntry;
  }

  const oldEntryVersion = pluginEntry?.version ?? '(unset)';

  if (opts.dryRun) {
    console.log(chalk.yellow('Dry run — no changes will be made.\n'));
    console.log(chalk.bold('Proposed changes:'));
    console.log(
      `  ${chalk.cyan('plugin.json')}       version           ` +
        `${chalk.red(currentPluginVersion)} → ${chalk.green(newPluginVersion)}`
    );
    console.log(
      `  ${chalk.cyan('marketplace.json')}  metadata.version  ` +
        `${chalk.red(currentMarketplaceVersion)} → ${chalk.green(newMarketplaceVersion)}`
    );
    if (!pluginEntry) {
      console.log(
        chalk.yellow(
          `\n  ⚠ "${plugin.config.name}" is not registered in marketplace.json.` +
            `\n    It would be registered with version ${newPluginVersion}.`
        )
      );
    } else {
      console.log(
        `  ${chalk.cyan('marketplace.json')}  plugins[${plugin.config.name}].version  ` +
          `${chalk.red(oldEntryVersion)} → ${chalk.green(newPluginVersion)}`
      );
    }
    console.log(
      `\n  ${chalk.cyan('git commit')}  "chore: bump ${plugin.config.name} to v${newPluginVersion}"`
    );
    console.log(`  ${chalk.cyan('git tag')}     v${newMarketplaceVersion}`);
    return;
  }

  // Apply changes to plugin.json
  writePlugin(plugin.configPath, { ...plugin.config, version: newPluginVersion });

  // Apply changes to marketplace.json
  const updatedMarketplace = {
    ...marketplace.config,
    metadata: {
      ...marketplace.config.metadata,
      version: newMarketplaceVersion,
    },
    plugins: marketplace.config.plugins.map((p) =>
      p.name === plugin.config.name ? { ...p, version: newPluginVersion } : p
    ),
  };
  writeMarketplace(marketplace.configPath, updatedMarketplace);

  // Git commit + tag
  const repoIsGit = await isGitRepo(marketplace.rootDir);
  if (repoIsGit) {
    const filesToStage = [
      path.relative(marketplace.rootDir, plugin.configPath),
      path.relative(marketplace.rootDir, marketplace.configPath),
    ];
    try {
      await gitCommitAndTag(
        marketplace.rootDir,
        `chore: bump ${plugin.config.name} to v${newPluginVersion}`,
        `v${newMarketplaceVersion}`,
        filesToStage
      );
      console.log(
        chalk.green(
          `✓ Committed "chore: bump ${plugin.config.name} to v${newPluginVersion}"`
        )
      );
      console.log(chalk.green(`✓ Tagged v${newMarketplaceVersion}`));
    } catch (err: unknown) {
      console.warn(
        chalk.yellow(
          'Warning: Files updated, but git commit/tag failed.\n' +
            (err instanceof Error ? err.message : String(err))
        )
      );
    }
  } else {
    console.log(chalk.gray('  (not a git repository — skipping commit and tag)'));
  }

  console.log(chalk.green(`\n✓ ${plugin.config.name}  v${currentPluginVersion} → v${newPluginVersion}`));
  console.log(
    chalk.green(`✓ marketplace      v${currentMarketplaceVersion} → v${newMarketplaceVersion}`)
  );
}
