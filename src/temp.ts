import chalk from "chalk";
import {
  createColorPalette,
  parseAnsiSequences,
  type RgbColor,
} from "ansi-sequence-parser";
import {
  Box,
  createCliRenderer,
  createTextAttributes,
  RGBA,
  StyledText,
  Text,
  type TextChunk,
} from "@opentui/core";

const colorPalette = createColorPalette();

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
  return textChunks;
};

export const ansiToTextToken = (text: string) => {
  return Text({
    content: new StyledText(ansiToTextChunks(text)),
  });
};

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
});

renderer.root.add(
  Box(
    { padding: 2, backgroundColor: "#ccc" },
    ansiToTextToken(chalk.hex("#0f0")("foobarbaz")),
  ),
);
renderer.console.toggle();
