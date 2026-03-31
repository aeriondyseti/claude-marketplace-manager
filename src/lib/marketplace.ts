import fs from 'fs';
import { MarketplaceConfig } from '../types.js';

export function readMarketplace(filePath: string): MarketplaceConfig {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as MarketplaceConfig;
}

export function writeMarketplace(filePath: string, config: MarketplaceConfig): void {
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}
