import { simpleGit } from 'simple-git';

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
