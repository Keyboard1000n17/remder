import Chalk from "chalk";
import terminalLink from "terminal-link";
import terminalImage from "terminal-image";
import got from "got";
import { Resvg } from "@resvg/resvg-js";
import * as Shiki from "shiki";

let state = []; // global var

const glyphs = await Bun.file("./chars.json").json();

function getStyle(type) {
  let style = "";
  switch (type) {
    case "strong_open":
      style = "bold";
      break;
    case "em_open":
      style = "italic";
      break;
    case "link_open":
      style = "link";
      break;
    case "s_open":
      style = "strikethrough";
      break;
    case "code_inline":
      style = "code";
      break;
    default:
      style = "plain";
      break;
  }
  return style;
}

// here's a set of microfunctions: these are there just because i
// don't have a better way besides if statements

function bold(text) {
  return Chalk.bold(text);
}

function italic(text) {
  return Chalk.italic(text);
}

function strikethrough(text) {
  return Chalk.strikethrough(text);
}

function code(text) {
  return Chalk.bgBlack(text);
}

// NOTE: the function is being exported here temporarily for testing
export async function image(token, isFileRemote, areThereOtherTokens) {
  // token here should be the image token inside an inline token
  if (token.type !== "image") throw new Error("WRONG TOKEN IDIOT DEV");
  const path = token.attrGet("src");
  const width = token.attrGet("width");
  const height = token.attrGet("height");
  const isSvg = /\.svg$/.test(path);
  console.log(path);
  const rawFile = isFileRemote ? await got(path).buffer() : Bun.file(path);
  const buffer = await (isSvg
    ? new Resvg(file, {}).render().asPng()
    : new Bun.Image(rawFile).png().buffer());
  if (isFileRemote && !file.ok) throw new Error("Network error");
  // use Bun.fileURLToPath()
  const noImageSupport =
    /^screen|tmux/.test(process.env.TERM) || process.env.NO_COLOR;
  const opts = {};
  if (noImageSupport) opts.preferNativeRender = false;
  const image = await terminalImage.buffer(buffer, opts);
  return image;
}

function renderInline(token) {
  // token is a token with type = "inline"
  let styled = "";
  if (token.type === "inline") {
    for (let i = 0; i < token.children.length; i++) {
      const child = token.children[i];
      const type = child.type;
      if (/_open/.test(type)) {
        state.push(type);
      } else if (/_close/.test(type)) {
        state.pop();
      } else if (type === "text") {
        const nesting = state.slice(state.indexOf("inline"));
        let temp = token.content;
        for (let j = nesting.length; j >= 0; j++) {
          temp = globalThis[nesting[j]](temp);
        }
      }
    }
    return styled;
  } else throw new Error("WRONG TOKEN DUMMY DEV");
}

// WARN: this function is not ready!!!
// it needs to be worked on and is incomplete!
export function heading(token) {
  let builtString = "";
  const links = [];
  let index = 0;
  let text = "";
  while (index < token.children.length) {
    const child = token.children[index];
    if (child.type === "link_open") {
      const linkUrl = child.attrGet("href");
      index++;
      const linkText = token.children[index].content;
      text += linkText;
      links.push({ text: linkText, url: linkUrl });
    } else {
      text += child.content;
    }
    index++;
  }
  const convertText = text.toUpperCase().split("");
  let grid = [[], [], [], [], [], [], []];
  const almostStyled = [];
  for (let i = 0; i < convertText.length; i++) {
    const character = convertText[i];
    for (let j in grid) {
      grid[j].push(glyphs.h1[character][j]);
    }
  }
  for (let row of grid) {
    almostStyled.push(row.join(""));
  }
  builtString = almostStyled.join("\n");
  for (let link of links) {
    const builtLink = `\n${link.text}: ${terminalLink(link.url, link.url, { fallback: false })}`;
    builtString += builtLink;
  }
  return builtString;
}

export function paragraph(text) {
  // NOTE: text is actually an object!!!
  let str = "";
  for (let t of text.children) {
    if (t.children && t.children.length > 0) {
      for (let child of t.children) {
        str += paragraph(child);
      }
    }
    const style = getStyle(t.type);
    str += renderInline(t.content, style);
  } // end for
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

    let i = input[index];

    // HEADING
    if (i.type === "heading_open") {
      state.push("heading");
      push.type = "heading";
      index++;
      if (input[index] === "inline") {
        push.content = heading(input[index]);
      }
    }

    // PARAGRAPH
    if (i.type === "paragraph_open") {
      state.push("paragraph");
      push.type = "paragraph";
      index++;
      if (input[index].type === "inline")
        push.content = paragraph(input[index]);
      index++;
      if (input[index].type === "paragraph_close") state.pop();
    }

    // no more! push the `push` object to the output array
    output.push(push);
  }
}
