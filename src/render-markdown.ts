import {
  type RenderContext,
  Renderable,
  TextRenderable,
  BoxRenderable,
  StyledText,
  RGBA,
  Box,
  Text,
  KeyEvent,
  RenderableEvents,
  type BorderSides,
} from "@opentui/core";
import chalk from "chalk";
import type { ProcessedToken, HeadingObject } from "./stylize";
import {
  ansiToTextToken,
  makeFigletFont,
  makeTaskList,
  ansiToTextChunks,
} from "./utility-functions";

const headingIndexes = [0, 0, 0, 0, 0, 0];
export const headingsArrayForToc: {
  text: string;
  level: number;
  id: string;
  renderable: Renderable;
}[] = []; // holds an array of all the headings in the document

export const detailsElementsArray: Renderable[] = [];

async function renderTable(
  ctx: RenderContext,
  tableToken: ProcessedToken,
  noRenderImages: boolean,
) {
  if (tableToken.type !== "table")
    throw new Error(
      `Table token type is somehow ${typeof tableToken.content} instead of an array!`,
    );
  const table = new BoxRenderable(ctx, {
    width: "100%",
    maxWidth: ctx.width - 3,
    gap: 0,
  });
  const columnCount = Math.max(...tableToken.content.map((arr) => arr.length));
  const maxCellWidth = Math.floor(((ctx.width ?? 80) - 3) / columnCount);
  const minWidth = 4;
  const cellContentWidths: number[] = await Promise.all(
    tableToken.content.flatMap((row) =>
      row.map(async (cell) => {
        const widths = await Promise.all(
          cell.content.map(async (token) => {
            if (token.type === "text") {
              return Bun.stringWidth(token.content.chunks.map((chunk) => chunk.text).join(""));
            }
            if (token.type === "image") {
              const buf = await token.content.imageBuffer;
              if (!buf) return minWidth;
              const { width, cellWidth: columnWidth } = await token.content.getImageSize(
                buf,
                Math.max(1, maxCellWidth - 1),
                cell.content.length > 1,
                ctx,
              );
              return width / columnWidth + 2;
            }
            return minWidth;
          }),
        );
        return Math.max(...widths);
      }),
    ),
  );
  const maxCellContentWidth = Math.max(4, Math.max(...cellContentWidths) + 3);
  let cellWidth = Math.min(maxCellWidth, maxCellContentWidth);
  console.log({
    maxCellWidth,
    maxCellContentWidth,
    cellWidth,
  });
  for (let rowIndex = 0; rowIndex < tableToken.content.length; rowIndex++) {
    // this style of loop is used over `for (const row of tableToken.content)`
    // because rowIndex is used repeatedly and this is much more convenient
    // and i don't have to figure out anything
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
        padding: 1,
        customBorderChars: {
          topLeft: isFirstRow && isFirstColumn ? "╭" : "┼",
          topRight: isFirstRow ? (isLastColumn ? "╮" : "┬") : "┼",
          bottomLeft: isLastRow ? "╰" : "├",
          bottomRight: isLastRow ? (isLastColumn ? "╯" : "┴") : isLastColumn ? "┤" : "┼",
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
          cellRenderable.add(
            new TextRenderable(ctx, {
              content: item.content,
              textAlign:
                cell.properties.textAlign === "flex-start"
                  ? "left"
                  : cell.properties.textAlign === "flex-end"
                    ? "right"
                    : "center",
            }),
          );
        } else if (item.type === "image") {
          if (noRenderImages) {
            cellRenderable.add(
              new TextRenderable(ctx, {
                content: item.content.imageAlt,
                fg: "gray",
              }),
            );
            continue;
          }
          cellRenderable.add(
            item.content.load(
              ctx,
              Math.max(1, cellWidth - (isFirstColumn ? 2 : 1)),
              cell.content.length > 1,
            ),
          );
        } else {
          throw new Error(`Type not recognized: expected "text" or "image" but got ${item.type}`);
        }
      }
      rowRenderable.add(cellRenderable);
    }
    table.add(rowRenderable);
    table
      .getChildren()
      .forEach((row) => row.getChildren().forEach((cell) => (cell.width = cellWidth)));
  }
  return table;
}

export async function renderMarkdown(
  tokens: ProcessedToken[],
  ctx: RenderContext,
  languageToNerdFontIconMap: { default: string;[value: string]: string },
  noRenderHeadings: boolean,
  noRenderImages: boolean,
  width: string,
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
            textAlign: token.properties.align ?? "left",
          }),
        );
        console.log(`textAlign: ${token.properties.align ?? "left"}`);
        break;
      case "image":
        const image = token.content;
        const imageBox = new BoxRenderable(ctx, {});
        imageBox.add(
          noRenderImages
            ? ansiToTextToken(chalk.gray(image.imageAlt), ctx)
            : image.load(ctx, ctx.width - 2, false),
        );
        componentArray.push(imageBox);
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
              noRenderImages
                ? ansiToTextToken(chalk.gray(image.imageAlt), ctx)
                : image.load(
                  ctx,
                  ctx.width - 2,
                  content.length > 1, // this argument is a boolean!
                ),
            );
          } else if (element.type === "text") {
            paragraphBox.add(new TextRenderable(ctx, { content: element.content }));
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

        if (noRenderHeadings) {
          const colorMap: Record<number, (str: string) => StyledText> = {
            1: (str: string) =>
              new StyledText([{ __isChunk: true, text: str, fg: RGBA.fromHex("#ffa50a") }]),
            2: (str: string) =>
              new StyledText([{ __isChunk: true, text: str, fg: RGBA.fromHex("#eeee00") }]),
            3: (str: string) =>
              new StyledText([{ __isChunk: true, text: str, fg: RGBA.fromHex("#0acadd") }]),
            4: (str: string) =>
              new StyledText([{ __isChunk: true, text: str, fg: RGBA.fromHex("#ffa5a5") }]),
            5: (str: string) =>
              new StyledText([{ __isChunk: true, text: str, fg: RGBA.fromHex("#22ff22") }]),
            6: (str: string) =>
              new StyledText([{ __isChunk: true, text: str, fg: RGBA.fromHex("#aaaaaa") }]),
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
            id: headingId,
            content: str,
            alignSelf: token.properties.align ?? "left",
          });
          componentArray.push(heading);
          console.log({
            headingText: heading.content.chunks.map((chunk) => chunk.text).join(),
            headingHeight: heading.height,
          });
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
          await makeFigletFont(tokenContent.text, tokenContent.level, "left", width, ctx),
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
        componentArray.push(await renderTable(ctx, token, noRenderImages));
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
          const listRenderables = await renderMarkdown(
            listContent,
            ctx,
            languageToNerdFontIconMap,
            noRenderHeadings,
            noRenderImages,
            width,
          );
          listRenderables.forEach((listRenderable, index) => {
            if (index > 0) listRenderable.marginTop = 1;
            bulletListbox.add(
              Box(
                {
                  flexDirection: "row",
                  gap: 1,
                },
                Text({ content: index === 0 ? bp : " " }),
                Box({}, listRenderable),
              ),
            );
          });
        }
        componentArray.push(bulletListbox);
        break;
      //#endregion
      //#region ordered list
      case "ordered_list":
        let number = token.properties.start || 1;
        const initialNumber = number;
        const orderedListBox = new BoxRenderable(ctx, {
          alignSelf: token.properties.align ?? "left",
          alignItems: token.properties.align ?? "left",
        });
        for (const listItem of token.content as ProcessedToken[]) {
          if (listItem.type !== "list_item")
            throw new Error(`Expected type "list_item" but got ${listItem.type}`);
          const transformedListItem = makeTaskList(listItem);
          const listContent = transformedListItem.content;
          const listRenderables = await renderMarkdown(
            listContent,
            ctx,
            languageToNerdFontIconMap,
            noRenderHeadings,
            noRenderImages,
            width,
          );
          const markerWidth = listRenderables.length + initialNumber - 1;
          listRenderables.forEach((listRenderable, index) => {
            orderedListBox.add(
              Box(
                {
                  flexDirection: "row",
                  gap: 1,
                },
                Text({
                  content: index === 0 ? `${String(number).padStart(markerWidth)}.` : " ",
                }),
                Box({}, listRenderable),
              ),
            );
            number++;
          });
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
          token.content,
          ctx,
          languageToNerdFontIconMap,
          noRenderHeadings,
          noRenderImages,
          width,
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
        const alertIcons: Record<string, { icon: string; color: string; name: string }> = {
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
        (
          await renderMarkdown(
            token.content,
            ctx,
            languageToNerdFontIconMap,
            noRenderHeadings,
            noRenderImages,
            width,
          )
        ).forEach((renderable) => alertBox.add(renderable));
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
        const icon = languageToNerdFontIconMap[language] ?? languageToNerdFontIconMap.default;
        const box = new BoxRenderable(ctx, {
          paddingLeft: 2,
          paddingRight: 2,
          paddingTop: 1,
          marginLeft: 1,
          rowGap: 1,
          backgroundColor: "#222",
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
          alignSelf: token.properties.align || "left",
          alignItems: token.properties.align || "left",
        });
        console.log(`div align: ${token.properties.align || "left"}`);
        const divBoxRenderables = await renderMarkdown(
          token.content,
          ctx,
          languageToNerdFontIconMap,
          noRenderHeadings,
          noRenderImages,
          width,
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
          (
            await renderMarkdown(
              summaryToken.content,
              ctx,
              languageToNerdFontIconMap,
              noRenderHeadings,
              noRenderImages,
              width,
            )
          ).forEach((renderable) => summaryText.add(renderable));
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
            languageToNerdFontIconMap,
            noRenderHeadings,
            noRenderImages,
            width,
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
          const detailsElementsArray = summaryBox.findDescendantById(
            `details-element-${detailsId}`,
          );
          if (detailsElementsArray) detailsElementsArray.visible = !detailsElementsArray.visible;
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
      //#region horizontal rule
      case "thematic-break":
        componentArray.push(
          new BoxRenderable(ctx, {
            width: "100%",
            height: 1,
            border: ["bottom"],
          }),
        );
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

export function resetDocumentState() {
  headingsArrayForToc.length = 0;
  detailsElementsArray.length = 0;
  headingIndexes.fill(0);
}
