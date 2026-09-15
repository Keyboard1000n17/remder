import Chalk from "chalk";
import terminalLink from "terminal-link";
import terminalImage from "terminal-image";
import got from "got";
import { Resvg } from "@resvg/resvg-js";
import type { Token } from "markdown-it";
import * as Shiki from "shiki";
import { join } from "path";
import {
  ImageRenderable,
  TextRenderable,
  type RenderContext,
} from "@opentui/core";

type InlineStyle = keyof typeof inline;
type StateEntry = string | InlineStyle;
type Handler = (
  token: Token[],
  filePath: string,
  level?: number,
) => Promise<ProcessedToken[] | string | HeadingObject>;

type Handlers = Record<string, Handler>;

export type HeadingObject = {
  text: string;
  links: string;
  level: number;
};

type ProcessedTokenTypes =
  | "paragraph"
  | "table"
  | "table-cell"
  | "image"
  | "text"
  | "alert"
  | "thematic-break"
  | "codeBlock"
  | "heading"
  | "bullet_list"
  | "ordered_list"
  | "details"
  | "summary"
  | "content"
  | "list_item"
  | "blockquote"
  | "div"
  | "";

//#region token definitions
interface BaseProcessedToken {
  type: ProcessedTokenTypes;
  properties: {
    [type: string]: any;
  };
}

interface TableCellToken extends BaseProcessedToken {
  type: "table-cell";
  content: ProcessedToken[];
  properties: { textAlign: "left" | "center" | "right" };
}

interface TableToken extends BaseProcessedToken {
  type: "table";
  content: TableCellToken[][];
}

interface ImageToken extends BaseProcessedToken {
  type: "image";
  content: Image;
}

interface TextToken extends BaseProcessedToken {
  type: "text";
  content: string;
}

interface ParagraphToken extends BaseProcessedToken {
  type: "paragraph";
  content: (TextToken | ImageToken)[];
}

interface AlertToken extends BaseProcessedToken {
  type: "alert";
  content: ProcessedToken[];
  properties: {
    alertType: string;
  };
}

interface ThematicBreakToken extends BaseProcessedToken {
  type: "thematic-break";
  content: "";
}

interface CodeBlockToken extends BaseProcessedToken {
  type: "codeBlock";
  content: {
    code: string;
    language: string;
  };
}

interface HeadingToken extends BaseProcessedToken {
  type: "heading";
  content: HeadingObject;
}

interface BulletListToken extends BaseProcessedToken {
  type: "bullet_list";
  content: ProcessedToken[];
}

interface OrderedListToken extends BaseProcessedToken {
  type: "ordered_list";
  content: ProcessedToken[];
}

interface ListItemToken extends BaseProcessedToken {
  type: "list_item";
  content: ProcessedToken[];
}

interface EmptyToken extends BaseProcessedToken {
  type: "";
  content: "";
}

interface DetailsSummaryToken extends BaseProcessedToken {
  type: "summary";
  content: string | ProcessedToken[];
}

interface DetailsContentToken extends BaseProcessedToken {
  type: "content";
  content: ProcessedToken[];
}

interface DetailsToken extends BaseProcessedToken {
  type: "details";
  content: (DetailsSummaryToken | DetailsContentToken)[];
}

interface BlockquoteToken extends BaseProcessedToken {
  type: "blockquote";
  content: ProcessedToken[];
}

interface DivToken extends BaseProcessedToken {
  type: "div";
  content: ProcessedToken[];
}
//#endregion

export type ProcessedToken =
  | EmptyToken
  | ImageToken
  | TextToken
  | ParagraphToken
  | TableToken
  | TableCellToken
  | AlertToken
  | CodeBlockToken
  | BulletListToken
  | OrderedListToken
  | HeadingToken
  | DetailsToken
  | DetailsSummaryToken
  | DetailsContentToken
  | ListItemToken
  | BlockquoteToken
  | DivToken
  | ThematicBreakToken;

const enum FontStyle {
  Italic = 1,
  Bold = 2,
  Underline = 4,
  Strikethrough = 8,
}

let state: StateEntry[] = []; // global var

export class Image {
  public imageBuffer: Uint8Array<ArrayBuffer> | null;
  public type: "image";
  public properties: {};
  constructor(
    public path: string,
    public filePath: string,
    public imageAlt: string,
  ) {
    this.imageBuffer = null;
    this.type = "image";
    this.properties = {};
  }
  static preferNativeRender = !/tmux|screen|^xterm$|alacritty/.test(
    process.env.TERM || "",
  );
  static async create(path: string, filePath: string, imageAlt: string) {
    const image = new Image(path, filePath, imageAlt);
    image.imageBuffer = await Image.#getBuffer(filePath, path);
    return image;
  }
  static async #getBuffer(filePath: string, path: string) {
    try {
      return URL.canParse(path)
        ? (await got(path)).rawBody
        : await Bun.file(join(filePath, path)).bytes();
    } catch (err) {
      return null;
    }
  }
  async render(
    ctx: RenderContext,
    parentWidth: number,
    makeOneRowHigh: boolean,
  ) {
    const buffer = this.imageBuffer;
    if (!buffer) {
      console.log("buffer was not rendered");
      return new TextRenderable(ctx, { content: this.imageAlt, fg: "gray" });
    }
    const getImageSize = (await import("image-size")).imageSize;
    const imageSize = getImageSize(buffer);
    const width = 0.5 * parentWidth;
    const height = makeOneRowHigh
      ? 1
      : ((imageSize.width / imageSize.height) * width) / 2;
    return new ImageRenderable(ctx, {
      source: buffer,
      width,
      height,
    });
  }
}

async function image(token: Token, filePath: string) {
  // token here should be the image token inside an inline token
  if (token.type !== "image")
    throw new Error(
      Chalk.red.bold(`Wrong token type: expected image but got ${token.type}`),
    );
  const path = token.attrGet("src");
  if (!path) throw new Error("Something went wrong, this shouldn't happen!");
  const alt =
    token.attrGet("alt") ||
    token.children?.[0]?.content ||
    "No alt text provided";
  return Image.create(String(path), filePath, String(alt));
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

async function renderInline(token: Token, filePath?: string) {
  const styled: ProcessedToken[] = [];
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
        text += Chalk.underline(terminalLink(linkText, String(linkUrl)));
        //#endregion
      } else if (type === "abbr_open") {
        //#region abbreviations
        const abbreviation = String(child.attrGet("title"));
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
        console.log(token.children.length);
        styled.push({
          type: "image",
          content: await image(child, filePath || ""),
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
      } else if (type === "emoji") {
        text += child.content;
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
        handleTokens.default!([child], filePath || "");
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
  state.pop();
  return styled;
}

function heading(token: Token, level = 1) {
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
      const linkUrl = String(child.attrGet("href")) ?? "";
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
  const obj: HeadingObject = {
    links: "",
    text: text,
    level: level,
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
    return code;
  } else {
    return {
      code: token.content,
      language: token.info !== "" ? token.info : "plain",
    };
  }
}

export async function table(tokens: Token[], filePath: string) {
  const tableRows: any[] = [];
  const currentRow: any[] = [];
  let currentAlign = "";

  // State & Parsing Handlers
  const handlers: Record<
    string,
    (t: Token, filePath: string) => void | Promise<void>
  > = {
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
      const alignMatch = String(token.attrGet("style"))?.match(
        /text-align:\s*(\w+)/,
      );
      currentAlign = alignMatch?.[1] ?? "center";
    },
    td_open: (token: Token): void => {
      const alignMatch = String(token.attrGet("style"))?.match(
        /text-align:\s*(\w+)/,
      );
      currentAlign = alignMatch?.[1] ?? "left";
    },
    inline: async (token: Token, filePath: string): Promise<void> => {
      currentRow.push({
        type: "table-cell",
        content: await renderInline(token, filePath),
        properties: { textAlign: currentAlign },
      } as ProcessedToken);
    },
  };

  // Execution Loop
  for (const token of tokens) {
    const type = token.type;
    const handle = handlers[type];
    if (handle) await handle(token, filePath);
  }

  return tableRows;
}

async function alerts(tokens: Token[], filePath: string): Promise<AlertToken> {
  const children = tokens.slice(1, -2);
  const stylizedChildren = await stylize(children, filePath);
  return {
    type: "alert",
    content: stylizedChildren,
    properties: {
      alertType: (tokens[0]?.meta?.title as string) || "",
    },
  };
}

async function details(
  tokens: Token[],
  filePath: string,
): Promise<ProcessedToken[]> {
  const tokenStack = [];
  const firstToken: Token | undefined = tokens[0];
  if (!firstToken) throw new Error("This shouldn't have errored!");
  if (firstToken.type === "summary_open") {
    if (!tokens[1]) throw new Error("How did this happen?");
    tokenStack.push({
      type: "summary",
      content: await renderInline(tokens[1], filePath),
      properties: {},
    } satisfies DetailsSummaryToken);
    tokenStack.push({
      type: "content",
      content: await stylize(tokens.slice(3), filePath),
      properties: {},
    } satisfies DetailsContentToken);
  } else {
    tokenStack.push({
      type: "summary",
      content: "Details",
      properties: {},
    } satisfies DetailsSummaryToken);
    tokenStack.push({
      type: "content",
      content: await stylize(tokens, filePath),
      properties: {},
    } satisfies DetailsContentToken);
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
    return "";
  },
  paragraph: async (tokens: Token[], filePath: string) =>
    await renderInline(tokens[0]!, filePath), // it's always just one inline token
  table: async (tokens: Token[], filePath: string) =>
    await table(tokens, filePath),
  heading: async (tokens: Token[], _, level?: number | 1) =>
    heading(tokens[0]!, level),
  div: async (tokens: Token[], filePath: string) =>
    await stylize(tokens, filePath),
  blockquote: async (tokens: Token[], filePath: string) =>
    await stylize(tokens, filePath),
  bullet_list: async (tokens: Token[], filePath: string) =>
    await stylize(tokens, filePath),
  ordered_list: async (tokens: Token[], filePath: string) =>
    await stylize(tokens, filePath),
  list_item: async (tokens: Token[], filePath: string) =>
    await stylize(tokens, filePath),
  ruby: async (tokens: Token[], filePath: string) =>
    await stylize(tokens, filePath),
  // these ones recurse because they're container blocks
  details: async (tokens: Token[], filePath: string) =>
    await details(tokens, filePath),
  rp: async (tokens: Token[], filePath: string) =>
    await renderInline(tokens[0]!, filePath),
  rt: async (tokens: Token[], filePath: string) =>
    await renderInline(tokens[0]!, filePath),
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
function removeWhitespaceTokens<T extends ProcessedToken>(tokens: T[]): T[] {
  return tokens
    .map((token) => {
      switch (token.type) {
        case "table": {
          return {
            ...token,
            content: token.content.map((row) =>
              row.map((cell) => {
                return {
                  ...cell,
                  content: removeWhitespaceTokens(cell.content),
                };
              }),
            ),
          };
        }
        case "bullet_list":
        case "ordered_list":
        case "list_item":
        case "alert":
        case "paragraph":
          return {
            ...token,
            content: removeWhitespaceTokens(token.content),
          };
        case "text":
          return {
            ...token,
            content: token.content.trim(),
          };
        default:
          return token;
      }
    })
    .filter((token) => {
      if (token.type === "text") {
        return token.content !== "";
      }
      if (Array.isArray(token.content)) {
        return token.content.length > 0;
      }
      return true;
    });
}

export default async function stylize(
  input: Token[],
  filePath: string,
): Promise<ProcessedToken[]> {
  // input is an array returned by `parse()` in `parse - input.js`
  const output = [];
  let index = 0;

  while (index < input.length) {
    let push: {
      type: ProcessedTokenTypes;
      content: ProcessedToken["content"];
      properties: { [type: string]: string };
    } = {
      type: "" as ProcessedTokenTypes,
      content: "",
      properties: {},
    };
    let token = input[index];
    if (!token) throw new Error(`Token at ${index} is not defined!!!`);

    // give attrs
    if (token.attrs) {
      for (let [key, value] of token.attrs) {
        push.properties[key] = String(value);
      }
    }

    if (token.type === "alert_open") {
      const accumulatedTokens = [];
      while (input[index]?.type !== "alert_close") {
        accumulatedTokens.push(input[index]);
        index++;
      }
      accumulatedTokens.push(input[index]); // should push a token with type "alert_close"
      const processedAlertToken = await alerts(
        accumulatedTokens as Token[],
        filePath,
      );
      push = processedAlertToken;
    } else if (token.type.match(/_open/)) {
      const accumulatedTokens: Token[] = [];
      index++;
      const tokenType = token.type.replace("_open", "") as ProcessedTokenTypes;
      if (!input[index]) {
        throw new Error(
          `Token at index ${index} is undefined. The length of the input array is ${input.length} `,
        );
      }
      while (input[index] && input[index]!.level !== token.level) {
        accumulatedTokens.push(input[index]!);
        index++;
      }
      const handler: Handler | undefined = handleTokens[tokenType];
      state.push(tokenType);
      if (handler) {
        push.type = tokenType;
        push.content =
          tokenType === "heading"
            ? await handler(
              accumulatedTokens,
              filePath,
              parseInt(token.tag.split("")[1]!),
            )
            : await handler(accumulatedTokens, filePath);
        const unknownTagString: ProcessedToken = {
          type: "paragraph",
          content: [
            {
              type: "text",
              content: accumulatedTokenContentString,
              properties: {},
            },
          ],
          properties: {},
        };
        output.push(unknownTagString);
        accumulatedTokenContentString = "";
      } else if (accumulatedTokens.length > 0) {
        await handleTokens.default!(accumulatedTokens, filePath);
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
      push.type = "paragraph";
      push.content = await renderInline(token);
    } else {
      throw new Error(
        "Token type was not recognized: you might need to add handling for it in /src/stylize.js in the default `stylize()` function" +
        "\n" +
        Chalk.dim(
          `PS: the token type was ${token.type}. Its index is ${index} `,
        ),
      );
    }

    // no more! push the `push` object to the output array
    output.push(push as ProcessedToken);
    index++;
  }

  // state = [];
  return removeWhitespaceTokens(output);
}
