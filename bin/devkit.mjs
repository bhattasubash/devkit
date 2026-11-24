#!/usr/bin/env node

/**
 * @bhattasubash/devkit — CLI installer and toolkit for AI coding agents
 *
 * Fast, zero-dependency CLI that detects .cursor, .claude, .codex, or .agent folders
 * and scaffolds devkit skills + the .devkit/ state & scope directory in seconds.
 *
 * Usage:
 *   npx @bhattasubash/devkit init [options]
 *   devkit init [options]
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir, cp, stat } from 'node:fs/promises';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import process from 'node:process';
import { performance } from 'node:perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = resolve(__dirname, '..');

// Terminal styling with zero dependencies
const isColorSupported =
  !process.env.NO_COLOR &&
  (process.env.FORCE_COLOR || (process.stdout.isTTY && !process.env.NODE_DISABLE_COLORS));

const c = {
  reset: isColorSupported ? '\x1b[0m' : '',
  bold: isColorSupported ? '\x1b[1m' : '',
  dim: isColorSupported ? '\x1b[2m' : '',
  green: isColorSupported ? '\x1b[32m' : '',
  cyan: isColorSupported ? '\x1b[36m' : '',
  yellow: isColorSupported ? '\x1b[33m' : '',
  blue: isColorSupported ? '\x1b[34m' : '',
  magenta: isColorSupported ? '\x1b[35m' : '',
  red: isColorSupported ? '\x1b[31m' : '',
};

async function getPackageVersion() {
  try {
    const pkg = JSON.parse(await readFile(join(PACKAGE_ROOT, 'package.json'), 'utf-8'));
    return pkg.version || '1.1.0';
  } catch {
    return '1.1.0';
  }
}

const AGENT_DEFINITIONS = [
  { id: 'cursor', name: 'Cursor', checkDirs: ['.cursor'], skillRelPath: join('.cursor', 'skills', 'devkit') },
  { id: 'claude', name: 'Claude Code', checkDirs: ['.claude'], skillRelPath: join('.claude', 'skills', 'devkit') },
  { id: 'codex', name: 'Codex CLI', checkDirs: ['.codex'], skillRelPath: join('.codex', 'skills', 'devkit') },
  { id: 'agents', name: 'Agent Skills (Universal)', checkDirs: ['.agents', '.agent'], skillRelPath: join('.agents', 'skills', 'devkit') },
  { id: 'gemini', name: 'Gemini / Antigravity', checkDirs: ['.gemini', '.antigravity'], skillRelPath: join('.gemini', 'skills', 'devkit') },
  { id: 'windsurf', name: 'Windsurf', checkDirs: ['.windsurf'], skillRelPath: join('.windsurf', 'skills', 'devkit') },
];

const SKILL_PAYLOAD = [
  'SKILL.md',
  'security-audit',
  'web-best-practices',
  'anti-slop-design',
  'seo-audit',
  'shared',
  'LICENSE',
  'CHANGELOG.md',
];

function printBanner(version) {
  console.log(`
${c.cyan}${c.bold}   ____            _    _ _   ${c.reset}
${c.cyan}${c.bold}  |  _ \\  _____   _| | _(_) |_ ${c.reset}
${c.cyan}${c.bold}  | | | |/ _ \\ \\ / / |/ / | __|${c.reset}
${c.cyan}${c.bold}  | |_| |  __/\\ V /|   <| | |_ ${c.reset}
${c.cyan}${c.bold}  |____/ \\___| \\_/ |_|\\_\\_|\\__|${c.reset} ${c.dim}v${version}${c.reset}
${c.dim}  Deterministic Agent Skills for Cursor, Claude, Codex & Agents${c.reset}
`);
}

function printHelp(version) {
  printBanner(version);
  console.log(`${c.bold}USAGE${c.reset}
  npx @bhattasubash/devkit [command] [options]
  devkit [command] [options]

${c.bold}COMMANDS${c.reset}
  ${c.green}init${c.reset}               Auto-detect agent folders and scaffold skills + .devkit/ (default)
  ${c.green}check${c.reset}              Verify installed devkit skills and project health
  ${c.green}--help, -h${c.reset}         Show this help screen
  ${c.green}--version, -v${c.reset}      Show current version

${c.bold}OPTIONS${c.reset}
  ${c.cyan}--agent <list>${c.reset}     Target specific agents (e.g. cursor,claude,codex,agents,all)
  ${c.cyan}--global, -g${c.reset}       Install globally to user home directory (~/.cursor, ~/.claude)
  ${c.cyan}--force, -f${c.reset}        Overwrite existing installed skill directories
  ${c.cyan}--dry-run${c.reset}          Simulate actions without writing any files to disk
  ${c.cyan}--cwd <path>${c.reset}       Target directory (defaults to current working directory)
  ${c.cyan}--silent, -s${c.reset}      Suppress banner and non-essential logs

${c.bold}EXAMPLES${c.reset}
  ${c.dim}# One-line fast project scaffolding${c.reset}
  npx @bhattasubash/devkit init

  ${c.dim}# Force scaffold to specific agents${c.reset}
  npx @bhattasubash/devkit init --agent cursor,claude --force

  ${c.dim}# Dry run to preview target directories${c.reset}
  npx @bhattasubash/devkit init --dry-run
`);
}

function parseCliArgs(args) {
  let command = null;
  const options = {
    agent: null,
    global: false,
    force: false,
    dryRun: false,
    cwd: process.cwd(),
    silent: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--version' || arg === '-v') {
      options.version = true;
    } else if (arg === '--global' || arg === '-g') {
      options.global = true;
    } else if (arg === '--force' || arg === '-f') {
      options.force = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--silent' || arg === '-s') {
      options.silent = true;
    } else if (arg === '--cwd') {
      options.cwd = resolve(args[++i]);
    } else if (arg === '--agent' || arg === '-a') {
      options.agent = args[++i];
    } else if (!command && !arg.startsWith('-')) {
      command = arg;
    }
  }

  if (!command) {
    command = 'init';
  }

  return { command, options };
}

function detectAgents(baseDir, requestedAgents) {
  const detected = [];

  // If specific agents requested
  if (requestedAgents) {
    const list = requestedAgents.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    if (list.includes('all')) {
      return AGENT_DEFINITIONS;
    }
    for (const def of AGENT_DEFINITIONS) {
      if (list.includes(def.id) || list.includes(def.name.toLowerCase())) {
        detected.push(def);
      }
    }
    return detected;
  }

  // Auto-detect based on folder presence
  for (const def of AGENT_DEFINITIONS) {
    for (const dirName of def.checkDirs) {
      if (existsSync(join(baseDir, dirName))) {
        detected.push(def);
        break;
      }
    }
  }

  return detected;
}

async function scaffoldDevkitDirectory(targetDir, dryRun, force) {
  const devkitDir = join(targetDir, '.devkit');
  const reportsDir = join(devkitDir, 'reports');
  const statePath = join(devkitDir, 'state.json');
  const scopePath = join(devkitDir, 'scope.json');
  const gitignorePath = join(targetDir, '.gitignore');

  const operations = [];

  // 1. Template state
  let stateContent;
  const templatePath = join(PACKAGE_ROOT, 'shared', 'scripts', 'state.template.json');
  if (existsSync(templatePath)) {
    const rawTemplate = JSON.parse(await readFile(templatePath, 'utf-8'));
    rawTemplate.started_at = new Date().toISOString();
    rawTemplate.updated_at = new Date().toISOString();
    stateContent = JSON.stringify(rawTemplate, null, 2) + '\n';
  } else {
    stateContent = JSON.stringify(
      {
        skill: 'devkit',
        mode: 'standard',
        status: 'pending',
        started_at: new Date().toISOString(),
      },
      null,
      2
    ) + '\n';
  }

  // 2. Default scope lock
  const scopeContent =
    JSON.stringify(
      {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        version: '1.0.0',
        allowed_files: ['src/**', 'public/**', 'app/**', 'components/**', 'pages/**'],
        allow_dependency_changes: false,
      },
      null,
      2
    ) + '\n';

  if (!dryRun) {
    await mkdir(reportsDir, { recursive: true });

    if (!existsSync(statePath) || force) {
      await writeFile(statePath, stateContent, 'utf-8');
      operations.push('.devkit/state.json (initialized)');
    } else {
      operations.push('.devkit/state.json (preserved existing)');
    }

    if (!existsSync(scopePath) || force) {
      await writeFile(scopePath, scopeContent, 'utf-8');
      operations.push('.devkit/scope.json (locked to safe source files)');
    } else {
      operations.push('.devkit/scope.json (preserved existing)');
    }

    // Reports .gitkeep
    const gitkeep = join(reportsDir, '.gitkeep');
    if (!existsSync(gitkeep)) {
      await writeFile(gitkeep, '', 'utf-8');
    }

    // Gitignore integration
    if (existsSync(gitignorePath)) {
      const gitignore = await readFile(gitignorePath, 'utf-8');
      if (!gitignore.includes('.devkit')) {
        const separator = gitignore.endsWith('\n') ? '' : '\n';
        await writeFile(gitignorePath, `${gitignore}${separator}\n# devkit audit state and reports\n.devkit/\n`, 'utf-8');
        operations.push('.gitignore (appended .devkit/)');
      }
    }
  } else {
    operations.push('[dry-run] .devkit/state.json');
    operations.push('[dry-run] .devkit/scope.json');
    operations.push('[dry-run] .devkit/reports/');
  }

  return operations;
}

async function copySkillFiles(packageRoot, destDir, dryRun, force) {
  if (existsSync(destDir) && !force) {
    return { skipped: true };
  }

  if (dryRun) {
    return { skipped: false, fileCount: SKILL_PAYLOAD.length };
  }

  await mkdir(destDir, { recursive: true });

  let copied = 0;
  for (const item of SKILL_PAYLOAD) {
    const src = join(packageRoot, item);
    const dest = join(destDir, item);
    if (existsSync(src)) {
      await cp(src, dest, { recursive: true, force: true });
      copied++;
    }
  }

  return { skipped: false, fileCount: copied };
}

async function runInit(options) {
  const startTime = performance.now();
  const version = await getPackageVersion();

  if (!options.silent) {
    printBanner(version);
  }

  const baseDir = options.global ? homedir() : options.cwd;
  const isGlobal = options.global;

  if (options.dryRun && !options.silent) {
    console.log(`${c.yellow}${c.bold}⚡ DRY RUN MODE ACTIVE${c.reset} — No disk modifications will be made.\n`);
  }

  // Step 1: Detect agents
  let agents = detectAgents(baseDir, options.agent);

  if (agents.length === 0) {
    // Default to Universal Agent Skills standard (.agents/skills/devkit)
    const fallback = AGENT_DEFINITIONS.find(a => a.id === 'agents');
    agents = [fallback];
    if (!options.silent) {
      console.log(
        `${c.dim}ℹ No existing agent folders detected (.cursor, .claude, .codex).${c.reset}\n` +
          `  ${c.cyan}→ Scaffolding to universal open standard:${c.reset} ${c.bold}.agents/skills/devkit${c.reset}\n`
      );
    }
  } else if (!options.silent) {
    console.log(`${c.green}✔ Detected agents:${c.reset}`);
    for (const a of agents) {
      console.log(`  ${c.bold}•${c.reset} ${a.name} ${c.dim}(${a.checkDirs[0]})${c.reset}`);
    }
    console.log('');
  }

  // Step 2: Scaffold skill files into each agent target
  const scaffoldedTargets = [];
  const skippedTargets = [];

  for (const agent of agents) {
    const targetSkillPath = join(baseDir, agent.skillRelPath);
    const relDisplay = relative(process.cwd(), targetSkillPath) || agent.skillRelPath;

    const res = await copySkillFiles(PACKAGE_ROOT, targetSkillPath, options.dryRun, options.force);
    if (res.skipped) {
      skippedTargets.push(relDisplay);
    } else {
      scaffoldedTargets.push(relDisplay);
    }
  }

  if (scaffoldedTargets.length > 0 && !options.silent) {
    console.log(`${c.green}✔ ${options.dryRun ? '[dry-run] ' : ''}Scaffolded skills to:${c.reset}`);
    for (const t of scaffoldedTargets) {
      console.log(`  ${c.cyan}•${c.reset} ${t}`);
    }
    console.log('');
  }

  if (skippedTargets.length > 0 && !options.silent) {
    console.log(`${c.yellow}ℹ Already exists (use --force to overwrite):${c.reset}`);
    for (const t of skippedTargets) {
      console.log(`  ${c.dim}• ${t}${c.reset}`);
    }
    console.log('');
  }

  // Step 3: Scaffold .devkit directory (project mode only)
  if (!isGlobal) {
    const ops = await scaffoldDevkitDirectory(baseDir, options.dryRun, options.force);
    if (!options.silent && ops.length > 0) {
      console.log(`${c.green}✔ ${options.dryRun ? '[dry-run] ' : ''}Scaffolded .devkit directory:${c.reset}`);
      for (const op of ops) {
        console.log(`  ${c.cyan}•${c.reset} ${op}`);
      }
      console.log('');
    }
  }

  const elapsed = (performance.now() - startTime).toFixed(1);

  if (!options.silent) {
    console.log(`${c.green}${c.bold}🚀 Devkit ready in ${elapsed}ms!${c.reset}\n`);
    console.log(`${c.bold}Next steps:${c.reset}`);
    console.log(`  1. Run a full audit with your agent:`);
    console.log(`     ${c.cyan}Ask your agent: "audit everything with devkit" or "/devkit"${c.reset}`);
    console.log(`  2. Or run individual scanners directly in terminal:`);
    const sampleAgent = agents[0] || AGENT_DEFINITIONS[0];
    console.log(`     ${c.dim}node ${sampleAgent.skillRelPath}/security-audit/scripts/check-secrets.mjs .${c.reset}\n`);
  }
}

async function main() {
  const version = await getPackageVersion();
  const { command, options } = parseCliArgs(process.argv.slice(2));

  if (options.help) {
    printHelp(version);
    process.exit(0);
  }

  if (options.version) {
    console.log(`v${version}`);
    process.exit(0);
  }

  if (command === 'init') {
    await runInit(options);
  } else if (command === 'check') {
    console.log(`Devkit v${version} installed and operational.`);
  } else {
    console.error(`${c.red}Unknown command: "${command}"${c.reset}\n`);
    printHelp(version);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n${c.red}${c.bold}Error:${c.reset} ${err.message}`);
  if (process.env.DEBUG) {
    console.error(err);
  }
  process.exit(1);
});
