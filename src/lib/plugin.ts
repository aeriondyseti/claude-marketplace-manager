import fs from 'fs';
import { PluginConfig } from '../types.js';

export function readPlugin(filePath: string): PluginConfig {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as PluginConfig;
}

export function writePlugin(filePath: string, config: PluginConfig): void {
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}
