import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { findMarketplaceRoot, getMarketplaceContext } from '../lib/context.js';
import { writeMarketplace } from '../lib/marketplace.js';
import { writePlugin } from '../lib/plugin.js';
import { PluginConfig } from '../types.js';

export async function add(pluginName: string): Promise<void> {
  const cwd = process.cwd();
  const marketplaceRoot = findMarketplaceRoot(cwd);

  if (!marketplaceRoot) {
    console.error(chalk.red('Error: Not inside a marketplace. Run from the marketplace root.'));
    process.exit(1);
  }

  const marketplace = getMarketplaceContext(marketplaceRoot);

  if (marketplace.isSinglePlugin) {
    console.error(
      chalk.red('Error: This is a single-plugin marketplace.') +
        '\nTo add more plugins, convert to a multi-plugin marketplace or create a new one with `cmm init`.'
    );
    process.exit(1);
  }

  // Validate name
  if (!/^[a-z0-9-]+$/.test(pluginName)) {
    console.error(
      chalk.red(`Error: Plugin name "${pluginName}" is invalid.`) +
        '\nPlugin names must be lowercase kebab-case (e.g. my-plugin).'
    );
    process.exit(1);
  }

  const pluginDir = path.join(marketplaceRoot, pluginName);

  if (fs.existsSync(pluginDir)) {
    console.error(chalk.red(`Error: Directory "${pluginName}" already exists.`));
    process.exit(1);
  }

  // Scaffold plugin
  fs.mkdirSync(path.join(pluginDir, '.claude-plugin'), { recursive: true });

  const pluginConfig: PluginConfig = { name: pluginName, version: '0.1.0' };
  writePlugin(path.join(pluginDir, '.claude-plugin', 'plugin.json'), pluginConfig);

  for (const dir of ['skills', 'hooks', 'agents']) {
    fs.mkdirSync(path.join(pluginDir, dir), { recursive: true });
    fs.writeFileSync(path.join(pluginDir, dir, '.gitkeep'), '', 'utf-8');
  }

  fs.writeFileSync(path.join(pluginDir, 'mcp.json'), '{}\n', 'utf-8');

  console.log(chalk.green(`✓ Scaffolded plugin at ./${pluginName}/`));
  console.log(chalk.gray(`  ./${pluginName}/.claude-plugin/plugin.json`));
  console.log(chalk.gray(`  ./${pluginName}/skills/`));
  console.log(chalk.gray(`  ./${pluginName}/hooks/`));
  console.log(chalk.gray(`  ./${pluginName}/agents/`));
  console.log(chalk.gray(`  ./${pluginName}/mcp.json`));

  const alreadyRegistered = marketplace.config.plugins.some((p) => p.name === pluginName);
  if (alreadyRegistered) {
    console.log(chalk.yellow(`\n"${pluginName}" is already registered in marketplace.json.`));
    return;
  }

  const shouldRegister = await confirm({
    message: `Register "${pluginName}" in marketplace.json?`,
    default: true,
  });

  if (shouldRegister) {
    const updated = {
      ...marketplace.config,
      plugins: [
        ...marketplace.config.plugins,
        { name: pluginName, source: `./${pluginName}`, version: '0.1.0' },
      ],
    };
    writeMarketplace(marketplace.configPath, updated);
    console.log(chalk.green(`✓ Registered "${pluginName}" in marketplace.json`));
  } else {
    console.log(
      chalk.gray(`\nSkipped registration. Run "cmm add ${pluginName}" again or edit marketplace.json manually.`)
    );
  }
}
