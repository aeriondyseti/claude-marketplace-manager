import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { input, confirm, select } from '@inquirer/prompts';
import { writeMarketplace } from '../lib/marketplace.js';
import { writePlugin } from '../lib/plugin.js';
import { MarketplaceConfig, PluginConfig } from '../types.js';

function toKebabCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export async function init(): Promise<void> {
  const cwd = process.cwd();
  const claudePluginDir = path.join(cwd, '.claude-plugin');

  if (fs.existsSync(path.join(claudePluginDir, 'marketplace.json'))) {
    console.error(chalk.red('Error: A marketplace already exists in this directory.'));
    process.exit(1);
  }

  console.log(chalk.bold('\nClaude Marketplace Manager — init\n'));

  const rawName = await input({
    message: 'Marketplace name:',
    validate: (v) => (v.trim().length > 0 ? true : 'Name is required'),
  });
  const name = toKebabCase(rawName);
  if (name !== rawName.trim()) {
    console.log(chalk.gray(`  → normalized to "${name}"`));
  }

  const ownerName = await input({
    message: 'Owner name:',
    validate: (v) => (v.trim().length > 0 ? true : 'Owner name is required'),
  });

  const ownerEmail = await input({
    message: 'Owner email (optional):',
  });

  const description = await input({
    message: 'Description (optional):',
  });

  const marketplaceType = await select<'single' | 'multi'>({
    message: 'Marketplace type:',
    choices: [
      {
        name: 'Multi-plugin  — marketplace repo with plugin subfolders',
        value: 'multi',
      },
      {
        name: 'Single-plugin — marketplace and plugin share the same root',
        value: 'single',
      },
    ],
  });

  const isSingle = marketplaceType === 'single';

  let pluginName = name;
  if (isSingle) {
    const rawPluginName = await input({
      message: `Plugin name (default: "${name}"):`,
    });
    if (rawPluginName.trim()) {
      pluginName = toKebabCase(rawPluginName);
    }
  }

  // Build marketplace config
  const marketplaceConfig: MarketplaceConfig = {
    name,
    owner: {
      name: ownerName.trim(),
      ...(ownerEmail.trim() ? { email: ownerEmail.trim() } : {}),
    },
    metadata: {
      version: '0.1.0',
      ...(description.trim() ? { description: description.trim() } : {}),
    },
    plugins: isSingle ? [{ name: pluginName, source: './', version: '0.1.0' }] : [],
  };

  fs.mkdirSync(claudePluginDir, { recursive: true });
  writeMarketplace(path.join(claudePluginDir, 'marketplace.json'), marketplaceConfig);
  console.log(chalk.green('\n✓ Created .claude-plugin/marketplace.json'));

  if (isSingle) {
    const pluginConfig: PluginConfig = {
      name: pluginName,
      version: '0.1.0',
      ...(description.trim() ? { description: description.trim() } : {}),
    };
    writePlugin(path.join(claudePluginDir, 'plugin.json'), pluginConfig);
    fs.mkdirSync(path.join(cwd, 'skills'), { recursive: true });
    fs.writeFileSync(path.join(cwd, 'skills', '.gitkeep'), '', 'utf-8');
    fs.mkdirSync(path.join(cwd, 'hooks'), { recursive: true });
    fs.writeFileSync(path.join(cwd, 'hooks', '.gitkeep'), '', 'utf-8');
    fs.mkdirSync(path.join(cwd, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(cwd, 'agents', '.gitkeep'), '', 'utf-8');
    fs.writeFileSync(path.join(cwd, 'mcp.json'), '{}\n', 'utf-8');
    console.log(chalk.green('✓ Created .claude-plugin/plugin.json'));
    console.log(chalk.green('✓ Created skills/, hooks/, agents/ and mcp.json'));
  } else {
    console.log(chalk.gray('\nRun `cmm add <plugin-name>` to scaffold your first plugin.'));
  }

  console.log(chalk.bold('\nDone! Your marketplace is ready.\n'));

  const shouldConfirmGit = await confirm({
    message: 'Would you like to see the next steps?',
    default: true,
  });

  if (shouldConfirmGit) {
    console.log(`
${chalk.bold('Next steps:')}
  ${chalk.cyan('git add .')}
  ${chalk.cyan('git commit -m "chore: initialize marketplace"')}
${isSingle ? '' : `  ${chalk.cyan('cmm add <plugin-name>')}  — scaffold your first plugin\n`}
Users can add your marketplace with:
  ${chalk.cyan(`/plugin marketplace add <your-github-user>/<repo>`)}
`);
  }
}
