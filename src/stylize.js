async function getGlyphs() {
  return await Bun.file("./chars.json").json();
}

const glyphs = await getGlyphs();

function paragraph(text, textWidth) {
  let output;
}

function bold(text) {
  return `\x1b[1m${text}\x1b[0m`;
}

function italic(text) {
  return `\x1b[3m${text}\x1b[0m`;
}

function strikethrough(text) {
  return `\x1b[9m${text}\x1b[0m`;
}

export default function stylize(input) {
  // input is an array returned by `parse()` in `parse-input.js`
  let state = "";
  let output = "";
  for (let i of input) {
    const match = i.type.match(/^(.*?)_(open|close)/);
    if (match) state = match[2] === "open" ? match[1] : "";

    if (state === "heading") {
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
      output += styled;
    } else if (state === "bullet_list") {
    }
  }
}
