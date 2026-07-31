import Chalk from "chalk";
import terminalLink from "terminal-link";
import terminalImage from "terminal-image";
import got from "got";
import { Resvg } from "@resvg/resvg-js";
import { FontStyle } from "@shikijs/vscode-textmate";
import * as Shiki from "shiki";

let state = []; // global var

const glyphs = await Bun.file("./chars.json").json();

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
  };

  imgObj.prototype.render = async (imgObj) => {
    if (imgObj.shouldDisplayImage) {
      const image = await (imgObj.isGif
        ? terminalImage.gifBuffer(imgObj.buffer, opts)
        : terminalImage.buffer(imgObj.buffer, opts));
      return image;
    } else {
      return Chalk.dim(imgObj.imageAlt);
    }
  };
  // TODO: turn imgObj into a class so we can use prototypes
  return imgObj;
}

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
  bold: (text) => Chalk.bold(text),
  italic: (text) => Chalk.italic(text),
  strikethrough: (text) => Chalk.strikethrough(text),
  code: (text) => Chalk.bgBlack(text),
  plain: (text) => text,
  text: (text) => text,
};

async function renderInline(token) {
  // token is a token with type = "inline"
  if (token.type !== "inline")
    throw new Error("WRONG TOKEN WTF THIS DEV IS SUCH A DUMBASS");

  state.push("inline");
  const styled = [];

  let i = 0;
  let text = "";
  while (i < token.children.length) {
    const child = token.children[i];
    const type = child.type;

    if (/_open/.test(type)) {
      state.push(getStyle(type));
    }

    if (/_close/.test(type)) {
      state.pop();
    }

    if (type === "link_open") {
      // handle links
      const linkUrl = child.attrGet("href");
      i++;
      const linkText = token.children[i].content;
      styled.push({
        type: "link",
        content: terminalLink(linkText, linkUrl, { fallback: false }),
      });
    }

    if (type === "image") {
      // handle images
      styled.push({ type: "text", content: text });
      text = "";
      const areThereOtherTokens = token.children.length > 1;
      styled.push({
        type: "image",
        content: await image(child, areThereOtherTokens),
      });
    }

    if (type === "text") {
      const nesting = state.slice(state.indexOf("inline") + 1);
      let temp = child.content;
      console.log(state);
      for (let j = nesting.length - 1; j >= 0; j--) {
        if (!inline[nesting[j]])
          throw new Error(
            Chalk.red.bold(`Inline token type ${nesting[j]} does not exist.`),
          );
        temp = inline[nesting[j]](temp);
      }
      // end for
      text += temp;
    }

    i++;
  }
  // end for
  if (text !== "") styled.push({ type: "text", content: text });
  state.pop();
  return styled;
}

function heading(token) {
  if (token.type !== "inline")
    throw new Error("WRONG TOKEN WTF THIS DEV IS SUCH A DUMBASS");
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

export async function table(tokens) {
  const tableRows = [];
  const state = [];
  let currentRow = null;
  let currentAlign = "";

  // State & Parsing Handlers
  const handlers = {
    thead_open: () => state.push("thead"),
    tbody_open: () => state.push("tbody"),
    thead_close: () => state.pop(),
    tbody_close: () => state.pop(),
    tr_open: () => {
      currentRow = [];
    },
    tr_close: () => {
      if (currentRow) tableRows.push(currentRow);
      currentRow = null;
    },

    th_open: (token) => {
      const alignMatch = token.attrGet("style").match(/text-align:\s*(\w+)/);
      currentAlign = alignMatch ? alignMatch[1] : "center";
    },
    td_open: (token) => {
      const alignMatch = token.attrGet("style").match(/text-align:\s*(\w+)/);
      currentAlign = alignMatch ? alignMatch[1] : "left";
    },

    inline: async (token) => {
      if (!currentRow) return;
      currentRow.push({
        content: await renderInline(token),
        textAlign: currentAlign,
      });
    },
  };

  // Execution Loop
  for (const token of tokens) {
    const handle = handlers[token.type];
    if (handle) {
      await handle(token);
    }
  }

  return tableRows;
}

async function details(tokens) {
  const tokenStack = [];
  if (tokens[0].type === "summary_open") {
    tokenStack.push({
      type: "summary",
      content: await renderInline(tokens[1]),
      properties: {},
    });
    tokenStack.push({
      type: "content",
      content: await stylize(tokens.slice(3)),
      properties: {},
    });
  } else {
    tokenStack.push({
      type: "summary",
      content: "Details",
      properties: {},
    });
    tokenStack.push({
      type: "content",
      content: await stylize(tokens),
      properties: {},
    });
  }
  return tokenStack;
}

function bulletList(tokens) {
  const tokenStack = [];
  for (let i = 0; i <= tokens.length; i++) {
    const token = tokens[i];
    if (token.type === "list_item_open") {
      while (tokens[i].type !== "list_item_close") { }
    }
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
      properties: {},
    };
    let i = input[index];

    // give attrs
    if (i.attrs) {
      for (let [key, value] of i.attrs) {
        push.properties[key] = value;
      }
    }

    if (i.type.match(/_open/)) {
      const accumulatedTokens = [];
      index++;
      const tokenType = i.type.replace("_open", "");
      console.log(`${input.indexOf(i)}. ${tokenType}`);
      if (!input[index]) {
        throw new Error(
          Chalk.red.bold(
            `Token at index ${index} is undefined. The length of the input array is ${input.length}`,
          ),
        );
      }

      while (input[index] && input[index].level !== i.level) {
        accumulatedTokens.push(input[index]);
        index++;
      }
      const handleTokens = {
        paragraph: async (tokens) => await renderInline(tokens[0]), // it's always just one inline token
        table: async (tokens) => await table(tokens),
        heading: (tokens) => heading(tokens[0]),
        div: async (tokens) => await stylize(tokens),
        blockquote: async (tokens) => await stylize(tokens),
        bullet_list: async (tokens) => await stylize(tokens),
        ordered_list: async (tokens) => await stylize(tokens),
        list_item: async (tokens) => await stylize(tokens),
        // these ones recurse because they're container blocks
        details: async (tokens) => await details(tokens),
      };
      if (!handleTokens[tokenType]) {
        throw new Error(
          Chalk.red.bold(
            "Token type was not recognized: you might need to add handling for it in /src/stylize.js in the default `stylize()` function",
          ) +
          "\n" +
          Chalk.dim(
            `PS: the token type was ${tokenType}. Its index is ${index}`,
          ),
        );
      }
      push.content = await handleTokens[tokenType](accumulatedTokens);
    } else if (i.type === "fence" || i.type === "code_block") {
      state.push("fence");
      push.type = "codeBlock";
      push.content = await codeBlock(i);
      state.pop(); // pops off "fence"
    } else if (i.type === "hr") {
      state.push("thematic-break");
      push.type = "thematic-break";
      push.content = "";
      state.pop();
    } else if (i.type === "inline") {
      push.type = "paragraph"; // since its pretty much a paragraph
      push.content = await renderInline(i);
    } else {
      throw new Error(
        Chalk.red.bold(
          "Token type was not recognized: you might need to add handling for it in /src/stylize.js in the default `stylize()` function",
        ) +
        "\n" +
        Chalk.dim(`PS: the token type was ${i.type}. Its index is ${index}`),
      );
    }

    // no more! push the `push` object to the output array
    output.push(push);
    index++;
  }

  // state = [];
  return output;
}
