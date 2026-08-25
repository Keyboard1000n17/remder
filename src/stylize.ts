import Chalk from "chalk";
import terminalLink from "terminal-link";
import terminalImage from "terminal-image";
import got from "got";
import { Resvg } from "@resvg/resvg-js";
import type Token from "markdown-it/lib/token.mjs";
import * as Shiki from "shiki";

const glyphs = await Bun.file(`${import.meta.dir}/chars.json`).json();

type InlineStyle = keyof typeof inline;
type StateEntry = string | InlineStyle;
type TerminalImageOpts = {
  preferNativeRender?: boolean;
  width?: string | number;
  height?: string | number;
};
type Handlers = {
  [type: string]: (
    token: Token[],
  ) => Promise<
    | ProcessedToken
    | (ProcessedToken | Image)[]
    | ProcessedToken[]
    | string
    | void
    | HeadingObject
  >;
};

export type HeadingObject = {
  headingTextArray: string[][];
  links: string;
};

export interface ProcessedToken {
  type: string;
  content:
  | string
  | Image
  | (ProcessedToken | Image)[]
  | { code: string; language: string }
  | TableToken[][]
  | HeadingObject;
  properties: {
    [type: string]: any;
  };
}

export interface TableToken extends ProcessedToken {
  type: "table-cell";
  content: (ProcessedToken | Image)[];
  properties: { textAlign: "left" | "center" | "right" };
}

const enum FontStyle {
  Italic = 1,
  Bold = 2,
  Underline = 4,
  Strikethrough = 8,
}

let state: StateEntry[] = []; // global var

export class Image {
  public content: any;
  public type: "image";
  public properties: {};
  constructor(
    public path: string,
    public imageAlt: string,
    public opts: object,
  ) {
    this.content = Image.#getBuffer(path);
    this.type = "image";
    this.properties = {};
  }
  static async #getBuffer(path: string) {
    try {
      return URL.canParse(path)
        ? (await got(path)).rawBody
        : Bun.file(path).arrayBuffer();
    } catch (err) {
      return null;
    }
  }
  async render() {
    const path = this.path;
    const buffer = await this.content;
    if (!buffer) return Chalk.dim(this.imageAlt);
    let rendered = "";
    if (path.match(/\.svg$/)) {
      console.log(buffer);
      try {
        rendered = await terminalImage.buffer(
          new Resvg(buffer).render().asPng(),
          this.opts,
        );
      } catch (err) {
        rendered = Chalk.dim(this.imageAlt);
      }
    } else if (path.match(/\.webp$/)) {
      rendered = await terminalImage.buffer(
        await new Bun.Image(buffer).png().buffer(),
        this.opts,
      );
    } else {
      rendered = await terminalImage.buffer(buffer, this.opts);
    }
    return rendered;
  }
}

const term: string | undefined = process.env.TERM;
if (term === undefined)
  throw new Error(`A TUI can not be run in the background!`);

async function image(token: Token, areThereOtherTokens: boolean) {
  // token here should be the image token inside an inline token
  if (token.type !== "image")
    throw new Error(
      Chalk.red.bold(`Wrong token type: expected image but got ${token.type}`),
    );
  const path = token.attrGet("src");
  if (!path) throw new Error("Something went wrong, this shouldn't happen!");
  const alt = token.attrGet("alt") || "";
  const terminalImageOpts: TerminalImageOpts = {
    preferNativeRender: !/tmux|screen|xterm|alacritty/.test(term!),
  };
  if (areThereOtherTokens) {
    terminalImageOpts.height = token.attrGet("height") || 1;
  } else {
    terminalImageOpts.width = token.attrGet("width") || "50%";
  }
  return new Image(path, alt, terminalImageOpts);
}

const inline: Record<string, (text: string) => string> = {
  strong: (text: string) => Chalk.bold(text),
  em: (text: string) => Chalk.italic(text),
  s: (text: string) => Chalk.strikethrough(text),
  del: (text: string) => Chalk.strikethrough(text),
  code: (text: string) => Chalk.bgGray(text),
  ins: (text: string) => Chalk.underline(text),
  kbd: (text: string) => Chalk.bgBlack(text),
  mark: (text: string) => Chalk.bgYellow(text),
  plain: (text: string) => text,
  text: (text: string) => text,
};

async function renderInline(tokens: Token[]) {
  const styled: ProcessedToken[] = [];
  for (const token of tokens) {
    if (token.type === "inline") {
      state.push("inline");
      let i = 0;
      let text = "";
      if (!token.children)
        throw new Error(`Something went wrong. This shouldn't happen.`);
      // if this error ever happens, my first thought will be "how the fuck did that happen"
      while (i < token.children.length) {
        const child = token.children[i];
        if (!child)
          throw new Error(`Something went wrong. This shouldn't happen.`);
        const type = child.type;
        if (type === "link_open") {
          //#region links
          const linkUrl = child.attrGet("href") ?? "";
          i++;
          const linkTextToken = token.children[i];
          if (!linkTextToken)
            throw new Error(
              Chalk.red.bold(`Something went wrong. This shouldn't happen.`),
            );
          const linkText = linkTextToken.content;
          text += Chalk.underline(terminalLink(linkText, linkUrl));
          //#endregion
        } else if (type === "abbr_open") {
          //#region abbreviations
          const abbreviation = child.attrGet("title");
          i++;
          const abbrTextToken = token.children[i];
          if (!abbrTextToken)
            throw new Error(
              Chalk.red.bold(`Something went wrong. This shouldn't happen.`),
            );
          const abbreviatedText = abbrTextToken.content ?? "";
          if (abbreviation && abbreviation.length > 0) {
            text += `${abbreviatedText} (${abbreviation})`;
          } else {
            text += abbreviatedText;
          }
          text +=
            abbreviation && abbreviation.length > 0
              ? `${abbreviatedText} (${abbreviation})`
              : abbreviatedText;
          //#endregion
        } else if (/_open/.test(type)) {
          //#region
          state.push(type.split("_")[0]!);
          //#endregion
        } else if (/_close/.test(type)) {
          //#region
          state.pop();
          //#endregion
        } else if (type === "image") {
          //#region images
          styled.push({ type: "text", content: text, properties: {} });
          text = "";
          const areThereOtherTokens = token.children.length > 1;
          styled.push({
            type: "image",
            content: await image(child, areThereOtherTokens),
            properties: {},
          } as ProcessedToken);
          //#endregion
        } else if (type === "softbreak") {
          //#region softbreaks
          text += " ";
          //#endregion
        } else if (type === "hardbreak") {
          //#region hardbreaks
          text += "\n\n";
          //#endregion
        } else if (type === "code_inline") {
          //#region inline code
          text += inline.code!(` ${child.content} `);
          //#endregion
        } else if (type === "text") {
          //#region text
          const nesting = state.slice(state.indexOf("inline") + 1);
          let temp = child.content;
          for (const style of nesting) {
            const handler = inline[style];
            if (handler) {
              temp = handler(temp);
            } else {
              temp += `\n`;
            }
          }
          text += temp;
          //#endregion
        } else {
          //#region
          handleTokens.default!([child]);
          //#endregion
        }
        i++;
      }
      if (text !== "")
        styled.push({
          type: "text",
          content: text,
          properties: {},
        } as ProcessedToken);
    }
  }
  state.pop();
  return styled;
}

function heading(token: Token) {
  if (token?.type !== "inline")
    throw new Error(
      Chalk.red.bold(
        `Wrong token type: expected type inline but got ${token?.type} `,
      ),
    );
  const links: { text: string; url: string }[] = [];
  let index = 0;
  let text = "";
  const children: Token[] | null = token.children;
  if (!children)
    throw new Error("Something went wrong, this shouldn't happen.");
  while (index < children.length) {
    const child = children[index];
    if (!child) throw new Error("Something went wrong, this shouldn't happen.");
    if (child.type === "link_open") {
      const linkUrl = child.attrGet("href") ?? "";
      index++;
      const linkTextToken = children[index];
      if (!linkTextToken)
        throw new Error(
          Chalk.red.bold(`Something went wrong. This shouldn't happen.`),
        );
      const linkText = linkTextToken.content;
      links.push({ text: linkText, url: linkUrl });
    } else {
      text += child.content;
    }
    index++;
  }
  const convertText = text.toUpperCase().split("");
  let grid: string[][] = [[], [], [], [], [], [], []];
  convertText.forEach((character) => {
    grid.forEach((row, index) => {
      row.push(glyphs.h1[character][index]);
    });
  });
  const obj: HeadingObject = {
    headingTextArray: grid,
    links: "",
  };
  for (let link of links) {
    const builtLink = `\n${link.text}: ${terminalLink(link.url, link.url, { fallback: false })} `;
    obj.links += builtLink;
  }
  return obj;
}

export async function codeBlock(token: Token) {
  if (!token.type.match(/fence|code_block/))
    throw new Error("WRONG TOKEN HOW IS THIS DEV SO STUPID");
  if (
    Object.keys(Shiki.bundledLanguages).includes(token.info) ||
    Object.keys(Shiki.bundledLanguagesAlias).includes(token.info)
  ) {
    const shikiTokens = await Shiki.codeToTokens(token.content, {
      lang: token.info as Shiki.BundledLanguage,
      theme: "github-dark",
    });
    const stylizedCodeArr = [];
    for (let line of shikiTokens.tokens) {
      let styledTokens = [];
      for (let shikiToken of line) {
        const color: any = shikiToken.color || "#ffffff";
        let temp = Chalk.hex(color)(shikiToken.content);
        if (color & FontStyle.Bold) temp = Chalk.bold(temp);
        if (color & FontStyle.Italic) temp = Chalk.italic(temp);
        if (color & FontStyle.Underline) temp = Chalk.underline(temp);
        if (color & FontStyle.Strikethrough) temp = Chalk.strikethrough(temp);
        styledTokens.push(temp);
      }
      stylizedCodeArr.push(styledTokens.join(""));
    }
    const code = {
      code: stylizedCodeArr.join("\n"),
      language: shikiTokens.grammarState?.lang ?? "plain",
    };
    console.log("STYLIZE.TS:", stylizedCodeArr.join("\n"));
    return code;
  } else {
    return {
      code: token.content,
      language: token.info !== "" ? token.info : "plain",
    };
  }
}

export async function table(tokens: Token[]) {
  const tableRows: any[] = [];
  const currentRow: any[] = [];
  let currentAlign = "";

  // State & Parsing Handlers
  const handlers: Record<string, (t: Token) => void | Promise<void>> = {
    thead_open: (): void => {
      state.push("thead");
    },
    tbody_open: (): void => {
      state.push("tbody");
    },
    thead_close: (): void => {
      state.pop();
    },
    tbody_close: (): void => {
      state.pop();
    },
    tr_open: (): void => {
      state.push("tr");
    },
    tr_close: (): void => {
      if (currentRow) tableRows.push(currentRow.splice(0));
    },
    th_open: (token: Token): void => {
      const alignMatch = token.attrGet("style")?.match(/text-align:\s*(\w+)/);
      currentAlign = alignMatch?.[1] ?? "center";
    },
    td_open: (token: Token): void => {
      const alignMatch = token.attrGet("style")?.match(/text-align:\s*(\w+)/);
      currentAlign = alignMatch?.[1] ?? "left";
    },
    inline: async (token: Token): Promise<void> => {
      currentRow.push({
        type: "table-cell",
        content: await renderInline([token]),
        properties: { textAlign: currentAlign },
      } as ProcessedToken);
    },
  };

  // Execution Loop
  for (const token of tokens) {
    const type = token.type;
    const handle = handlers[type];
    if (handle) await handle(token);
  }

  return tableRows;
}

async function details(tokens: Token[]) {
  const tokenStack = [];
  const firstToken: Token | undefined = tokens[0];
  if (!firstToken) throw new Error("This shouldn't have errored!");
  if (firstToken.type === "summary_open") {
    if (!tokens[1]) throw new Error("How did this happen?");
    tokenStack.push({
      type: "summary",
      content: await renderInline([tokens[1]]),
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

const handleTokens: Handlers = {
  default: async (tokens: Token[]) => {
    tokens.forEach((token) => {
      if (token.tag !== "") {
        if (token.type.match(/_open/)) {
          accumulatedTokenContentString += `<${token.tag}>`;
        } else if (token.type.match(/_close/)) {
          accumulatedTokenContentString += `</${token.tag}>`;
        }
      } else if (token.content.length > 0) {
        accumulatedTokenContentString += token.content;
      }
    });
  },
  paragraph: async (tokens: Token[]) => await renderInline(tokens), // it's always just one inline token
  table: async (tokens: Token[]) => await table(tokens),
  heading: async (tokens: Token[]) => heading(tokens[0]!),
  div: async (tokens: Token[]) => await stylize(tokens),
  blockquote: async (tokens: Token[]) => await stylize(tokens),
  bullet_list: async (tokens: Token[]) => await stylize(tokens),
  ordered_list: async (tokens: Token[]) => await stylize(tokens),
  list_item: async (tokens: Token[]) => await stylize(tokens),
  ruby: async (tokens: Token[]) => await stylize(tokens),
  // these ones recurse because they're container blocks
  details: async (tokens: Token[]) => await details(tokens),
  rp: async (tokens: Token[]) => await renderInline([tokens[0]!]),
  rt: async (tokens: Token[]) => await renderInline([tokens[0]!]),
  pre: async (tokens: Token[]) => {
    let builtString = "";
    for (const token of tokens) {
      if (token.content.length > 0) {
        builtString += token.content;
      }
      if (token.children) {
        for (const child of token.children) {
          if (child.content.length > 0) {
            builtString += child.content;
          }
        }
      }
    }
    return builtString;
  }, // strange? well i couldn't bother making a separate function
};

let accumulatedTokenContentString = "";

// NOTE: chatgpt generated this, and i can not be bothered to do this myself
function removeWhitespaceTokens(
  tokens: (ProcessedToken | Image)[],
): (ProcessedToken | Image)[] {
  return tokens
    .map((token) => {
      if (
        token.type === "table" &&
        Array.isArray(token.content) &&
        token.content.every((row) => Array.isArray(row))
      ) {
        return {
          ...token,
          content: token.content.map((row) =>
            row.map((cell) => {
              return { ...cell, content: removeWhitespaceTokens(cell.content) };
            }),
          ),
        };
      }
      if (
        !("imageAlt" in token) &&
        Array.isArray(token.content) &&
        !token.content.every((row) => Array.isArray(row))
      ) {
        return {
          ...token,
          content: removeWhitespaceTokens(token.content),
        };
      }
      return token;
    })
    .filter((token) => {
      if (!("imageAlt" in token) && !Array.isArray(token)) {
        if (typeof token.content === "string") {
          return token.content.trim() !== "";
        }
        if (Array.isArray(token.content)) {
          return token.content.length > 0;
        }
      }
      return true;
    });
}

export default async function stylize(input: Token[]) {
  // input is an array returned by `parse()` in `parse - input.js`
  const output = [];
  let index = 0;

  while (index < input.length) {
    const push: ProcessedToken = {
      type: "",
      content: "",
      properties: {},
    };
    let token = input[index];
    if (!token)
      throw new Error(Chalk.bold.red(`Token at ${index} is not defined!!!`));

    // give attrs
    if (token.attrs) {
      for (let [key, value] of token.attrs) {
        push.properties[key] = value;
      }
    }

    if (!token.type) {
      throw new Error(
        Chalk.bold.red(`Type of token at index ${index} is ${token?.type}!`),
      );
    }

    if (token.type.match(/_open/)) {
      const accumulatedTokens: Token[] = [];
      index++;
      const tokenType = token.type.replace("_open", "");
      if (!input[index]) {
        throw new Error(
          Chalk.red.bold(
            `Token at index ${index} is undefined. The length of the input array is ${input.length} `,
          ),
        );
      }

      while (input[index] && input[index]!.level !== token.level) {
        accumulatedTokens.push(input[index]!);
        index++;
      }

      const handler: ((tokens: Token[]) => Promise<any>) | undefined =
        handleTokens[tokenType];
      state.push(tokenType);
      if (handler) {
        push.type = tokenType;
        push.content = await handler(accumulatedTokens);
        const unknownTagString: ProcessedToken = {
          type: "paragraph",
          content: accumulatedTokenContentString,
          properties: {},
        };
        output.push(unknownTagString);
        accumulatedTokenContentString = "";
      } else if (accumulatedTokens.length > 0) {
        await handleTokens.default!(accumulatedTokens);
      }
      state.pop();
    } else if (token.type === "fence" || token.type === "code_block") {
      state.push("fence");
      push.type = "codeBlock";
      push.content = await codeBlock(token);
      state.pop(); // pops off "fence"
    } else if (token.type === "hr") {
      state.push("thematic-break");
      push.type = "thematic-break";
      push.content = "";
      state.pop();
    } else if (token.type === "inline") {
      push.type = "text";
      push.content = await renderInline([token]);
    } else {
      throw new Error(
        Chalk.red.bold(
          "Token type was not recognized: you might need to add handling for it in /src/stylize.js in the default `stylize()` function",
        ) +
        "\n" +
        Chalk.dim(
          `PS: the token type was ${token.type}. Its index is ${index} `,
        ),
      );
    }

    // no more! push the `push` object to the output array
    output.push(push);
    index++;
  }

  // state = [];
  return removeWhitespaceTokens(output);
}
