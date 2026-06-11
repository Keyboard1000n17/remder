import figlet from "figlet";

async function getGlyphs() {
  return await Bun.file("./chars.json").json();
}

const glyphs = await getGlyphs();

async function stylize(text, type) {
  let styled;
  if (type === "heading") {
    const convertText = text.toUpperCase().split("");
    let grid = [[], [], [], [], [], [], []];
    for (let i = 0; i < convertText.length; i++) {
      const character = convertText[i];
      for (let j in grid) {
        grid[j].push(glyphs.h1[character][j]);
      }
    }
    const almostStyled = [];
    for (let row of grid) {
      almostStyled.push(row.join(""));
    }
    styled = almostStyled.join("\n");
  } else if (type === "paragraph") {
    styled = text;
  }
  return styled;
}

async function readFile(filepath) {
  const readFile = Bun.file(filepath);
  const text = await readFile.text();
  return text;
}

const textComponents = [];

async function parseFile() {
  const text = await readFile(Bun.argv[2]);
  const arr = text.split("\n\n");
  let type;
  for (let a of arr) {
    if (/^#/.test(a)) type = "heading";
    else if (/\s*-/.test(a)) type = "list-item";
    else if (/\s*\d/.test(a)) type = "numbered-list-item";
    else type = "paragraph";
    textComponents.push({ type: type, content: a });
  }
}

async function printText() {
  const stylizedText = [];
  for (let el of textComponents) {
    const stylized = await stylize(el.content, el.type);
    stylizedText.push(stylized);
  }
  console.log(stylizedText.join("\n\n"));
}

await parseFile();
await printText();
