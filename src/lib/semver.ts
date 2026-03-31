import semver from 'semver';
import { BumpType } from '../types.js';

export function bumpVersion(current: string, type: BumpType): string {
  const result = semver.inc(current, type);
  if (!result) {
    throw new Error(`Cannot bump version "${current}" with type "${type}"`);
  }
  return result;
}

export function isValidVersion(version: string): boolean {
  return semver.valid(version) !== null;
}
