export type BumpType = 'major' | 'minor' | 'patch';

export interface MarketplaceOwner {
  name: string;
  email?: string;
}

export interface MarketplaceMetadata {
  version: string;
  description?: string;
  pluginRoot?: string;
}

export interface ExternalPluginSource {
  source: 'github' | 'url' | 'git-subdir' | 'npm';
  repo?: string;
  url?: string;
  path?: string;
  ref?: string;
  sha?: string;
  package?: string;
  version?: string;
  registry?: string;
}

export interface MarketplacePlugin {
  name: string;
  source: string | ExternalPluginSource;
  description?: string;
  version?: string;
  author?: { name: string; email?: string; url?: string };
  category?: string;
  tags?: string[];
  homepage?: string;
  repository?: string;
  license?: string;
}

export interface MarketplaceConfig {
  name: string;
  owner: MarketplaceOwner;
  metadata?: Partial<MarketplaceMetadata>;
  plugins: MarketplacePlugin[];
}

export interface PluginConfig {
  name: string;
  version: string;
  description?: string;
  author?: { name: string; email?: string; url?: string };
  homepage?: string;
  repository?: string;
  license?: string;
  keywords?: string[];
  commands?: string | string[];
  agents?: string | string[];
  skills?: string | string[];
  hooks?: string | Record<string, unknown>;
  mcpServers?: string | Record<string, unknown>;
  lspServers?: string | Record<string, unknown>;
  outputStyles?: string;
  userConfig?: Record<string, unknown>;
}

export interface MarketplaceContext {
  rootDir: string;
  isSinglePlugin: boolean;
  config: MarketplaceConfig;
  configPath: string;
}

export interface PluginContext {
  pluginDir: string;
  pluginName: string;
  config: PluginConfig;
  configPath: string;
}

export interface ResolvedContext {
  marketplace: MarketplaceContext;
  plugin: PluginContext;
}
