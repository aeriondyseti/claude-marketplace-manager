import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { findMarketplaceRoot, getMarketplaceContext, getPluginContext } from '../lib/context.js';
import { ExternalPluginSource, MarketplacePlugin, PluginConfig } from '../types.js';

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

interface PluginComponents {
  skills: string[];
  agents: string[];
  hooks: string[];
  mcpServers: string[];
}

/** List .md files (without extension) in a directory */
function listMdFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== '.gitkeep')
      .map((e) => e.name.replace(/\.md$/, ''));
  } catch {
    return [];
  }
}

/** List subdirectories that contain a SKILL.md */
function listSkills(baseDir: string): string[] {
  if (!fs.existsSync(baseDir)) return [];
  try {
    return fs
      .readdirSync(baseDir, { withFileTypes: true })
      .filter(
        (e) =>
          e.isDirectory() && fs.existsSync(path.join(baseDir, e.name, 'SKILL.md'))
      )
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/** Read a JSON file and return its keys, or an empty array on failure */
function readJsonKeys(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return Object.keys(data);
    }
    return [];
  } catch {
    return [];
  }
}

function discoverComponents(pluginDir: string, config: PluginConfig): PluginComponents {
  // Skills
  const skillPaths = config.skills
    ? Array.isArray(config.skills) ? config.skills : [config.skills]
    : ['./skills/'];
  const skills = skillPaths.flatMap((p) =>
    typeof p === 'string' ? listSkills(path.resolve(pluginDir, p)) : []
  );

  // Agents
  const agentPaths = config.agents
    ? Array.isArray(config.agents) ? config.agents : [config.agents]
    : ['./agents/'];
  const agents = agentPaths.flatMap((p) =>
    typeof p === 'string' ? listMdFiles(path.resolve(pluginDir, p)) : []
  );

  // Hooks
  let hooks: string[] = [];
  if (config.hooks) {
    if (typeof config.hooks === 'string') {
      hooks = readJsonKeys(path.resolve(pluginDir, config.hooks));
    } else {
      hooks = Object.keys(config.hooks);
    }
  } else {
    hooks = readJsonKeys(path.join(pluginDir, 'hooks', 'hooks.json'));
  }

  // MCP Servers
  let mcpServers: string[] = [];
  if (config.mcpServers) {
    if (typeof config.mcpServers === 'string') {
      mcpServers = readJsonKeys(path.resolve(pluginDir, config.mcpServers));
    } else {
      mcpServers = Object.keys(config.mcpServers);
    }
  } else {
    // Try common file names
    for (const name of ['mcp.json', '.mcp.json', 'mcp-config.json']) {
      mcpServers = readJsonKeys(path.join(pluginDir, name));
      if (mcpServers.length > 0) break;
    }
  }

  return { skills, agents, hooks, mcpServers };
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
    console.log(`  ${chalk.bold(entry.name.padEnd(nameWidth))} ${versionDisplay}`);
    console.log(`  ${''.padEnd(nameWidth)} ${label}`);

    // Show components for local plugins
    if (isLocalSource(entry.source)) {
      const pluginDir = path.resolve(marketplaceRoot, entry.source);
      const pluginJsonPath = path.join(pluginDir, '.claude-plugin', 'plugin.json');
      if (fs.existsSync(pluginJsonPath)) {
        try {
          const pluginConfig = getPluginContext(pluginDir).config;
          const components = discoverComponents(pluginDir, pluginConfig);
          const indent = '  ' + ''.padEnd(nameWidth);

          if (components.skills.length > 0) {
            console.log(`${indent} ${chalk.blue('skills:')}  ${components.skills.join(', ')}`);
          }
          if (components.agents.length > 0) {
            console.log(`${indent} ${chalk.blue('agents:')}  ${components.agents.join(', ')}`);
          }
          if (components.hooks.length > 0) {
            console.log(`${indent} ${chalk.blue('hooks:')}   ${components.hooks.join(', ')}`);
          }
          if (components.mcpServers.length > 0) {
            console.log(`${indent} ${chalk.blue('mcp:')}     ${components.mcpServers.join(', ')}`);
          }
        } catch {
          // ignore read errors
        }
      }
    }

    console.log();
  }
}
