async function getGlyphs() {
  return await Bun.file("./chars.json").json();
}

const glyphs = await getGlyphs();

function renderInline(text, type) {
  let styled = "";
  if (type === "text") styled = text;
  else if (type === "bold") styled = `\x1b[1m${text}\x1b[0m`;
  else if (type === "emphasis") styled = `\x1b[3m${text}\x1b[0m`;
  else if (type === "strikethrough") styled = `\x1b[9m${text}\x1b[0m`;
  else if (type === "code") styled = `\x1b[48;5;244${text}\x1b[0m`;
  return styled;
}

function heading(text) {
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
}

export default function stylize(input) {
  // input is an array returned by `parse()` in `parse-input.js`
  let state = "";
  const output = [];
  let index = 0;
  while (index < input.length) {
    const push = {
      type: "",
      content: "",
    };
    const i = input[index];

    if (i.type === "paragraph_open") {
      state += "paragraph";
      push.type = "paragraph";
      index++;
    }
    if (input[index].type === "inline") {
      let str = "";
      for (let t of input[index].children) {
        const match = /^(.*?)_open/.match(t.type);
        if (match) {
          state += `>${match[1]}`;
        } else if (/^(.*?)_close/.test(t.type)) {
          state = state.substring(0, state.lastIndexOf(">"));
        } // end if
      } // end for
    } // end if
  }
}
