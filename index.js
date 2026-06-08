import figlet from "figlet";

console.log(Bun.argv);

async function stylize(text) {
  const styled = await figlet.text(text, {
    font: "ANSI Shadow",
  });
  return styled;
}

async function readFile(filepath) {
  const readFile = Bun.file(filepath);
  const text = await readFile.text();
  return text;
}

async function parseFile() {
  const text = await readFile(Bun.argv[2]);
  const arr = text.split("\n\n");
  for (let a of arr) {
    console.log(a);
  }
  const headings = arr.filter((heading) => /^#/.test(heading));
  headings.forEach(async (h) => {
    console.log(await stylize(h));
  });
}

parseFile();

// fonts to use
// - terrace
// - mono 9
// - dos rebel
// - coder mini
// - rebel
