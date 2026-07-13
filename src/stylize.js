import Chalk from "chalk";
import terminalLink from "terminal-link";
import terminalImage from "terminal-image";
import got from "got";
import { Resvg } from "@resvg/resvg-js";
import { FontStyle } from "@shikijs/vscode-textmate";
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

const inline = {
  strong: (text) => Chalk.bold(text),
  italic: (text) => Chalk.italic(text),
  strikethrough: (text) => Chalk.strikethrough(text),
  code: (text) => Chalk.bgBlack(text),
  text: (text) => text,
};

// NOTE: the function is being exported here temporarily for testing
export async function image(token, areThereOtherTokens) {
  // token here should be the image token inside an inline token
  if (token.type !== "image") throw new Error("WRONG TOKEN IDIOT DEV");
  const getFileBuffer = async (path) => {
    try {
      return path.startsWith("http")
        ? await got(path).buffer()
        : Bun.file(path).arrayBuffer();
    } catch (err) {
      return null;
    }
  };
  const path = token.attrGet("src");
  const alt = token.attrGet("alt");
  const buffer = await getFileBuffer(path);
  const opts = {
    preferNativeRender: /tmux|screen|xterm|alacritty/.test(process.env.term),
  };
  if (areThereOtherTokens) {
    opts.height = token.attrGet("height") || 1;
  } else {
    const isWidthDefined = token.attrGet("width");
    opts.width = isWidthDefined
      ? isWidthDefined
      : process.stdout.columns / 2 || 40;
  }
  const imgObj = {
    buffer: buffer,
    opts: opts,
    imageAlt: alt,
    shouldDisplayImage: !(
      /^screen$/.test(process.env.TERM) || process.env.NO_COLOR
    ),
    isGif: /\.gif$/.test(path),
    renderImage: async (imgObj) => {
      if (imgObj.shouldDisplayImage) {
        const image = await (imgObj.isGif
          ? terminalImage.gifBuffer(imgObj.buffer, opts)
          : terminalImage.buffer(imgObj.buffer, opts));
        return image;
      } else {
        return Chalk.dim(imgObj.imageAlt);
      }
    },
  };
  return imgObj;
}

async function renderInline(token) {
  // token is a token with type = "inline"
  if (token.type !== "inline")
    throw new Error("WRONG TOKEN WTF THIS DEV IS SUCH A DUMBASS");
  const styled = {
    type: "",
    contents: [],
  };
  for (let i = 0; i < token.children.length; i++) {
    const child = token.children[i];
    const type = child.type;
    if (/_open/.test(type)) {
      state.push(type.split("_")[0]);
    } else if (/_close/.test(type)) {
      state.pop();
    } else if (type === "image") {
      const areThereOtherTokens = token.children.length > 1;
      styled.type = "image";
      styled.contents.push({
        type: "image",
        content: image(child, areThereOtherTokens),
      });
    } else if (type === "text") {
      state.push("text");
      const nesting = state.slice(state.indexOf("inline") + 1);
      let temp = child.content;
      for (let j = nesting.length - 1; j >= 0; j--) {
        temp = inline[nesting[j]](temp);
      }
      styled.contents.push({ type: "text", content: temp });
      styled.type = "text";
      state.pop();
    }
  }
  return styled;
}

function heading(token) {
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

export async function codeBlock(token) {
  if (!token.type.match(/fence|code_block/))
    throw new Error("WRONG TOKEN HOW IS THIS DEV SO STUPID");
  if (
    Object.keys(Shiki.bundledLanguages).includes(token.info) ||
    Object.keys(Shiki.bundledLanguagesAlias).includes(token.info)
  ) {
    const shikiTokens = await Shiki.codeToTokens(token.content, {
      lang: token.info,
      theme: "github-dark",
    });
    const stylizedCodeArr = [];
    for (let line of shikiTokens.tokens) {
      let styledTokens = [];
      for (let token of line) {
        let temp = Chalk.hex(token.color)(token.content);
        if (token.color & FontStyle.Bold) temp = Chalk.bold(temp);
        if (token.color & FontStyle.Italic) temp = Chalk.italic(temp);
        if (token.color & FontStyle.Underline) temp = Chalk.underline(temp);
        if (token.color & FontStyle.Strikethrough)
          temp = Chalk.strikethrough(temp);
        styledTokens.push(temp);
      }
      stylizedCodeArr.push(styledTokens.join(""));
    }
    const code = {
      code: stylizedCodeArr.join("\n"),
      language: shikiTokens ? shikiTokens.grammarState.lang : "plain",
    };
    return code;
  } else {
    return {
      code: token.content,
      language: token.info !== "" ? token.info : "plain",
    };
  }
}

export default async function stylize(input) {
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
      index++;
      if (input[index].type === "heading_close") state.pop();
    }

    // PARAGRAPH
    if (i.type === "paragraph_open") {
      state.push("paragraph");
      push.type = "paragraph";
      index++;
      if (input[index].type === "inline") {
        state.push("inline");
        push.content = await renderInline(input[index]);
      }
      index++;
      if (input[index].type === "paragraph_close") state.pop();
    }

    if (i.type === "fence" || i.type === "code_block") {
      state.push("fence");
      push.type = "codeBlock";
      push.content = await codeBlock(i);
    }

    // no more! push the `push` object to the output array
    output.push(push);
    index++;
  }
  return output;
}
