console.log(Bun.argv);

async function readFile(filepath) {
  const readFile = Bun.file(filepath);
  const text = await readFile.text();
  console.log(text);
}

readFile(Bun.argv[2]);
