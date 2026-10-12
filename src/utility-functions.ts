import {
  type TextChunk,
  TextAttributes,
  RGBA,
  type RenderContext,
  StyledText,
  TextRenderable,
  createTextAttributes,
} from "@opentui/core";
import chalk from "chalk";
import type { FontName } from "figlet";
import { type ProcessedToken } from "./stylize";
import { createColorPalette, parseAnsiSequences } from "ansi-sequence-parser";

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

export async function makeFigletFont(
  text: string,
  level: number,
  align: "left" | "center" | "right",
  termWidth: string,
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

export function makeTaskList(item: ProcessedToken) {
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

const rgbToRGBA = ([r, g, b]: [number, number, number]): [
  number,
  number,
  number,
] => [r / 255, g / 255, b / 255];

const colorPalette = createColorPalette();

export function ansiToTextChunks(text: string) {
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
}

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
