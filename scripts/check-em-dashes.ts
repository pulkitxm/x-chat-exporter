const forbiddenCharacter = String.fromCodePoint(0x2014);
const result = Bun.spawnSync(["git", "grep", "-n", forbiddenCharacter, "--", "."]);

if (result.exitCode === 1) {
  console.info("no prohibited dash characters found");
  process.exit(0);
}

if (result.exitCode !== 0) {
  console.error(result.stderr.toString().trim());
  process.exit(result.exitCode);
}

console.error("prohibited dash characters found:");
console.error(result.stdout.toString().trim());
process.exit(1);
