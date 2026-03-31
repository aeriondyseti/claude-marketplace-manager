import path from 'path';
import fs from 'fs';
import { MarketplaceContext, PluginContext, ResolvedContext } from '../types.js';
import { readMarketplace } from './marketplace.js';
import { readPlugin } from './plugin.js';

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Walk up from startDir until we find a directory containing .claude-plugin/marketplace.json */
export function findMarketplaceRoot(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    if (fileExists(path.join(dir, '.claude-plugin', 'marketplace.json'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Walk up from startDir until we find a directory containing .claude-plugin/plugin.json */
export function findPluginRoot(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    if (fileExists(path.join(dir, '.claude-plugin', 'plugin.json'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function getMarketplaceContext(rootDir: string): MarketplaceContext {
  const configPath = path.join(rootDir, '.claude-plugin', 'marketplace.json');
  const config = readMarketplace(configPath);
  const isSinglePlugin = fileExists(path.join(rootDir, '.claude-plugin', 'plugin.json'));
  return { rootDir, isSinglePlugin, config, configPath };
}

export function getPluginContext(pluginDir: string): PluginContext {
  const configPath = path.join(pluginDir, '.claude-plugin', 'plugin.json');
  const config = readPlugin(configPath);
  return { pluginDir, pluginName: config.name, config, configPath };
}

/**
 * Resolve the marketplace and plugin context from the current working directory.
 *
 * If pluginName is provided, find the marketplace root from cwd and locate the
 * named plugin inside it. Otherwise, detect the plugin from cwd by walking up
 * to find a plugin.json, then find the enclosing marketplace.
 */
export function resolveContext(cwd: string, pluginName?: string): ResolvedContext {
  if (pluginName) {
    const marketplaceRoot = findMarketplaceRoot(cwd);
    if (!marketplaceRoot) {
      throw new Error('Not inside a marketplace. Run from within a marketplace directory.');
    }

    const marketplace = getMarketplaceContext(marketplaceRoot);

    let pluginDir: string;
    if (marketplace.isSinglePlugin) {
      // In a single-plugin marketplace the plugin lives at the root
      const existingPlugin = marketplace.config.plugins[0];
      if (existingPlugin && existingPlugin.name !== pluginName) {
        throw new Error(
          `Plugin "${pluginName}" not found. This is a single-plugin marketplace with plugin "${existingPlugin.name}".`
        );
      }
      pluginDir = marketplaceRoot;
    } else {
      pluginDir = path.join(marketplaceRoot, pluginName);
    }

    if (!fileExists(path.join(pluginDir, '.claude-plugin', 'plugin.json'))) {
      throw new Error(
        `Plugin "${pluginName}" not found at ${pluginDir}. ` +
          `Have you run "cmm add ${pluginName}" yet?`
      );
    }

    const plugin = getPluginContext(pluginDir);
    return { marketplace, plugin };
  }

  // No plugin name — detect from cwd
  const pluginRoot = findPluginRoot(cwd);
  if (!pluginRoot) {
    throw new Error(
      'Not inside a plugin directory and no plugin name provided.\n' +
        'Run from within a plugin directory, or specify a name: cmm bump <type> <plugin-name>'
    );
  }

  const plugin = getPluginContext(pluginRoot);

  const marketplaceRoot = findMarketplaceRoot(pluginRoot);
  if (!marketplaceRoot) {
    throw new Error(
      'Could not find a marketplace.json. Ensure you are inside a marketplace.'
    );
  }

  const marketplace = getMarketplaceContext(marketplaceRoot);
  return { marketplace, plugin };
}
