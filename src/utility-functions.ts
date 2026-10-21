/*
 * these are utility functions we use in other files. they're useful
 * and help in readability of the code. the functions have comments
 * just before their declaration.
 * */
import {
  type TextChunk,
  TextAttributes,
  RGBA,
  type RenderContext,
  StyledText,
  TextRenderable,
  createTextAttributes,
  BoxRenderable,
} from "@opentui/core";
import chalk from "chalk";
import type { FontName } from "figlet";
import { type ProcessedToken } from "./stylize";
import { createColorPalette, parseAnsiSequences } from "ansi-sequence-parser";

/* self-explanatory function. it just aligns text in the terminal. this is used
 * for the --print-to-stdout option, not the interactive mode.
 */
export function alignText(
  text: string,
  align: "left" | "center" | "right",
  termWidth: string,
): string {
  const width = parseInt(termWidth);
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
}

/* this function converts opentui TextChunks to ANSI strings to use in
 * the --print-to-stdout option
 * */
export function chunksToAnsi(chunks: TextChunk[]) {
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
}

/*
 * this function turns a given string into a figlet text, and the font depends
 * on the heading level, which is from 1-6.
 * */
export async function makeFigletFont(
  text: string,
  level: number,
  align: "left" | "center" | "right",
  termWidth: string,
  ctx: RenderContext,
): Promise<BoxRenderable>;
export async function makeFigletFont(
  text: string,
  level: number,
  align: "left" | "center" | "right",
  termWidth: string,
): Promise<string>;
export async function makeFigletFont(
  text: string,
  level: number,
  align: "left" | "center" | "right",
  termWidth: string,
  ctx?: RenderContext,
) {
  const figlet = (await import("figlet")).default;
  figlet.defaults({
    fontPath: `${import.meta.dir}/fonts`,
  });
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
  if (ctx) {
    const textRenderables = text.split("").map(
      (char) =>
        new TextRenderable(ctx, {
          content: figlet.textSync(char, {
            font: fontsList[level],
          }),
        }),
    );
    const box = new BoxRenderable(ctx, { flexDirection: "row" });
    textRenderables.forEach((renderable) => box.add(renderable));
    return box;
  } else {
    return figlet
      .textSync(text.trim(), {
        font: fontsList[level],
        width: parseInt(termWidth),
        whitespaceBreak: true,
      })
      .split(/\n\s+\n/)
      .map((line) => alignText(line, align, termWidth))
      .join("\n\n");
  }
}

/*
 * this function goes through the children of a list item to check for
 * lines starting with `[ ]` or `[x]`, and if they are found, the text
 * is replaced, and a TextChunk is prepended to the token's content
 * chunks array with the appropiate hex codes and icon.
 * */
export function makeTaskList(item: ProcessedToken) {
  if (item.type !== "list_item") throw new Error("");
  const content: ProcessedToken[] = [];
  for (const child of item.content as ProcessedToken[]) {
    switch (child.type) {
      case "paragraph":
        child.content.forEach((text) => {
          if (text.type === "text") {
            const chunks = text.content.chunks;
            const startsWith = chunks[0]?.text.match(/^\[[ xX]\]\s*/);
            if (startsWith?.[0]) {
              chunks[0]!.text = chunks[0]!.text.replace(startsWith[0], " ");
              chunks.unshift({
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

const rgbToRGBA = ([r, g, b]: [number, number, number]): [
  number,
  number,
  number,
] => [r / 255, g / 255, b / 255];

const colorPalette = createColorPalette();

/*
 * this function converts ANSI strings into an array of opentui text chunks.
 * its not too complicated
 * */
export function ansiToTextChunks(text: string) {
  const ansiTokens = parseAnsiSequences(text);
  const textChunks = ansiTokens.map((ansiToken): TextChunk => {
    let fg: RGBA | undefined = undefined;
    if (ansiToken.foreground) {
      if ("name" in ansiToken.foreground) {
        fg = RGBA.fromHex(colorPalette.value(ansiToken.foreground));
      }
      if ("rgb" in ansiToken.foreground) {
        fg = RGBA.fromValues(...rgbToRGBA(ansiToken.foreground.rgb));
      }
    }
    let bg: RGBA | undefined = undefined;
    if (ansiToken.background) {
      if ("name" in ansiToken.background) {
        bg = RGBA.fromHex(colorPalette.value(ansiToken.background));
      }
      if ("rgb" in ansiToken.background) {
        bg = RGBA.fromValues(...rgbToRGBA(ansiToken.background.rgb));
      }
    }
    return {
      __isChunk: true,
      text: ansiToken.value,
      fg,
      bg,
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
}

/*
 * this function converts ansi strings to an opentui TextRenderable. it
 * makes use of the earlier ansiToTextChunks function to convert the text
 * to chunks
 * */
export function ansiToTextToken(text: string, ctx: RenderContext, id?: string) {
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
}
