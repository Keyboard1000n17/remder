import parseInput from "./parse-input.ts";
import stylize, {
  Image,
  type HeadingObject,
  type ProcessedToken,
} from "./stylize.ts";
import {
  createCliRenderer,
  Box,
  Text,
  type ProxiedVNode,
  Select,
  type TextChunk,
  TextTableRenderable,
  ScrollBox,
  RGBA,
  createTextAttributes,
  StyledText,
  KeyEvent,
  type BoxOptions,
  BoxRenderable,
} from "@opentui/core";
import { parseArgs } from "node:util";
import got from "got";
import chalk from "chalk";
import { readdir, stat } from "node:fs/promises";
import { createColorPalette, parseAnsiSequences } from "ansi-sequence-parser";
import { openSync } from "node:fs";
import type { FontName } from "figlet";

//#region icon map
const languageToNerdFontIconMap: Record<string, string> = {
  "angular-html": "\ued4b",
  "angular-ts": "\ued4b",
  apache: "\ue72b",
  apex: "\ue8f5",
  apl: "\ue730",
  applescript: "\ue711",
  asm: "\ue6ab",
  astro: "\ue6b3",
  awk: "\ue741",
  ballerina: "\ue75e",
  bat: "\uebc4",
  c: "\ue61e",
  cairo: "\ue773",
  clarity: "\ue78d",
  clojure: "\ue768",
  cmake: "\ue794",
  cobol: "\ue900",
  coffeescript: "\ue751",
  "common-lisp": "\ue6b0",
  cpp: "\ue61d",
  crystal: "\ue7ac",
  csharp: "\ue7b2",
  css: "\ue749",
  csv: "\ueefc",
  d: "\ue7af",
  dart: "\ue798",
  default: "\ueac4",
  desktop: "\uf108",
  diff: "\ue702", // git diffs
  dockerfile: "\ue7b0",
  dotenv: "\ueba3",
  elixir: "\ue62d",
  elm: "\ue7ce",
  "emacs-lisp": "\ue632",
  erb: "\uf33a",
  erlang: "\ue7b1",
  fennel: "\ue6af",
  fish: "\uf1af",
  "git-commit": "\ue702",
  "git-rebase": "\ue702",
  gleam: "\ue914",
  gn: "\ueadd",
  go: "\ueb93",
  graphql: "\ue8f6",
  groovy: "\ue775",
  hack: "\uf1d4",
  handlebars: "\ue7f7",
  haskell: "\ue777",
  haxe: "\ue7fa",
  html: "\ue736",
  hy: "\uebb9",
  ini: "\ueaba",
  java: "\ue738",
  javascript: "\ue781",
  jinja: "\ue66f",
  json: "\ueb0f",
  jsx: "\ue61b",
  julia: "\ue80d",
  just: "\uebf0",
  kotlin: "\ue634",
  latex: "\ue81f",
  less: "\ue758",
  liquid: "\uf1826",
  logo: "\uf0343",
  lua: "\ue826",
  makefile: "\ue673",
  markdown: "\ueb1d",
  matlab: "\ue82a",
  move: "\ueadf",
  nginx: "\ue776",
  nim: "\ueaba",
  nix: "\ue843",
  ocaml: "\ue84e",
  openscad: "\uf34e",
  perl: "\ue769",
  php: "\ue77a",
  polar: "\uf041e",
  postcss: "\ue86a",
  powershell: "\uebc7",
  prisma: "\ue86e",
  prolog: "\ue7a1",
  pug: "\ue938",
  puppet: "\ue631",
  purescript: "\ue630",
  python: "\uec39",
  r: "\uea97",
  racket: "\uebe5",
  rel: "\ueb58",
  ron: "\ueab4",
  ruby: "\ueb48",
  rust: "\ue68b",
  sas: "\ue74b",
  sass: "\ue74b",
  scala: "\ue737",
  scheme: "\ue6b1",
  shell: "\uebc7",
  solidity: "\ue8a6",
  sql: "\ue75b",
  stata: "\ue8b2",
  stylus: "\ue759",
  svelte: "\ue8b7",
  swift: "\ue755",
  templ: "\uebbf",
  terraform: "\ue8bd",
  tex: "\uec5e",
  toml: "\ue6b2",
  turtle: "\uf0cd7",
  twig: "\ue61c",
  "ts-tags": "\ue8ca",
  typescript: "\ue8ca",
  typst: "\uf37f",
  v: "\uea97",
  vala: "\ue8d1",
  vim: "\ue6ae",
  vue: "\ue8dc",
  "vue-html": "\ue8dc",
  "vue-vine": "\ue8dc",
  vyper: "\ue8df",
  wolfram: "\ue956",
  xml: "\ue8ea",
  yaml: "\ue8eb",
  zig: "\ue8ef",
};
//#endregion

const colorPalette = createColorPalette();

//#region utility functions: `rgbToRGBA`, `ansiToTextChunks`, `ansiToTextToken`
const rgbToRGBA = ([r, g, b]: [number, number, number]): [
  number,
  number,
  number,
] => [r / 255, g / 255, b / 255];

const ansiToTextChunks = (text: string) => {
  const ansiTokens = parseAnsiSequences(text);
  const textChunks = ansiTokens.map((ansiToken): TextChunk => {
    return {
      __isChunk: true,
      text: ansiToken.value,
      fg: ansiToken.foreground
        ? "name" in ansiToken.foreground
          ? RGBA.fromHex(colorPalette.value(ansiToken.foreground))
          : "rgb" in ansiToken.foreground
            ? RGBA.fromValues(...rgbToRGBA(ansiToken.foreground.rgb))
            : undefined
        : undefined,
      bg: ansiToken.background
        ? "name" in ansiToken.background
          ? RGBA.fromHex(colorPalette.value(ansiToken.background))
          : "rgb" in ansiToken.background
            ? RGBA.fromValues(...rgbToRGBA(ansiToken.background.rgb))
            : undefined
        : undefined,
      attributes: createTextAttributes({
        bold: ansiToken.decorations.has("bold"),
        italic: ansiToken.decorations.has("italic"),
        underline: ansiToken.decorations.has("underline"),
        dim: ansiToken.decorations.has("dim"),
        strikethrough: ansiToken.decorations.has("strikethrough"),
      }),
    };
  });
  return textChunks;
};

const ansiToTextToken = (text: string) => {
  return Text({
    content: new StyledText(ansiToTextChunks(text)),
  });
};
//#endregion

async function makeFigletFont(text: string, level: number) {
  const figlet = (await import("figlet")).default;
  figlet.parseFont(
    "Calvin S Modified",
    await Bun.file(`${import.meta.dir}/fonts/calvin-s.flf`).text(),
  );
  const fontsList: Record<number, FontName> = {
    1: "ANSI Regular",
    2: "Coder Mini",
    3: "ANSI Compact",
    4: "Small",
    5: "miniwi",
    6: "Calvin S Modified",
  };
  return figlet.textSync(text, {
    font: fontsList[level],
    width: parseInt(args.values.width),
  });
}

function makeTaskList(item: ProcessedToken) {
  if (item.type !== "list_item") throw new Error("");
  console.log(`Called makeTaskList(), passed arg:\n${item}`);
  const content: ProcessedToken[] = [];
  for (const child of item.content as ProcessedToken[]) {
    switch (child.type) {
      case "paragraph":
        (child.content as ProcessedToken[]).forEach((text) => {
          if (typeof text.content === "string") {
            const startsWith = text.content.match(/^\[[ xX]\]\s*/);
            const replace = (text: string, toReplace: string) =>
              toReplace.trim().toLowerCase() === "[x]"
                ? text.replace(toReplace, chalk.bgGray(" \uf00c ") + " ")
                : text.replace("[ ]", chalk.bgGray("   "));
            content.push({
              ...text,
              content: startsWith?.[0]
                ? replace(text.content, startsWith[0])
                : text.content,
            });
          } else {
            content.push(text);
          }
        });
        break;
      case "bullet_list":
        content.push({
          ...child,
          content: Array.isArray(child.content)
            ? (child.content as ProcessedToken[]).map((t) => makeTaskList(t))
            : child.content,
        });
        break;
      default:
        content.push(child);
    }
  }
  return { ...item, content };
}

const args = parseArgs({
  options: {
    noRenderImages: {
      type: "boolean",
      default: false,
      short: "i",
    },
    noRenderHeadings: {
      type: "boolean",
      default: false,
      short: "H",
    },
    width: {
      type: "string",
      default: process.stdout.columns?.toString() || "80",
      short: "w",
    },
    height: {
      type: "string",
      default: process.stdout.rows?.toString() || "25",
      short: "c",
    },
    printToStdout: {
      type: "boolean",
      default: false,
      short: "o",
    },
    debug: {
      type: "boolean",
      default: false,
      short: "d",
    },
  },
  allowPositionals: true,
});

async function renderTable(tableToken: ProcessedToken) {
  const rows: TextChunk[][][] = [];
  if (!Array.isArray(tableToken.content))
    throw new Error(
      `Table token type is somehow ${typeof tableToken.content} instead of an array!`,
    );
  for (const row of tableToken.content) {
    const cells: TextChunk[][] = [];
    if (!Array.isArray(row))
      throw new Error(
        `Table token type is somehow ${typeof row} instead of an array!`,
      );
    for (const cell of row) {
      if (cell.type !== "table-cell") {
        throw new Error(`Cell type was ${cell.type} instead of "table-cell"!`);
      }
      for (const item of cell.content) {
        let cellText = "";
        if (item.type === "text") {
          if (typeof item.content !== "string") {
            throw new Error(
              `The type of the table cell content was ${typeof item.content} instead of string!`,
            );
          }
          cellText +=
            rows.length === 0 ? chalk.bold(item.content) : item.content;
        } else if (item.type === "image") {
          cellText += args.values.noRenderImages
            ? chalk.gray(item.content.imageAlt)
            : await item.content.render();
        } else {
          throw new Error(
            `Type not recognized: expected "text" or "image" but got ${item.type}`,
          );
        }
        cells.push(ansiToTextChunks(cellText));
      }
    }
    rows.push(cells);
  }
  // console.log("TABLE:");
  // rows.forEach((cells) => cells.forEach((cell) => console.log(cell)));
  // console.log("TABLE ORIGINAL CONTENT:");
  // console.log(tableToken.content);
  return rows;
}

// NOTE: chatgpt made a prototype of this
// TODO: finish this soon
async function tokensToString(
  tokens: (ProcessedToken | Image)[],
  isRecursing?: boolean,
): Promise<string> {
  return (
    await Promise.all(
      tokens.map(async (token): Promise<string> => {
        if (typeof token.content === "string") {
          return token.content
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .join("\n");
        } else if ("imageAlt" in token) {
          return args.values.noRenderImages
            ? await token.render()
            : chalk.dim(token.imageAlt);
        } else if (
          Array.isArray(token.content) &&
          !token.content.every((arr) => Array.isArray(arr))
        ) {
          if (token.type === "bullet_list") {
            let str = "";
            for (const child of token.content as ProcessedToken[]) {
              if (child.type !== "list_item") throw new Error("Huh?");
              str += `\u2022 ${await tokensToString(child.content as (ProcessedToken | Image)[])}\n`;
            }
            return str;
          } else if (token.type === "ordered_list") {
            let number = token.properties.start || 1;
            let str = "";
            for (const child of token.content) {
              const content = Array.isArray(child) ? child : child.content;
              str += `${number}. ${await tokensToString(content)}\n`;
              number++;
            }
            return str;
          } else if (token.type === "blockquote") {
            let str = "";
            for (const child of token.content) {
              if (Array.isArray(child)) continue;
              const blockquoteContent = await tokensToString(
                isRecursing
                  ? [child]
                  : (child.content as (ProcessedToken | Image)[]),
                true,
              );
              str += `\u258c ${blockquoteContent
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
                .join("\n\u258c ")}\n`;
            }
            return str;
          } else {
            return await tokensToString(token.content);
          }
        } else if (
          typeof token.content === "object" &&
          "code" in token.content
        ) {
          return token.content.code;
        } else if (
          typeof token.content === "object" &&
          !("imageAlt" in token.content) &&
          token.type === "heading"
        ) {
          let str = "";
          const tokenContent = token.content as HeadingObject;
          return str;
        }
        return "";
      }),
    )
  ).join("\n");
}

export async function renderMarkdown(tokens: ProcessedToken[]) {
  const componentArray: (ProxiedVNode<any> | TextTableRenderable)[] = [];
  //#region
  for (const token of tokens) {
    //#region switch token type
    switch (token.type) {
      //#region paragraph/text
      // @ts-expect-error - intentional fallthrough
      case "text":
        if (typeof token.content === "string") {
          componentArray.push(
            ansiToTextToken(
              token.content
                .trim()
                .split("\n")
                .map((line) => line.trim())
                .join("\n"),
            ),
          );
          break;
        }
      case "paragraph":
        const content = token.content;
        const tempComponentArray = [];
        if (!Array.isArray(content))
          throw new Error(
            `Table token type is somehow ${typeof content} instead of an array!`,
          );

        for (const element of content) {
          if ("imageAlt" in element)
            continue; // this shouldn't be possible?
          else if (Array.isArray(element)) {
          } else if (
            element.type === "image" &&
            typeof element.content === "object" &&
            "imageAlt" in element.content
          ) {
            const image = element.content;
            tempComponentArray.push(
              args.values.noRenderImages
                ? ansiToTextToken(chalk.gray(image.imageAlt))
                : ansiToTextToken(await image.render()),
            );
          } else if (element.type === "text") {
            if (typeof element.content !== "string") throw new Error("What?");
            const parsedAnsi = ansiToTextToken(
              element.content
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
                .join("\n"),
            );
            tempComponentArray.push(parsedAnsi);
          } else {
            throw new Error(
              `Did not recognize type ${element.type}.
               Element contents are ${Object.keys(element.content)}.`,
            );
          }
        }
        componentArray.push(Box({ padding: 0 }, ...tempComponentArray));
        break;
      //#endregion
      //#region heading
      case "heading":
        // NOTE: completely generated by chatgpt
        let str = "";
        if (typeof token.content === "string") throw new Error("What?");
        const tokenContent: HeadingObject = token.content as HeadingObject;
        if (args.values.noRenderHeadings) {
          const linksArray: TextChunk[] = ansiToTextChunks(tokenContent.links);
          const colorMap: Record<number, (str: string) => string> = {
            1: (str: string) => chalk.bold.hex("#ffa50a")(str),
            2: (str: string) => chalk.bold.yellow(str),
            3: (str: string) => chalk.bold.cyan(str),
            4: (str: string) => chalk.bold.hex("#ffa5a5")(str),
            5: (str: string) => chalk.bold.green(str),
            6: (str: string) => chalk.bold.hex("#aaa")(str),
          };
          str = colorMap[tokenContent.level]!(
            "#".repeat(tokenContent.level) + " " + tokenContent.text,
          );
          componentArray.push(ansiToTextToken(str));
          componentArray.push(
            Text({
              content: new StyledText(linksArray),
            }),
          );
          break;
        }
        componentArray.push(
          Text({
            content: await makeFigletFont(
              tokenContent.text,
              tokenContent.level,
            ),
          }),
        );
        const linksArray: TextChunk[] = ansiToTextChunks(tokenContent.links);
        componentArray.push(
          Text({
            content: new StyledText(linksArray),
          }),
        );
        break;
      //#endregion
      //#region table
      case "table":
        componentArray.push(
          new TextTableRenderable(renderer, {
            content: await renderTable(token),
            maxWidth: parseInt(args.values.width) - 1,
            cellPaddingX: 1,
            columnWidthMode: "content",
            columnFitter: "balanced",
          }),
        );
        break;
      //#endregion
      //#region bullet list
      case "bullet_list":
        const bp = "\u2022";
        const bulletListItems = [];
        for (const listItem of token.content as ProcessedToken[]) {
          if (listItem.type !== "list_item")
            throw new Error(
              `Expected type "list_item" but got ${listItem.type}`,
            );
          if (!Array.isArray(listItem.content))
            throw new Error(
              `The contents of this list item were somehow not an array.`,
            );
          const transformedListItem = makeTaskList(listItem);
          const listContent = transformedListItem.content;
          const listRenderables = await renderMarkdown(
            listContent.flat() as ProcessedToken[],
          );
          for (const listRenderable of listRenderables) {
            bulletListItems.push(
              Box(
                {
                  flexDirection: "row",
                  gap: 1,
                },
                Text({ content: bp }),
                Box({}, listRenderable),
              ),
            );
          }
        }
        componentArray.push(Box({}, ...bulletListItems));
        break;
      //#endregion
      //#region ordered list
      case "ordered_list":
        let number = token.properties.start || 1;
        const orderedListItems = [];
        for (const listItem of token.content as ProcessedToken[]) {
          if (listItem.type !== "list_item")
            throw new Error(
              `Expected type "list_item" but got ${listItem.type}`,
            );
          const transformedListItem = makeTaskList(listItem);
          const listContent = transformedListItem.content;
          const listRenderables = await renderMarkdown(
            listContent.flat() as ProcessedToken[],
          );
          for (const listRenderable of listRenderables) {
            orderedListItems.push(
              Box(
                {
                  flexDirection: "row",
                  gap: 1,
                },
                Text({ content: `${number}.` }),
                Box({}, listRenderable),
              ),
            );
            number++;
          }
        }
        componentArray.push(Box({}, ...orderedListItems));
        break;
      //#endregion
      //#region blockquote
      case "blockquote":
        const uhb = "\u258c"; // unicode left half block
        const blockquoteRenderables = await renderMarkdown(
          token.content as ProcessedToken[],
        );
        componentArray.push(
          Box(
            {
              border: ["left"],
              paddingLeft: 1,
              customBorderChars: {
                bottomLeft: uhb,
                bottomRight: uhb,
                topLeft: uhb,
                topRight: uhb,
                vertical: uhb,
                horizontal: uhb,
                topT: uhb,
                bottomT: uhb,
                leftT: uhb,
                rightT: uhb,
                cross: uhb,
              },
              borderColor: RGBA.fromHex("#888"),
            },
            ...blockquoteRenderables,
          ),
        );
        break;
      //#endregion
      //#region alerts
      case "alert": {
        const alertIcons: Record<string, { icon: string; color: string }> = {
          Note: { icon: "\uf129", color: "#6af" },
          Tip: { icon: "\uf400", color: "#3b4" },
          Important: { icon: "\uf12a", color: "#96f" },
          Warning: { icon: "\uea6c", color: "#dd4" },
          Caution: { icon: "\u{f0ce6}", color: "#f44" },
        };
        const alertContent = await renderMarkdown(
          token.content as ProcessedToken[],
        );
        const uhb = "\u258c"; // unicode left half block
        const alertType = token.properties.alertType;
        const alertIconAndColor = alertIcons[alertType];
        componentArray.push(
          Box(
            {
              border: ["left"],
              paddingLeft: 1,
              customBorderChars: {
                bottomLeft: uhb,
                bottomRight: uhb,
                topLeft: uhb,
                topRight: uhb,
                vertical: uhb,
                horizontal: uhb,
                topT: uhb,
                bottomT: uhb,
                leftT: uhb,
                rightT: uhb,
                cross: uhb,
              },
              rowGap: 1,
              borderColor: RGBA.fromHex(alertIconAndColor?.color || ""),
            },
            Text({
              content: `${alertIconAndColor?.icon} ${alertType}`,
              fg: RGBA.fromHex(alertIconAndColor?.color || ""),
            }),
            ...alertContent,
          ),
        );
        break;
      }
      //#endregion
      //#region code block
      case "codeBlock":
        const codeTokenContent = token.content as {
          code: string;
          language: string;
        };
        const language = codeTokenContent.language;
        const icon =
          languageToNerdFontIconMap[language] ??
          languageToNerdFontIconMap.default;
        const box = Box(
          {
            paddingLeft: 2,
            paddingRight: 2,
            paddingTop: 1,
            marginLeft: 1,
            rowGap: 1,
            backgroundColor: "#181825",
            width: "auto",
            minWidth: 40,
            flexShrink: 0,
            flexGrow: 0,
            alignSelf: "flex-start",
          },
          Text({
            content: `${icon} ${language}`,
          }),
          Text({
            content: new StyledText(ansiToTextChunks(codeTokenContent.code)),
          }),
        );
        componentArray.push(box);
        break;
      //#endregion
      //#region default
      default:
        console.log("DEFAULT CASE:", token);
        componentArray.push(ansiToTextToken(String(token.content)));
      //#endregion
    }
    //#endregion
  }
  //#endregion
  return componentArray;
}

//#region file menu
const fileNames = (await readdir(".", { recursive: true, withFileTypes: true }))
  .filter((file) => file.isFile() && file.name.endsWith(".md"))
  .map((file) =>
    file.parentPath.length > 0
      ? [file.parentPath, file.name].join("/")
      : file.name,
  );
const optionsArray = [];
for (const file of fileNames) {
  let birthTime = "";
  try {
    birthTime = new Date((await stat(file)).birthtime).toDateString();
  } catch (err) {
    birthTime = "unknown";
  }
  optionsArray.push({ name: file, description: `Created at: ${birthTime}` });
}
const menu = Select({
  options: optionsArray,
  width: "100%",
  height: "100%",
});
//#endregion

//#region handle stdin on windows
if (process.platform === "win32") {
  args.values.printToStdout = true;
}

if (!process.stdin.isTTY && args.values.printToStdout) {
  const md = await Bun.stdin.text();
  const tokens = await stylize(parseInput(md));
  const content = await tokensToString(tokens);
  console.log(
    Bun.wrapAnsi(content, parseInt(args.values.width), { trim: false }),
  );
  process.exit(0);
}

const terminalInput = process.stdin.isTTY
  ? process.stdin
  : new (await import("node:tty")).ReadStream(openSync("/dev/tty", "r+"));

terminalInput.setRawMode?.(true);
terminalInput.resume();
//#endregion

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  width: parseInt(args.values.width),
  height: parseInt(args.values.height),
  stdin: terminalInput,
});

if (args.positionals.length > 0) {
  //#region handle supplied file
  const filePath = args.positionals.at(-1);
  let fileContent = "";
  if (URL.canParse(filePath!)) {
    fileContent = await got(filePath!).text();
  } else {
    try {
      fileContent = await Bun.file(filePath!).text();
    } catch (err) {
      throw new Error(`Encountered an error: ${err}`);
    }
  }
  const tokens = await stylize(parseInput(fileContent));
  if (args.values.printToStdout) {
    renderer.destroy();
    const content = await tokensToString(tokens);
    console.log(
      Bun.wrapAnsi(content, parseInt(args.values.width), { trim: false }),
    );
    process.exit(0);
  } else {
    const renderables = await renderMarkdown(tokens as ProcessedToken[]);
    renderables.forEach((renderable) => (renderable.marginBottom = 1));
    const box = ScrollBox(
      { width: parseInt(args.values.width), height: renderer.height - 1 },
      renderables,
    );
    box.focus();
    renderer.root.add(box);
  }
  //#endregion
} else if (!process.stdin.isTTY) {
  //#region handle piped input on non-windows systems
  const md = await Bun.stdin.text();
  const tokens = await stylize(parseInput(md));
  const renderables = await renderMarkdown(tokens as ProcessedToken[]);
  renderables.forEach((renderable) => (renderable.marginBottom = 1));
  const box = ScrollBox(
    {
      width: parseInt(args.values.width),
      height: renderer.height - 1,
    },
    renderables,
  );
  box.focus();
  renderer.root.add(box);
  //#endregion
} else {
  menu.focus();
  renderer.root.add(menu);
}

//#region keybinds help
const keymapHelp = Box(
  {
    gap: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    width: renderer.width > 60 ? 20 : "100%",
  },
  Text({ content: "q - quit" }),
);
//#endregion

//#region bottom bar + opts
const bottomBarOpts: BoxOptions<BoxRenderable> = {
  width: "100%",
  height: 1,
  flexDirection: "row",
  position: "absolute",
  bottom: 0,
  left: 0,
  backgroundColor: RGBA.fromInts(40, 40, 40),
  id: "bottomBar",
};
const bottomBarChildren: ProxiedVNode<any>[] = [
  Box(
    {
      paddingLeft: 1,
      paddingRight: 1,
      backgroundColor: RGBA.fromHex("#089916"),
      columnGap: 1,
    },
    Text({
      content: "reMDer",
      attributes: createTextAttributes({ bold: true, italic: true }),
    }),
  ),
];
if (args.positionals.at(-1)) {
  bottomBarChildren.push(
    Text({
      content: args.positionals.at(-1),
      attributes: createTextAttributes({ dim: true }),
      marginLeft: 1,
    }),
  );
}
const bottomBar = Box(bottomBarOpts, bottomBarChildren);
renderer.root.add(bottomBar);
//#endregion

//#region keybinds
const keyEventsArray = [];
const onPressQ = (key: KeyEvent) => {
  if (key.name === "q") {
    renderer.destroy();
  }
};
keyEventsArray.push(onPressQ);
if (args.values.debug) {
  const toggleConsoleOnC = (key: KeyEvent) => {
    if (key.name === "c" && (key.capsLock ? !key.shift : key.shift)) {
      renderer.console.toggle();
    }
  };
  keyEventsArray.push(toggleConsoleOnC);
}
keyEventsArray.forEach((keyEvent) =>
  renderer.keyInput.on("keypress", keyEvent),
);
renderer.once("destroy", () => {
  renderer.keyInput.off("keypress", onPressQ);
});
//#endregion
