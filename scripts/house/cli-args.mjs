/* ATLASLANE8 · scripts/house/cli-args.mjs · strict CLI args for every Atlas CLI. Runs before any read or write.
   --help / -h: print usage, exit 0, write nothing (wins over everything else on the line).
   Unknown flag, a value flag with no value, a repeated value flag, a bad --now, or a stray argument: usage on stderr, exit 2. */
export function cliArgs(argv, { name, usage, values = [], bools = [], positional = false }) {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) { process.stdout.write(usage + "\n"); process.exit(0); }
  const fail = (msg) => { process.stderr.write(`${name}: ${msg}. Nothing written.\n${usage}\n`); process.exit(2); };
  const out = { values: {}, bools: new Set(), positional: [] };
  for (let i = 0; i < args.length; i++) {
    const k = args[i];
    if (values.includes(k)) {
      const v = args[i + 1];
      if (v == null || v === "" || v.startsWith("-")) fail(`${k} needs a value`);
      if (k in out.values) fail(`${k} given twice`);
      out.values[k] = v; i++;
    } else if (bools.includes(k)) out.bools.add(k);
    else if (k.startsWith("-")) fail(`unknown flag ${k}`);
    else if (positional) out.positional.push(k);
    else fail(`unexpected argument ${k}`);
  }
  if ("--now" in out.values && isNaN(Date.parse(out.values["--now"]))) fail(`--now is not a date: ${out.values["--now"]}`);
  return out;
}
