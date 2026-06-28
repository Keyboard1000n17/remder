let state = ""; // global var

async function getGlyphs() {
  return await Bun.file("./chars.json").json();
}

const glyphs = await getGlyphs();

function getStyle(type) {
  let style = "";
  switch (type) {
    case "strong_open":
      style = "bold";
      break;
    case "em_open":
      style = "emphasis";
      break;
    case "link_open":
      style = "link";
      break;
    case "s_open":
      style = "strikethrough";
    default:
      break;
  }
}

function renderInline(text, type) {
  let styled = "";
  if (type === "text") styled = text;
  else if (type === "bold") styled = `\x1b[1m${text}\x1b[0m`;
  else if (type === "emphasis") styled = `\x1b[3m${text}\x1b[0m`;
  else if (type === "strikethrough") styled = `\x1b[9m${text}\x1b[0m`;
  else if (type === "code") styled = `\x1b[48;5;244${text}\x1b[0m`;
  return styled;
}

// WARN: this function is not ready!!!
// it needs to be worked on and is incomplete!
function heading(text) {
  // NOTE: text is actually an object!!!
  let builtString = "";
  let innerState = "";
  for (let child of text.children) {
    if (child.type.match(/strong|em/)) {
      innerState = child.type.match(/(strong|em)/)[1];
      continue;
    } else if (child.type.match("code")) {
      innerState = "code";
    }
  }
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

function paragraph(text) {
  // NOTE: text is actually an object!!!
  let str = "";
  if (state.split(">").includes("paragraph")) {
    for (let t of text.children) {
      const match = /^(.*?)_open/.match(t.type);
      if (match) {
        state += `>${match[1]}`;
      } else if (/^(.*?)_close/.test(t.type)) {
        state = state.substring(0, state.lastIndexOf(">"));
      } else if (t.type === "text") {
        const style = getStyle(t.type);
        str += renderInline(t.content, style);
      } // end if
    } // end for
  } // end if
  return str;
}

export default function stylize(input) {
  // input is an array returned by `parse()` in `parse-input.js`
  const output = [];
  let index = 0;

  while (index < input.length) {
    const push = {
      type: "",
      content: "",
    };
    const i = input[index];

    // HEADING
    if (i.type === "heading_open") {
      state += "heading";
      push.type = "heading";
      i++;
      if (input[index] === "inline") {
        push.content = heading(input[index]);
      }
    }

    // PARAGRAPH
    if (i.type === "paragraph_open") {
      state += "paragraph";
      push.type = "paragraph";
      i++;
      if (input[index].type === "inline")
        push.content = paragraph(input[index]);
      i++;
      if (input[index].type === "paragraph_close")
        state = state.substring(0, state.lastIndexOf(">"));
    }
    output.push(push);
  }
}
