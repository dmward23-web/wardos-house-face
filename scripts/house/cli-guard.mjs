/* CLIGUARD1 · scripts/house/cli-guard.mjs · branch wall-redesign-1 (Wright, Dan's ask Oct 1 7:45 PM CT).
   Runs BEFORE a writer CLI does any work: --help / -h prints usage and exits 0; an unknown flag, a stray argument
   or a flag missing its value prints the problem + usage to stderr and exits 2. Either way nothing is read or written. */
export const HOUSE_MODE_FLAGS = { "--data-dir": true, "--cal-live": true, "--events": true, "--kids-week": true, "--config": true,
  "--override": true, "--out": true, "--now": true, "--stdout": false };
/** flags: {"--name": takesValue}. Returns normally only when argv is valid. */
export function cliGuard(argv, { usage, flags }, io = { out: (s) => process.stdout.write(s), err: (s) => process.stderr.write(s), exit: (c) => process.exit(c) }) {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) { io.out(usage.trim() + "\n"); io.exit(0); return false; }
  for (let i = 0; i < args.length; i++) {
    const k = args[i];
    if (!Object.prototype.hasOwnProperty.call(flags, k)) { io.err(`unknown argument: ${k}\n${usage.trim()}\n`); io.exit(2); return false; }
    if (flags[k]) {
      const v = args[i + 1];
      if (v == null || v.startsWith("--")) { io.err(`${k} needs a value\n${usage.trim()}\n`); io.exit(2); return false; }
      i++;
    }
  }
  return true;
}
