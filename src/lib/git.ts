import { simpleGit } from 'simple-git';
import { BumpType } from '../types.js';

export async function gitCommitAndTag(
  repoDir: string,
  message: string,
  tag: string,
  files: string[]
): Promise<void> {
  const git = simpleGit(repoDir);
  await git.add(files);
  await git.commit(message);
  await git.addTag(tag);
}

export async function isGitRepo(dir: string): Promise<boolean> {
  try {
    const git = simpleGit(dir);
    const result = await git.checkIsRepo();
    return result;
  } catch {
    return false;
  }
}

/**
 * Detect the bump type from conventional commit messages since the last tag.
 *
 * Rules:
 *   - Any commit with a `BREAKING CHANGE:` trailer or `!` after the type → major
 *   - `feat:` or `feat(scope):` → minor
 *   - Everything else (fix, chore, docs, refactor, etc.) → patch
 *
 * Returns the highest level found across all commits.
 * If there are no commits since the last tag (or no tags at all and no commits),
 * returns null.
 */
export async function detectBumpTypeFromHistory(
  repoDir: string,
  pluginDir?: string
): Promise<BumpType | null> {
  const git = simpleGit(repoDir);

  // Find the most recent tag
  let range: string;
  try {
    const latestTag = (await git.raw(['describe', '--tags', '--abbrev=0'])).trim();
    range = `${latestTag}..HEAD`;
  } catch {
    // No tags exist — use all commits
    range = 'HEAD';
  }

  // Get commit messages since the last tag, optionally scoped to the plugin directory
  const args = ['log', range, '--format=%B---CMM_DELIM---'];
  if (pluginDir && pluginDir !== repoDir) {
    const relative = pluginDir.replace(repoDir + '/', '');
    args.push('--', relative);
  }

  let raw: string;
  try {
    raw = await git.raw(args);
  } catch {
    return null;
  }

  const messages = raw
    .split('---CMM_DELIM---')
    .map((m) => m.trim())
    .filter(Boolean);

  if (messages.length === 0) return null;

  let level: BumpType = 'patch';

  for (const msg of messages) {
    // Check for breaking changes
    if (/^[a-z]+(\(.+\))?!:/m.test(msg) || /^BREAKING[ -]CHANGE:/m.test(msg)) {
      return 'major'; // Can't go higher — return immediately
    }
    // Check for feat
    if (/^feat(\(.+\))?:/m.test(msg)) {
      level = 'minor';
    }
  }

  return level;
}
