//#region args
import { parseArgs } from "node:util";

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
      short: "y",
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
    help: {
      type: "boolean",
      default: false,
      short: "h",
    },
  },
  allowPositionals: true,
});
//#endregion

//#region help
if (args.values.help) {
  const options = [
    ["-h, --help", "Print this help message and exit"],
    ["-d, --debug", "Enable debug mode (enables console)"],
    ["-i, --no-render-images", "Disable rendering images"],
    [
      "-H, --no-render-headings",
      "Render headings with color instead of huge text",
    ],
    ["-w, --width <width>", "Set the TUI width"],
    ["-y, --height <height>", "Set the TUI height"],
  ];
  const optionWidth = Math.max(...options.map(([option]) => option!.length));
  const helpText = [
    "Usage: remder [options] <file?>",
    ...options.map(
      ([option, description]) =>
        `  ${option!.padEnd(optionWidth + 2)}${description}`,
    ),
  ].join("\n");
  console.log(helpText);
  process.exit(0);
}
//#endregion

import parseInput from "./parse-input.ts";
import stylize, { type HeadingObject, type ProcessedToken } from "./stylize.ts";
import got from "got";
// these three are imported beforehand because they are required in the tokensToString function which is defined towards the start

// defined before tokensToString function because they're required there
const alignText = (
  text: string,
  align: "left" | "center" | "right",
): string => {
  const width = parseInt(args.values.width);
  if (align === "left") {
    return text;
  } else if (align === "right") {
    return text
      .split("\n")
      .map((line) =>
        line.padStart(Math.max(0, Bun.stringWidth(line) - width), " "),
      )
      .join("\n");
  } else if (align === "center") {
    return text
      .split("\n")
      .map((line) =>
        line.padStart(Math.max(0, (width - Bun.stringWidth(line)) / 2)),
      )
      .join("");
  }
  throw new Error(`Got align string "${align}"`);
};

const chunksToAnsi = (chunks: TextChunk[]) => {
  return chunks
    .map((chunk) => {
      let text = chunk.text;
      const attrs = chunk.attributes;
      if (chunk.fg) {
        const fg = chunk.fg.toInts().slice(0, 3) as [number, number, number];
        text = chalk.rgb(...fg)(text);
      }
      if (chunk.bg) {
        const bg = chunk.bg.toInts().slice(0, 3) as [number, number, number];
        text = chalk.bgRgb(...bg)(text);
      }
      if (chunk.link) {
        import("terminal-link")
          .then((r) => r.default)
          .then((terminalLink) => (text = terminalLink(text, chunk.link!.url)));
      }
      if (attrs && attrs & TextAttributes.BOLD) text = chalk.bold(text);
      if (attrs && attrs & TextAttributes.ITALIC) text = chalk.italic(text);
      if (attrs && attrs & TextAttributes.STRIKETHROUGH)
        text = chalk.strikethrough(text);
      if (attrs && attrs & TextAttributes.UNDERLINE)
        text = chalk.underline(text);
      return text;
    })
    .join("");
};

async function makeFigletFont(
  text: string,
  level: number,
  align: "left" | "center" | "right",
) {
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
  return figlet
    .textSync(text.trim(), {
      font: fontsList[level],
      width: parseInt(args.values.width),
      whitespaceBreak: true,
    })
    .split(/\n\s+\n/)
    .map((line) => alignText(line, align))
    .join("\n\n");
}

function makeTaskList(item: ProcessedToken) {
  if (item.type !== "list_item") throw new Error("");
  const content: ProcessedToken[] = [];
  for (const child of item.content as ProcessedToken[]) {
    switch (child.type) {
      case "paragraph":
        child.content.forEach((text) => {
          if (text.type === "text") {
            const startsWith =
              text.content.chunks[0]?.text.match(/^\[[ xX]\]\s*/);
            if (startsWith?.[0]) {
              text.content.chunks[0]!.text =
                text.content.chunks[0]!.text.replace(startsWith[0], " ");
              text.content.chunks.unshift({
                __isChunk: true,
                text:
                  startsWith?.[0].trim().toLowerCase() === "[x]"
                    ? " \uf00c "
                    : "   ",
                bg: RGBA.fromHex("#808080"),
              });
            }
            content.push({
              ...text,
              content: text.content,
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
            ? child.content.map((t) => makeTaskList(t))
            : child.content,
        });
        break;
      default:
        content.push(child);
    }
  }
  return { ...item, content };
}

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

//#region --print-to-stdout option
// NOTE: chatgpt made a prototype of this
if (args.values.printToStdout) {
  async function tokensToString(
    tokens: ProcessedToken[],
    indent = 0,
  ): Promise<string> {
    const contentStrings: string[] = [];
    const chalk = (await import("chalk")).default;
    const terminalImage =
      tokens.some(
        (t) =>
          t.type === "paragraph" && t.content.some((u) => u.type === "image"),
      ) && (await import("terminal-image")).default;
    const table =
      tokens.some((t) => t.type === "table") && (await import("table")).table;
    //#region
    for (const token of tokens) {
      //#region switch token type
      switch (token.type) {
        //#region text
        case "text":
          const content = token.content;
          contentStrings.push(chunksToAnsi(content.chunks));
          break;
        //#endregion
        //#region paragraph
        case "paragraph": {
          const content = token.content;
          const paragraphItems: string[] = [];
          for (const element of content) {
            if (element.type === "image") {
              const image = element.content;
              if (terminalImage) {
                const buf = await image.imageBuffer;
                paragraphItems.push(
                  buf
                    ? await terminalImage.buffer(buf)
                    : chalk.gray(image.imageAlt),
                );
              }
            } else if (element.type === "text") {
              const text = chunksToAnsi(element.content.chunks);
              paragraphItems.push(text);
            }
          }
          contentStrings.push(...paragraphItems);
          break;
        }
        //#endregion
        //#region headings
        case "heading":
          const tokenContent: HeadingObject = token.content as HeadingObject;
          if (args.values.noRenderHeadings) {
            const colorMap: Record<number, (str: string) => string> = {
              1: (str: string) => chalk.hex("#ffa50a")(str),
              2: (str: string) => chalk.hex("#eeee00")(str),
              3: (str: string) => chalk.hex("#0acadd")(str),
              4: (str: string) => chalk.hex("#ffa5a5")(str),
              5: (str: string) => chalk.hex("#22ff22")(str),
              6: (str: string) => chalk.hex("#aaaaaa")(str),
            };
            const str = colorMap[tokenContent.level]!(
              "#".repeat(tokenContent.level) + " " + tokenContent.text,
            );
            const heading = alignText(str, token.properties.align ?? "left");
            contentStrings.push(heading);
            if (tokenContent.links.chunks.length > 0) {
              contentStrings.push(chunksToAnsi(tokenContent.links.chunks));
            }
            break;
          }
          const figletChars = await makeFigletFont(
            tokenContent.text,
            tokenContent.level,
            token.properties.align ?? "left",
          );
          contentStrings.push(figletChars);
          if (tokenContent.links.chunks.length > 0) {
            contentStrings.push(chunksToAnsi(tokenContent.links.chunks));
          }
          break;
        //#endregion
        //#region table
        case "table":
          if (!table) break;
          const cells = await Promise.all(
            token.content.map(
              async (row) =>
                await Promise.all(
                  row.map(async (cell) => await tokensToString(cell.content)),
                ),
            ),
          );
          const renderedTable = table(cells, {
            border: {
              topLeft: "╭",
              topRight: "╮",
              bottomRight: "╯",
              bottomLeft: "╰",
              topBody: `─`,
              topJoin: `┬`,
              bottomBody: `─`,
              bottomJoin: `┴`,
              bodyLeft: `│`,
              bodyRight: `│`,
              bodyJoin: `│`,
              joinBody: `─`,
              joinLeft: `├`,
              joinRight: `┤`,
              joinJoin: `┼`,
            },
          });
          contentStrings.push(renderedTable);
          break;
        //#endregion
        //#region bullet list
        case "bullet_list":
          const bp = "\u2022";
          const bulletListItems = [];
          for (const listItem of token.content) {
            const transformedListItem = makeTaskList(listItem);
            const renderedListContent = await tokensToString(
              transformedListItem.content,
              indent + 2,
            );
            bulletListItems.push(
              renderedListContent
                .split("\n")
                .map((line, index) =>
                  index === 0
                    ? `${" ".repeat(indent)}${bp} ${line}`
                    : `${" ".repeat(indent)}  ${line}`,
                ),
            );
          }
          contentStrings.push(bulletListItems.join("\n"));
          break;
        //#endregion
        //#region ordered list
        case "ordered_list":
          let number = parseInt(token.properties.start) || 1;
          const orderdListMarkerWidth = String(token.content.length).length;
          const orderedListItems = [];
          for (const listItem of token.content) {
            const transformedListItem = makeTaskList(listItem);
            const renderedListContent = await tokensToString(
              transformedListItem.content,
              indent + 2,
            );
            orderedListItems.push(
              renderedListContent
                .split("\n")
                .map((line, index) =>
                  index === 0
                    ? `${indent}${String(number++).padStart(orderdListMarkerWidth, "0")}. ${line}`
                    : `${indent}  ${line}`,
                ),
            );
          }
          contentStrings.push(orderedListItems.join("\n"));
          break;
        //#endregion
        //#region blockquote
        case "blockquote":
          const uhb = "\u258c"; // unicode left half block
          const blockquoteItems = [];
          const renderedBlockquoteChildren = await tokensToString(
            token.content,
            indent + 2,
          );
          blockquoteItems.push(
            renderedBlockquoteChildren
              .split("\n")
              .map((line) => `${uhb} ${line}`)
              .join("\n"),
          );
          break;
        //#endregion
        //#region alerts
        case "alert": {
          const alertIcons: Record<
            string,
            { icon: string; color: string; name: string }
          > = {
            note: { icon: "\uf129", color: "#6af", name: "Note" },
            tip: { icon: "\uf400", color: "#3b4", name: "Tip" },
            important: { icon: "\uf12a", color: "#96f", name: "Important" },
            warning: { icon: "\uea6c", color: "#dd4", name: "Warning" },
            caution: { icon: "\u{f0ce6}", color: "#f44", name: "Caution" },
          };
          const alertType = token.properties.alertType;
          const alertIconAndColor = alertIcons[alertType];
          const renderedAlertChildren = await tokensToString(
            token.content,
            indent + 2,
          );
          const uhb = chalk.hex(alertIconAndColor!.color)("\u258c"); // unicode left half block
          contentStrings.push(
            uhb
            + chalk.hex(alertIconAndColor!.color)(
              ` ${alertIconAndColor!.icon} ${alertIconAndColor!.name}`,
            )
            + "\n"
            + renderedAlertChildren
              .split("\n")
              .map((line) => `${uhb} ${line}`)
              .join("\n"),
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
            languageToNerdFontIconMap[language]
            ?? languageToNerdFontIconMap.default;
          const languageLine = ` ${icon} ${language} `;
          const boxWidth = Math.min(
            Math.max(
              ...codeTokenContent.code
                .split("\n")
                .map((line) => Bun.stringWidth(line)),
              Bun.stringWidth(languageLine),
            ) + 2,
            parseInt(args.values.width) - 2,
          );
          const emptyLine = " ".repeat(boxWidth);
          const code = codeTokenContent.code
            .trim()
            .split("\n")
            .map(
              (line) =>
                " "
                + line
                + " ".repeat(boxWidth - Math.max(Bun.stringWidth(line), 0) - 1),
            )
            .join("\n");
          contentStrings.push(
            chalk.bgHex("#181225")(
              [
                emptyLine,
                `${languageLine}${" ".repeat(boxWidth - Bun.stringWidth(languageLine))}`,
                emptyLine,
                code,
                emptyLine,
              ].join("\n"),
            ),
          );
          break;
        //#endregion
        //#region div
        case "div":
          contentStrings.push(await tokensToString(token.content));
          break;
        //#endregion
        //#region details
        case "details":
          const detailsContent = token.content;
          const summaryToken = detailsContent.find((t) => t.type === "summary");
          const detailsToken = detailsContent.find((t) => t.type === "content");
          contentStrings.push(
            "\u25bc " + (await tokensToString(summaryToken!.content)),
          );
          contentStrings.push(await tokensToString(detailsToken!.content));
          break;
        //#endregion
        //#region default
        default:
          console.warn("DEFAULT CASE:", token);
          console.warn("args in current renderMarkdown() call:", tokens.length);
        //#endregion
      }
      //#endregion
    }
    //#endregion
    return contentStrings.join("\n\n");
  }
  if (!process.stdin.isTTY) {
    const md = await Bun.stdin.text();
    const tokens = await stylize(parseInput(md), "");
    const content = await tokensToString(tokens);
    process.stdout.write(
      Bun.wrapAnsi(content, parseInt(args.values.width), { trim: false }),
    );
    process.exit(0);
  } else {
    const path = args.positionals.at(-1);
    if (!path)
      throw new Error(
        "No path specified; specify a file with the syntax `remder <options> <path>",
      );
    const content = URL.canParse(path)
      ? await got(path).text()
      : await Bun.file(path).text();
    const processedContent = await tokensToString(
      await stylize(parseInput(content), path),
    );
    process.stdout.write(
      Bun.wrapAnsi(processedContent, parseInt(args.values.width), {
        trim: false,
      }),
    );
    process.exit(0);
  }
}
//#endregion

//#region imports
import { flushLogBuffer } from "./stylize.ts";
import {
  createCliRenderer,
  Box,
  Text,
  Select,
  type TextChunk,
  ScrollBox,
  RGBA,
  createTextAttributes,
  StyledText,
  KeyEvent,
  type BoxOptions,
  BoxRenderable,
  type TextOptions,
  ScrollBoxRenderable,
  SelectRenderable,
  Renderable,
  TextRenderable,
  type RenderContext,
  type BorderSides,
  RenderableEvents,
  TextAttributes,
} from "@opentui/core";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import chalk from "chalk";
import { readdir, stat } from "node:fs/promises";
import { createColorPalette, parseAnsiSequences } from "ansi-sequence-parser";
import { openSync } from "node:fs";
import type { FontName } from "figlet";
//#endregion

const colorPalette = createColorPalette();

const headingsArrayForToc: {
  text: string;
  level: number;
  id: string;
  renderable: Renderable;
}[] = []; // holds an array of all the headings in the document
let headingIndexForToc = 0;
const headingIndexes = [0, 0, 0, 0, 0, 0];

const detailsElementsArray: Renderable[] = [];
let detailsElementsIndex: number | null = null;

//#region utility functions: `rgbToRGBA`, `randomIdGenerator` `ansiToTextChunks`, `ansiToTextToken`
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

const ansiToTextToken = (text: string, ctx: RenderContext, id?: string) => {
  if (id) {
    return new TextRenderable(ctx, {
      content: new StyledText(ansiToTextChunks(text)),
      id: id,
      wrapMode: "word",
      width: "100%",
    });
  }
  const textToken = new TextRenderable(ctx, {
    content: new StyledText(ansiToTextChunks(text)),
    wrapMode: "word",
  });
  return textToken;
};
//#endregion

async function renderTable(ctx: RenderContext, tableToken: ProcessedToken) {
  if (tableToken.type !== "table")
    throw new Error(
      `Table token type is somehow ${typeof tableToken.content} instead of an array!`,
    );
  const table = new BoxRenderable(ctx, {
    width: "100%",
    maxWidth: ctx.width - 3,
    gap: 0,
  });
  const maxCellWidth = Math.round(
    ((ctx.terminalWidth ?? 80) - 2)
    / Math.max(...tableToken.content.map((arr) => arr.length)),
  );
  const maxCellContentWidth =
    Math.max(
      ...tableToken.content.flatMap((row) =>
        row.flatMap((cell) =>
          cell.content
            .filter((token) => token.type === "text")
            .flatMap((token) =>
              token.content.chunks.map((chunk) => Bun.stringWidth(chunk.text)),
            ),
        ),
      ),
    ) + 3;
  let cellWidth = Math.min(maxCellWidth, maxCellContentWidth);
  console.log(cellWidth);
  for (let rowIndex = 0; rowIndex < tableToken.content.length; rowIndex++) {
    const row = tableToken.content[rowIndex]!;
    const isFirstRow = rowIndex === 0;
    const isLastRow = rowIndex === tableToken.content.length - 1;
    const rowRenderable = new BoxRenderable(ctx, {
      width: "100%",
      gap: 0,
      flexDirection: "row",
      flexWrap: "no-wrap",
    });
    for (let cellIndex = 0; cellIndex < row.length; cellIndex++) {
      const cell = row[cellIndex]!;
      const isFirstColumn = cellIndex === 0;
      const isLastColumn = cellIndex === row.length - 1;
      const borders: BorderSides[] = [
        "bottom",
        "right",
        ...(isFirstRow ? ["top" as const] : []),
        ...(isFirstColumn ? ["left" as const] : []),
      ];
      const cellRenderable = new BoxRenderable(ctx, {
        alignItems: cell.properties.textAlign,
        border: borders,
        width: cellWidth,
        flexShrink: 1,
        paddingX: 1,
        customBorderChars: {
          topLeft: isFirstRow && isFirstColumn ? "╭" : "┼",
          topRight: isFirstRow ? (isLastColumn ? "╮" : "┬") : "┼",
          bottomLeft: isLastRow ? "╰" : "├",
          bottomRight: isLastRow
            ? isLastColumn
              ? "╯"
              : "┴"
            : isLastColumn
              ? "┤"
              : "┼",
          horizontal: "─",
          vertical: "│",
          topT: isFirstRow ? "┬" : "┼",
          bottomT: isLastRow ? "┴" : "┼",
          leftT: "├",
          rightT: "┤",
          cross: " ",
        },
      });
      for (const item of cell.content) {
        if (item.type === "text") {
          const contentLength = Bun.stringWidth(
            item.content.chunks.map((chunk) => chunk.text).join(),
          );
          if (contentLength % 2 === 1) {
            cellWidth += 1;
          }
          cellRenderable.add(
            new TextRenderable(ctx, {
              content: item.content,
            }),
          );
        } else if (item.type === "image") {
          if (args.values.noRenderImages) {
            cellRenderable.add(
              item.content.load(ctx, table.width, cell.content.length > 0),
            );
            continue;
          }
          cellRenderable.add(
            item.content.load(
              ctx,
              root.findDescendantById("root-scrollbox")?.width || 80,
              cell.content.length > 1,
            ),
          );
        } else {
          throw new Error(
            `Type not recognized: expected "text" or "image" but got ${item.type}`,
          );
        }
      }
      rowRenderable.add(cellRenderable);
    }
    table.add(rowRenderable);
    table
      .getChildren()
      .forEach((row) =>
        row.getChildren().forEach((cell) => (cell.width = cellWidth)),
      );
  }
  return table;
}

export async function renderMarkdown(
  tokens: ProcessedToken[],
  ctx: RenderContext,
) {
  const componentArray: Renderable[] = [];
  //#region
  for (const token of tokens) {
    //#region switch token type
    switch (token.type) {
      //#region paragraph/text
      case "text":
        const content = token.content;
        componentArray.push(
          new TextRenderable(ctx, {
            content,
            alignSelf: token.properties.align ?? "left",
          }),
        );
        break;
      case "paragraph": {
        const content = token.content;
        const tokenAlign = token.properties.align;
        const alignment = tokenAlign
          ? tokenAlign === "left"
            ? "flex-start"
            : tokenAlign === "right"
              ? "flex-end"
              : tokenAlign
          : "flex-start";
        const paragraphBox = new BoxRenderable(ctx, {
          padding: 0,
          alignItems: alignment,
          ...(content.every((element) => element.type === "image") && {
            flexDirection: "row",
            justifyContent: "flex-start",
            columnGap: 1,
            alignSelf: alignment,
          }),
        });
        for (const element of content) {
          if (element.type === "image") {
            const image = element.content;
            paragraphBox.add(
              args.values.noRenderImages
                ? ansiToTextToken(chalk.gray(image.imageAlt), ctx)
                : image.load(
                  ctx,
                  ctx.width - 2,
                  content.length > 1, // this argument is a boolean!
                ),
            );
          } else if (element.type === "text") {
            paragraphBox.add(
              new TextRenderable(ctx, { content: element.content }),
            );
          }
        }
        componentArray.push(paragraphBox);
        break;
      }
      //#endregion
      //#region headings
      case "heading":
        if (typeof token.content === "string") throw new Error("What?");
        const tokenContent: HeadingObject = token.content as HeadingObject;

        if (args.values.noRenderHeadings) {
          const colorMap: Record<number, (str: string) => StyledText> = {
            1: (str: string) =>
              new StyledText([
                { __isChunk: true, text: str, fg: RGBA.fromHex("#ffa50a") },
              ]),
            2: (str: string) =>
              new StyledText([
                { __isChunk: true, text: str, fg: RGBA.fromHex("#eeee00") },
              ]),
            3: (str: string) =>
              new StyledText([
                { __isChunk: true, text: str, fg: RGBA.fromHex("#0acadd") },
              ]),
            4: (str: string) =>
              new StyledText([
                { __isChunk: true, text: str, fg: RGBA.fromHex("#ffa5a5") },
              ]),
            5: (str: string) =>
              new StyledText([
                { __isChunk: true, text: str, fg: RGBA.fromHex("#22ff22") },
              ]),
            6: (str: string) =>
              new StyledText([
                { __isChunk: true, text: str, fg: RGBA.fromHex("#aaaaaa") },
              ]),
          };
          const str = colorMap[tokenContent.level]!(
            "#".repeat(tokenContent.level) + " " + tokenContent.text,
          );
          const level = tokenContent.level;
          headingIndexes[level - 1]!++;
          for (let i = level; i < headingIndexes.length; i++) {
            headingIndexes[i] = 0;
          }
          const headingId = `heading-${headingIndexes.slice(0, level).join("-")}`;
          const heading = new TextRenderable(ctx, {
            content: str,
            alignSelf: token.properties.align ?? "left",
          });
          componentArray.push(heading);
          if (tokenContent.links.chunks.length > 0) {
            componentArray.push(
              new TextRenderable(ctx, {
                content: tokenContent.links,
                alignSelf: token.properties.align ?? "left",
              }),
            );
          }
          headingsArrayForToc.push({
            text: tokenContent.text,
            level: tokenContent.level,
            id: headingId,
            renderable: heading,
          });
          break;
        }

        const level = tokenContent.level;
        headingIndexes[level - 1]!++;
        for (let i = level; i < headingIndexes.length; i++) {
          headingIndexes[i] = 0;
        }
        const headingId = `heading-${headingIndexes.slice(0, level).join("-")}`;
        const heading = new BoxRenderable(ctx, {
          id: headingId,
          flexDirection: "row",
          flexWrap: "wrap",
          alignSelf: token.properties.align ?? "left",
        });
        heading.add(
          new TextRenderable(ctx, {
            content: await makeFigletFont(
              tokenContent.text,
              tokenContent.level,
              "left",
            ),
          }),
        );
        componentArray.push(heading);
        if (tokenContent.links.chunks.length > 0) {
          componentArray.push(
            new TextRenderable(ctx, {
              content: tokenContent.links,
              alignSelf: token.properties.align ?? "left",
            }),
          );
        }
        headingsArrayForToc.push({
          text: tokenContent.text,
          level: tokenContent.level,
          id: headingId,
          renderable: heading,
        });
        break;
      //#endregion
      //#region table
      case "table":
        componentArray.push(await renderTable(ctx, token));
        break;
      //#endregion
      //#region bullet list
      case "bullet_list":
        const bp = "\u2022";
        const bulletListbox = new BoxRenderable(ctx, {
          alignItems: token.properties.align ?? "left",
        });
        for (const listItem of token.content) {
          const transformedListItem = makeTaskList(listItem);
          const listContent = transformedListItem.content;
          const listRenderables = await renderMarkdown(listContent.flat(), ctx);
          for (const listRenderable of listRenderables) {
            bulletListbox.add(
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
        componentArray.push(bulletListbox);
        break;
      //#endregion
      //#region ordered list
      case "ordered_list":
        let number = token.properties.start || 1;
        const orderedListBox = new BoxRenderable(ctx, {
          alignSelf: token.properties.align ?? "left",
          alignItems: token.properties.align ?? "left",
        });
        for (const listItem of token.content as ProcessedToken[]) {
          if (listItem.type !== "list_item")
            throw new Error(
              `Expected type "list_item" but got ${listItem.type}`,
            );
          const transformedListItem = makeTaskList(listItem);
          const listContent = transformedListItem.content;
          const listRenderables = await renderMarkdown(
            listContent.flat() as ProcessedToken[],
            ctx,
          );
          for (const listRenderable of listRenderables) {
            orderedListBox.add(
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
        componentArray.push(orderedListBox);
        break;
      //#endregion
      //#region blockquote
      case "blockquote":
        const uhb = "\u258c"; // unicode left half block
        const blockquoteBox = new BoxRenderable(ctx, {
          alignItems: token.properties.align ?? "left",
          alignSelf: token.properties.align ?? "left",
        });
        const blockquoteRenderables = await renderMarkdown(
          token.content as ProcessedToken[],
          ctx,
        );
        blockquoteRenderables.forEach((renderable) =>
          blockquoteBox.add(
            Box(
              {
                paddingLeft: 1,
                border: ["left"],
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
              },
              renderable,
            ),
          ),
        );
        componentArray.push(blockquoteBox);
        break;
      //#endregion
      //#region alerts
      case "alert": {
        const alertIcons: Record<
          string,
          { icon: string; color: string; name: string }
        > = {
          note: { icon: "\uf129", color: "#6af", name: "Note" },
          tip: { icon: "\uf400", color: "#3b4", name: "Tip" },
          important: { icon: "\uf12a", color: "#96f", name: "Important" },
          warning: { icon: "\uea6c", color: "#dd4", name: "Warning" },
          caution: { icon: "\u{f0ce6}", color: "#f44", name: "Caution" },
        };
        const uhb = "\u258c"; // unicode left half block
        const alertType = token.properties.alertType;
        const alertIconAndColor = alertIcons[alertType];
        const alertBox = new BoxRenderable(ctx, {
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
        });
        alertBox.add(
          Text({
            content: `${alertIconAndColor?.icon} ${alertIconAndColor?.name}`,
            fg: RGBA.fromHex(alertIconAndColor?.color || ""),
          }),
        );
        (await renderMarkdown(token.content, ctx)).forEach((renderable) =>
          alertBox.add(renderable),
        );
        componentArray.push(alertBox);
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
          languageToNerdFontIconMap[language]
          ?? languageToNerdFontIconMap.default;
        const box = new BoxRenderable(ctx, {
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
        });
        box.add(
          Text({
            content: `${icon} ${language}`,
          }),
        );
        box.add(
          Text({
            content: new StyledText(ansiToTextChunks(codeTokenContent.code)),
          }),
        );
        componentArray.push(box);
        break;
      //#endregion
      //#region div
      case "div":
        const divBox = new BoxRenderable(ctx, {
          flexDirection: "column",
          width: "100%",
          alignSelf: token.properties.align ?? "left",
          alignItems: token.properties.align ?? "left",
        });
        const divBoxRenderables = await renderMarkdown(
          token.content as ProcessedToken[],
          ctx,
        );
        divBoxRenderables.forEach((renderable) => divBox.add(renderable));
        componentArray.push(divBox);
        break;
      //#endregion
      //#region details
      case "details":
        const detailsId = crypto.randomUUID();
        const detailsContent = token.content;
        const isOpen = token.properties.open;
        const summaryToken = detailsContent.find((t) => t.type === "summary");
        const summaryText = new BoxRenderable(ctx, {});
        if (summaryToken)
          (await renderMarkdown(summaryToken.content, ctx)).forEach(
            (renderable) => summaryText.add(renderable),
          );
        const detailsBox = Box({
          id: `details-element-${detailsId}`,
          visible: isOpen ? true : false,
          alignSelf: token.properties.align ?? "left",
          alignItems: token.properties.align ?? "left",
          rowGap: 1,
        });
        (
          await renderMarkdown(
            detailsContent.find((t) => t.type === "content")!.content,
            ctx,
          )
        ).forEach((renderable) => detailsBox.add(renderable)); // the content of the details element
        const openIndicator = Text({
          content: "⏵",
          visible: isOpen ? false : true,
          id: `closed-indicator-${detailsId}`,
        });
        const closedIndicator = Text({
          content: "⏷",
          visible: isOpen ? true : false,
          id: `open-indicator-${detailsId}`,
        });
        const indicators = Box(
          { id: `indicators-details-${detailsId}` },
          openIndicator,
          closedIndicator,
        );
        const onSelect = () => {
          const detailsElement = summaryBox.findDescendantById(
            `details-element-${detailsId}`,
          );
          if (detailsElement) detailsElement.visible = !detailsElement.visible;
          openIndicator.visible = !openIndicator.visible;
          closedIndicator.visible = !closedIndicator.visible;
        };
        const summaryBox = new BoxRenderable(ctx, {
          width: "100%",
          flexDirection: "column",
          rowGap: 1,
          id: detailsId,
        });
        const summaryTextRenderable = new BoxRenderable(ctx, {
          flexDirection: "row",
          gap: 1,
          focusable: true,
          onMouseDown: onSelect,
          onKeyDown: (key: KeyEvent) => {
            if (key.name === "space" || key.name === "return") {
              onSelect();
              summaryBox.border = openIndicator!.visible ? false : ["right"];
              summaryBox.paddingRight = openIndicator!.visible ? 1 : 0;
            }
          },
        });
        summaryTextRenderable.add(indicators);
        summaryTextRenderable.add(summaryText);
        summaryTextRenderable.on(RenderableEvents.FOCUSED, () => {
          summaryTextRenderable.backgroundColor = RGBA.fromHex("#333");
        });
        summaryTextRenderable.on(RenderableEvents.BLURRED, () => {
          summaryTextRenderable.backgroundColor = "transparent";
        });
        summaryBox.add(summaryTextRenderable);
        summaryBox.add(detailsBox);
        componentArray.push(summaryBox);
        detailsElementsArray.push(summaryTextRenderable);
        break;
      //#endregion
      //#region default
      default:
        console.warn("DEFAULT CASE:", token);
        console.warn("args in current renderMarkdown() call:", tokens.length);
        componentArray.push(ansiToTextToken(String(token.content), ctx));
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
  consoleOptions: {
    sizePercent: 60,
  },
});

flushLogBuffer();

const root = new BoxRenderable(renderer, {
  width: "100%",
  height: "100%",
  flexDirection: "row",
  live: true,
});
renderer.root.add(root);

const contentScrollBoxOpts = {
  width: "auto" as "auto",
  minWidth: 0,
  height: renderer.height - 1,
  id: "root-scrollbox",
  flexShrink: 1,
  flexGrow: 1,
  paddingRight: 3,
  contentOptions: {
    rowGap: 1,
    paddingLeft: 1,
  },
};

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
  const tokens = await stylize(parseInput(fileContent), filePath || "");
  console.log(filePath);
  if (args.values.printToStdout) {
    renderer.destroy();
    // TODO: uncomment when you're done with the `tokensToString` function
    // const content = await tokensToString(tokens);
    // console.log(
    //   Bun.wrapAnsi(content, parseInt(args.values.width), { trim: false }),
    // );
    process.exit(0);
  } else {
    const box = new ScrollBoxRenderable(renderer, contentScrollBoxOpts);
    const renderables = await renderMarkdown(
      tokens as ProcessedToken[],
      renderer,
    );
    renderables.forEach((renderable) => {
      box.add(renderable);
    });
    box.focus();
    root.add(box);
  }
  //#endregion
} else if (!process.stdin.isTTY) {
  //#region handle piped input on non-windows systems
  const md = await Bun.stdin.text();
  const tokens = await stylize(parseInput(md), "");
  const renderables = await renderMarkdown(
    tokens as ProcessedToken[],
    renderer,
  );
  const box = ScrollBox(contentScrollBoxOpts, renderables);
  box.focus();
  root.add(box);
  //#endregion
} else {
  menu.focus();
  root.add(menu);
}

const keymap = createDefaultOpenTuiKeymap(renderer);
keymap.registerLayer({
  commands: [
    //#region quit
    {
      name: "app.quit",
      run() {
        renderer.destroy();
        terminalInput.destroy();
      },
    },
    //#endregion
    //#region down
    {
      name: "app.down",
      run() {
        (
          root.findDescendantById(`root-scrollbox`) as
          ScrollBoxRenderable | undefined
        )?.scrollBy(1);
      },
    },
    //#endregion
    //#region up
    {
      name: "app.up",
      run() {
        (
          root.findDescendantById(`root-scrollbox`) as
          ScrollBoxRenderable | undefined
        )?.scrollBy(-1);
      },
    },
    //#endregion
    //#region focus previous details
    {
      name: "content.prevDetails",
      run() {
        if (!detailsElementsIndex) detailsElementsIndex = 0;
        detailsElementsIndex =
          (detailsElementsIndex - 1 + detailsElementsArray.length)
          % detailsElementsArray.length;
        const detailsElement = detailsElementsArray.at(detailsElementsIndex);
        console.log(
          `pressed previous details. current index is ${detailsElementsIndex}`,
        );
        detailsElementsIndex =
          detailsElementsIndex % detailsElementsArray.length;
        if (detailsElement) {
          detailsElement?.focus();
          (
            root.findDescendantById(`root-scrollbox`) as
            ScrollBoxRenderable | undefined
          )?.scrollBy(detailsElement.y);
        }
      },
    },
    //#endregion
    //#region focus next details
    {
      name: "content.nextDetails",
      run() {
        if (!detailsElementsIndex) detailsElementsIndex = -1;
        detailsElementsIndex =
          (detailsElementsIndex + 1) % detailsElementsArray.length;
        const detailsElement = detailsElementsArray.at(detailsElementsIndex);
        console.log(
          `pressed previous details. current index is ${detailsElementsIndex}`,
        );
        if (detailsElement) {
          detailsElement?.focus();
          (
            root.findDescendantById(`root-scrollbox`) as
            ScrollBoxRenderable | undefined
          )?.scrollBy(detailsElement.y);
        }
      },
    },
    //#endregion
    //#region help menu
    {
      name: "app.help",
      run() {
        const helpMenuBox = root.findDescendantById("helpMenu");
        if (helpMenuBox) helpMenuBox.visible = !helpMenuBox.visible;
      },
    },
    //#endregion
    //#region toggle console
    {
      name: "app.console",
      run() {
        if (args.values.debug) renderer.console.toggle();
      },
    },
    //#endregion
    //#region jump to previous heading
    {
      name: "content.prevHeading",
      run() {
        if (headingsArrayForToc.length > 0) {
          headingIndexForToc =
            (headingIndexForToc - 1 + headingsArrayForToc.length)
            % headingsArrayForToc.length;
          const id = headingsArrayForToc[headingIndexForToc]?.id;
          if (!id) return;
          const heading = root.findDescendantById(id);
          const y = heading?.y;
          if (y === undefined || !heading) return;
          process.nextTick(() =>
            contentScrollBox.scrollTo(heading.y + contentScrollBox.scrollTop),
          );
          tocMenu.setSelectedIndex(headingIndexForToc);
          console.log(
            `prev heading / scrolled to ${heading.y + contentScrollBox.scrollTop}`,
          );
        }
      },
    },
    //#endregion
    //#region jump to next heading
    {
      name: "content.nextHeading",
      run() {
        if (headingsArrayForToc.length > 0) {
          const id = headingsArrayForToc[headingIndexForToc]?.id;
          if (!id) return;
          const heading = root.findDescendantById(id);
          const y = heading?.y;
          if (y === undefined || !heading) return;
          process.nextTick(() =>
            contentScrollBox.scrollTo(heading.y + contentScrollBox.scrollTop),
          );
          tocMenu.setSelectedIndex(headingIndexForToc);
          headingIndexForToc =
            (headingIndexForToc + 1) % headingsArrayForToc.length;
          console.log(
            `next heading / scrolled to ${heading.y + contentScrollBox.scrollTop}`,
          );
        }
      },
    },
    //#endregion
    //#region toggle toc
    {
      name: "app.toc",
      run() {
        if (tocBox) tocBox.visible = !tocBox.visible;
      },
    },
    //#endregion
    //#region jump to top
    {
      name: "content.goToTop",
      run() {
        contentScrollBox.scrollTo(0);
      },
    },
    //#endregion
    //#region jump to bottom
    {
      name: "content.goToBottom",
      run() {
        contentScrollBox.scrollTo(contentScrollBox.scrollHeight);
      },
    },
    //#endregion
  ],
  bindings: [
    { key: "q", cmd: "app.quit" },
    { key: "]d", cmd: "content.nextDetails" },
    { key: "[d", cmd: "content.prevDetails" },
    { key: "down", cmd: "app.down" },
    { key: "j", cmd: "app.down" },
    { key: "up", cmd: "app.up" },
    { key: "k", cmd: "app.up" },
    { key: "?", cmd: "app.help" },
    { key: "shift+c", cmd: "app.console" },
    { key: "shift+k", cmd: "content.prevHeading" },
    { key: "shift+j", cmd: "content.nextHeading" },
    { key: "shift+t", cmd: "app.toc" },
    { key: "g", cmd: "content.goToTop" },
    { key: "shift+g", cmd: "content.goToBottom" },
  ],
});

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
const bottomBar = new BoxRenderable(renderer, bottomBarOpts);
bottomBar.add(
  Box(
    {
      paddingLeft: 1,
      paddingRight: 1,
      backgroundColor: RGBA.fromHex("#089916"),
      columnGap: 1,
    },
    Text({
      content: "reMDer",
      attributes: createTextAttributes({ bold: true }),
    }),
  ),
);
bottomBar.add(
  Text({
    content: args.positionals.at(-1) || "stdin",
    attributes: createTextAttributes({ dim: true }),
    marginLeft: 1,
  }),
);
bottomBar.add(
  Text({
    content: "? - Help",
    alignSelf: "flex-end",
    marginLeft: "auto",
    marginRight: 1,
  }),
);
root.add(bottomBar);
//#endregion

//#region help menu
const helpMenuChildrenOpts: TextOptions = {
  width: "auto",
  height: 1,
};
// prettier-ignore
const helpMenuChildren = [
  Text({ content: "q        quit", ...helpMenuChildrenOpts }),
  Text({ content: "j/down   go down", ...helpMenuChildrenOpts }),
  Text({ content: "k/up     go up", ...helpMenuChildrenOpts }),
  Text({ content: "J        jump to next heading", ...helpMenuChildrenOpts }),
  Text({ content: "K        jump to previous heading", ...helpMenuChildrenOpts }),
  Text({ content: "T        toggle table of contents", ...helpMenuChildrenOpts }),
  Text({ content: "?        help menu", ...helpMenuChildrenOpts }),
  Text({ content: "g        go to top", ...helpMenuChildrenOpts }),
  Text({ content: "G        go to bottom", ...helpMenuChildrenOpts }),
  Text({ content: "[d       go to previous details element", ...helpMenuChildrenOpts, }),
  Text({ content: "]d       go to next details element", ...helpMenuChildrenOpts }),
];
if (args.values.debug) {
  helpMenuChildren.push(
    Text({ content: "C      - toggle console", ...helpMenuChildrenOpts }),
  );
}
const helpMenuOpts: BoxOptions<BoxRenderable> = {
  flexDirection: "column",
  position: "absolute",
  gap: 1,
  padding: 1,
  border: true,
  title: "Help",
  titleAlignment: "center",
  titleColor: "white",
  backgroundColor: RGBA.fromInts(40, 40, 40),
  borderColor: RGBA.fromInts(40, 40, 40),
  id: "helpMenu",
  visible: false,
  zIndex: 5,
  onSizeChange() {
    helpMenuBox.top = Math.floor((root.height - helpMenuBox.height) / 2);
    helpMenuBox.left = Math.floor((root.width - helpMenuBox.width) / 2);
  },
};
const helpMenuBox = new BoxRenderable(renderer, helpMenuOpts);
helpMenuChildren.forEach((child) => helpMenuBox.add(child));
console.log(root.height, helpMenuBox.height, root.width, helpMenuBox.width);
root.add(helpMenuBox);
//#endregion

//#region table of contents
const tocMenuChildren = headingsArrayForToc.map((heading) => {
  const headingNumber = heading.id.split("-").at(-1)?.padStart(2, "0");
  return {
    name: `${"  ".repeat(heading.level - 1)}${headingNumber} ${heading.text}`,
    description: "",
    value: heading.id,
  };
});
const tocMenu = new SelectRenderable(renderer, {
  padding: 1,
  width: 40,
  id: "toc-scrollbox",
  focusedBackgroundColor: RGBA.fromInts(8, 153, 22, 0.2),
  textColor: RGBA.fromInts(208, 208, 208),
  focusedTextColor: RGBA.fromInts(208, 208, 208),
  selectedTextColor: "white",
  showSelectionIndicator: false,
  options: tocMenuChildren,
  showDescription: false,
  height: "100%",
  marginTop: 1,
});
const tocBox = new BoxRenderable(renderer, {
  visible: false,
  zIndex: 10,
  flexDirection: "column",
  height: "100%",
  width: 40,
  flexShrink: 0,
  title: "Table of Contents",
  border: true,
  borderColor: "transparent",
  titleColor: "white",
  titleAlignment: "center",
  marginTop: 1,
});
tocBox.add(tocMenu);
root.add(tocBox);
//#endregion

const contentScrollBox = root.findDescendantById(
  "root-scrollbox",
) as ScrollBoxRenderable;

//#region sync toc and scrollbox
// when you scroll, this is the code that updates the toc with the heading
let lastScrollTop = contentScrollBox.scrollTop;
renderer.on("frame", () => {
  const scrollTop = contentScrollBox.scrollTop;
  if (scrollTop === lastScrollTop) return;
  syncToC();
  lastScrollTop = scrollTop;
});
function syncToC() {
  if (headingsArrayForToc.length === 0) return;
  if (
    contentScrollBox.scrollTop
    >= Math.max(
      0,
      contentScrollBox.scrollHeight - contentScrollBox.viewport.height,
    )
  ) {
    const lastIndex = headingsArrayForToc.length - 1;
    if (tocMenu.getSelectedIndex() !== lastIndex) {
      tocMenu.setSelectedIndex(lastIndex);
    }
    return;
  }
  let low = 0;
  let high = headingsArrayForToc.length - 1;
  let activeIndex = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const y = headingsArrayForToc[mid]?.renderable.screenY;
    if (y === undefined) return;
    if (y <= contentScrollBox.screenY) {
      activeIndex = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (tocMenu.getSelectedIndex() !== activeIndex) {
    tocMenu.setSelectedIndex(activeIndex);
  }
}
//#endregion
