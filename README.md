# cmm — Claude Marketplace Manager

A CLI tool for managing plugin versions and structure in a [Claude Code](https://claude.ai/code) plugin marketplace.

## Install

```bash
npm install -g @aeriondyseti/claude-marketplace-manager
```

Or run without installing:

```bash
npx -y @aeriondyseti/claude-marketplace-manager <command>
```

## Commands

### `cmm init`

Interactively initialize a new marketplace in the current directory. Prompts for name, owner, and whether it's a single-plugin or multi-plugin marketplace.

```bash
cd my-marketplace-repo
cmm init
```

### `cmm add <plugin-name>`

Scaffold a new plugin inside the current marketplace and optionally register it in `marketplace.json`.

```bash
cmm add my-new-plugin
```

Creates:
```
my-new-plugin/
├── .claude-plugin/plugin.json
├── skills/
├── hooks/
├── agents/
└── mcp.json
```

### `cmm bump <type> [plugin-name]`

Bump a plugin's version and the marketplace's version, then commit and tag.

```bash
# From inside a plugin directory
cmm bump patch

# From the marketplace root
cmm bump minor my-plugin
cmm bump major my-plugin --dry-run
```

Bump types: `patch` (bug fix), `minor` (new feature), `major` (breaking change).

The `--dry-run` flag previews changes without writing or committing anything.

### `cmm status`

Show all plugins in the current marketplace and their versions.

```bash
cmm status
```

## Marketplace structure

`cmm` expects a **monorepo-style marketplace**: the repo itself is the marketplace, and each plugin lives in its own subdirectory.

```
my-marketplace/
├── .claude-plugin/
│   └── marketplace.json      ← marketplace registry
├── plugin-one/
│   ├── .claude-plugin/
│   │   └── plugin.json
│   ├── skills/
│   └── mcp.json
└── plugin-two/
    ├── .claude-plugin/
    │   └── plugin.json
    └── ...
```

For **single-plugin marketplaces**, the plugin and marketplace share the same root — `marketplace.json` and `plugin.json` both live in `.claude-plugin/`.

## How versioning works

- Each plugin has its own semantic version in `plugin.json`.
- The marketplace has its own version in `marketplace.json` under `metadata.version`.
- Running `cmm bump` increments both — the plugin version and the marketplace version — by the specified level (`patch`, `minor`, or `major`).
- Other plugins in the marketplace are **not** bumped.
- A git commit and tag (`v<new-marketplace-version>`) are created automatically.

## License

MIT
