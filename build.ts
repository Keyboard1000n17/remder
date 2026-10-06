const targets = [
  "darwin-arm64",
  "darwin-x64",
  "linux-arm64",
  "linux-x64",
  "windows-x64",
] as const;

for (const target of targets) {
  console.log(`Building ${target}...`);

  const result = await Bun.build({
    entrypoints: ["./src/index.ts"],
    compile: {
      target: `bun-${target}`,
      outfile: `./dist/remder-${target}`,
      assets: ["./src/fonts"],
    },
    minify: true,
  });

  if (!result.success) {
    console.error(result.logs);
    process.exit(1);
  }
}

export { };
