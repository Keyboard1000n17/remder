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
  type TextTableContent,
  ScrollBoxRenderable,
  type VChild,
} from "@opentui/core";
import { parseArgs } from "node:util";
import got from "got";
import chalk from "chalk";
import { readdir, stat } from "node:fs/promises";
import { createColorPalette, parseAnsiSequences } from "ansi-sequence-parser";

const tableCell = (text: string): TextChunk[] => [{ __isChunk: true, text }];
const ansiToTextToken = (text: string) => {
  const ansiTokens = parseAnsiSequences(text);
  const textChunks = ansiTokens.map((ansiToken): TextChunk => {
    return {
      __isChunk: true,
      text: ansiToken.value,
      fg: ansiToken.foreground
        ? "name" in ansiToken.foreground
          ? RGBA.fromHex(colorPalette.value(ansiToken.foreground))
          : "rgb" in ansiToken.foreground
            ? RGBA.fromValues(...ansiToken.foreground.rgb)
            : undefined
        : undefined,
      bg: ansiToken.background
        ? "name" in ansiToken.background
          ? RGBA.fromHex(colorPalette.value(ansiToken.background))
          : "rgb" in ansiToken.background
            ? RGBA.fromValues(...ansiToken.background.rgb)
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
  return Text({
    content: new StyledText(textChunks),
  });
};
const colorPalette = createColorPalette();

const args = parseArgs({
  options: {
    noRenderImages: {
      type: "boolean",
      default: true,
      short: "i",
    },
    width: {
      type: "string",
      default: process.stdout.columns?.toString() || "80",
      short: "w",
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
  const rows = [];
  if (!Array.isArray(tableToken.content))
    throw new Error(
      `Table token type is somehow ${typeof tableToken.content} instead of an array!`,
    );
  for (const row of tableToken.content) {
    const cells = [];
    if (!Array.isArray(row))
      throw new Error(
        `Table token type is somehow ${typeof row} instead of an array!`,
      );
    for (const cell of row) {
      if (cell.type !== "table-cell") {
        throw new Error(
          chalk.red.bold(`Cell type was ${cell.type} instead of "table-cell"!`),
        );
      }
      for (const item of cell.content) {
        let cellText = "";
        if (item.type === "text") {
          if (typeof item.content !== "string") {
            throw new Error(
              `The type of the table cell content was ${typeof item.content} instead of string!`,
            );
          }
          cellText += item.content;
        } else if (item.type === "image") {
          cellText += await item.content.render();
        } else {
          throw new Error(
            chalk.red.bold(
              `Type not recognized: expected "text" or "image" but got ${item.type}`,
            ),
          );
        }
        cells.push(tableCell(cellText));
      }
      rows.push(cells);
    }
  }
  // rows.forEach((cells) => cells.forEach((cell) => console.log(cell)));
  return rows;
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
            Text({
              content: token.content
                .trim()
                .split("\n")
                .map((line) => line.trim())
                .join("\n"),
            }),
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
          else if (
            element.type === "image" &&
            typeof element.content === "object" &&
            "imageAlt" in element.content
          ) {
            const image = element.content;
            tempComponentArray.push(
              args.values.noRenderImages
                ? ansiToTextToken(await image.render())
                : ansiToTextToken(chalk.gray(image.imageAlt)),
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
        if (
          typeof token.content === "string" ||
          !("headingTextArray" in token.content)
        )
          throw new Error("What?");
        const tokenContent: HeadingObject = token.content;
        const rows = tokenContent.headingTextArray;
        let start = 0;
        str += "\n";
        while (start < rows[0]!.length) {
          let end = start;
          let lineWidth = 0;
          while (
            end < rows[0]!.length &&
            lineWidth + rows[0]![end]!.length <= parseInt(args.values.width) - 2
          ) {
            lineWidth += rows[0]![end]!.length;
            end++;
          }
          for (const row of rows) {
            str += row.slice(start, end).join("");
            str += "\n";
          }
          str += "\n";
          start = end;
        }
        componentArray.push(Text({ content: str }));
        const ansiLinks = parseAnsiSequences(token.content.links);
        const linksArray: TextChunk[] = [];
        ansiLinks.forEach((ansiLink) =>
          linksArray.push({
            __isChunk: true,
            text: ansiLink.value,
            attributes: createTextAttributes({
              bold: ansiLink.decorations.has("bold"),
              italic: ansiLink.decorations.has("italic"),
              underline: ansiLink.decorations.has("underline"),
              dim: ansiLink.decorations.has("dim"),
              strikethrough: ansiLink.decorations.has("strikethrough"),
            }),
          }),
        );
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
            content: (await renderTable(token)) as TextTableContent,
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
          const listRenderables = await renderMarkdown(
            listItem.content as ProcessedToken[],
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
          const listRenderables = await renderMarkdown(
            listItem.content as ProcessedToken[],
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
      //#region default
      default:
        console.log("DEFAULT CASE:", token);
        const parsedAnsi = parseAnsiSequences(String(token.content));
        const textRenderables: TextChunk[] = [];
        parsedAnsi.forEach((ansiToken) =>
          textRenderables.push({
            __isChunk: true,
            text: ansiToken.value,
            fg: ansiToken.foreground
              ? "name" in ansiToken.foreground
                ? RGBA.fromHex(colorPalette.value(ansiToken.foreground))
                : "rgb" in ansiToken.foreground
                  ? RGBA.fromValues(...ansiToken.foreground.rgb)
                  : undefined
              : undefined,
            bg: ansiToken.background
              ? "name" in ansiToken.background
                ? RGBA.fromHex(colorPalette.value(ansiToken.background))
                : "rgb" in ansiToken.background
                  ? RGBA.fromValues(...ansiToken.background.rgb)
                  : undefined
              : undefined,
            attributes: createTextAttributes({
              bold: ansiToken.decorations.has("bold"),
              italic: ansiToken.decorations.has("italic"),
              underline: ansiToken.decorations.has("underline"),
              dim: ansiToken.decorations.has("dim"),
              strikethrough: ansiToken.decorations.has("strikethrough"),
            }),
          }),
        );
        componentArray.push(Text({ content: new StyledText(textRenderables) }));
      //#endregion
    }
    //#endregion
  }
  //#endregion
  return componentArray;
}

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

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  width: parseInt(args.values.width),
});

if (args.positionals.length > 0) {
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
    //#region tokensToString function
    // NOTE: chatgpt made a prototype of this
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
                ? chalk.dim(token.imageAlt)
                : await token.render();
            } else if (Array.isArray(token.content)) {
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
                  str += `${number}. ${await tokensToString(child.content as (ProcessedToken | Image)[])}\n`;
                  number++;
                }
                return str;
              } else if (token.type === "blockquote") {
                let str = "";
                for (const child of token.content) {
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
              const tokenContent: HeadingObject = token.content;
              const rows = tokenContent.headingTextArray;
              let start = 0;
              while (start < rows[0]!.length) {
                let end = start;
                let lineWidth = 0;
                while (
                  end < rows[0]!.length &&
                  lineWidth + rows[0]![end]!.length <=
                  parseInt(args.values.width) - 2
                ) {
                  lineWidth += rows[0]![end]!.length;
                  end++;
                }
                for (const row of rows) {
                  str += row.slice(start, end).join("");
                  str += "\n";
                }
                str += "\n";
                start = end;
              }
              str += ansiToTextToken(tokenContent.links);
              return str;
            }
            return "";
          }),
        )
      ).join("\n");
    }
    //#endregion
    const content = await tokensToString(tokens);
    console.log(
      Bun.wrapAnsi(content, parseInt(args.values.width), { trim: false }),
    );
    process.exit(0);
  } else {
    const renderables = await renderMarkdown(tokens as ProcessedToken[]);
    renderables.forEach((renderable) => (renderable.marginBottom = 1));
    const box = ScrollBox({}, renderables);
    box.focus();
    renderer.root.add(box);
  }
} else {
  menu.focus();
  renderer.root.add(menu);
  if (args.values.debug) renderer.console.toggle();
}
