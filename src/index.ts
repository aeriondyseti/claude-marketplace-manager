import { Command } from 'commander';
import { init } from './commands/init.js';
import { add } from './commands/add.js';
import { bump } from './commands/bump.js';
import { status } from './commands/status.js';
import { BumpType } from './types.js';

const program = new Command();

program
  .name('cmm')
  .description('Claude Marketplace Manager — manage plugin versions in a Claude Code marketplace')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize a new marketplace in the current directory')
  .action(async () => {
    await init();
  });

program
  .command('add <plugin-name>')
  .description('Scaffold a new plugin inside the current marketplace')
  .action(async (pluginName: string) => {
    await add(pluginName);
  });

program
  .command('bump <type> [plugin-name]')
  .description('Bump a plugin version (and the marketplace version)')
  .option('--dry-run', 'Preview changes without writing any files')
  .addHelpText(
    'after',
    `
Bump types:
  patch    Bug fix — 1.0.0 → 1.0.1
  minor    New feature — 1.0.0 → 1.1.0
  major    Breaking change — 1.0.0 → 2.0.0

Examples:
  cmm bump patch                        # from inside a plugin directory
  cmm bump minor my-plugin              # from the marketplace root
  cmm bump major my-plugin --dry-run    # preview without applying
`
  )
  .action(async (type: string, pluginName: string | undefined, opts: { dryRun?: boolean }) => {
    const valid: BumpType[] = ['major', 'minor', 'patch'];
    if (!valid.includes(type as BumpType)) {
      console.error(`Error: Invalid bump type "${type}". Use major, minor, or patch.`);
      process.exit(1);
    }
    await bump(type as BumpType, pluginName, opts);
  });

program
  .command('status')
  .description('Show all plugins and their versions in the current marketplace')
  .action(() => {
    status();
  });

program.parse();
