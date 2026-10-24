import { type HeadingObject, type ProcessedToken } from "./stylize";
import {
  chunksToAnsi,
  makeTaskList,
  alignText,
  makeFigletFont,
} from "./utility-functions";

export default async function tokensToString(
  tokens: ProcessedToken[],
  termWidth: string,
  noRenderHeadings: boolean,
  languageToNerdFontIconMap: { default: string;[value: string]: string },
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
              const initBuf = await image.imageBuffer;
              let buf;
              if (!initBuf) {
                paragraphItems.push(chalk.gray(image.imageAlt));
                continue;
              }
              if (image.path.endsWith(".svg")) {
                const Resvg = (await import("@resvg/resvg-js")).Resvg;
                buf = new Resvg(Buffer.from(initBuf)).render().asPng();
              } else if (image.path.endsWith(".webp")) {
                buf = await new Bun.Image(initBuf).png().bytes();
              }
              if (!buf) continue;
              paragraphItems.push(
                await terminalImage.buffer(buf, {
                  preferNativeRender: !/^xterm$|^tmux|^screen/.test(
                    process.env.TERM || "",
                  ),
                }),
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
        if (noRenderHeadings) {
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
          const heading = alignText(
            str,
            token.properties.align ?? "left",
            termWidth,
          );
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
          termWidth,
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
                row.map(
                  async (cell) =>
                    await tokensToString(
                      cell.content,
                      termWidth,
                      noRenderHeadings,
                      languageToNerdFontIconMap,
                    ),
                ),
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
            termWidth,
            noRenderHeadings,
            languageToNerdFontIconMap,
            indent + 2,
          );
          bulletListItems.push(
            renderedListContent
              .split("\n")
              .map((line, index) => {
                return index === 0
                  ? `${" ".repeat(indent)}${bp} ${line}`
                  : `${" ".repeat(indent)}  ${line}`;
              })
              .join("\n"),
          );
        }
        contentStrings.push(bulletListItems.join("\n"));
        break;
      //#endregion
      //#region ordered list
      case "ordered_list":
        let number = parseInt(token.properties.start) || 1;
        const orderedListMarkerWidth = String(token.content.length - 1).length;
        const orderedListItems: string[] = [];
        for (const listItem of token.content) {
          const transformedListItem = makeTaskList(listItem);
          const renderedListContent = await tokensToString(
            transformedListItem.content,
            termWidth,
            noRenderHeadings,
            languageToNerdFontIconMap,
            indent + 2,
          );
          orderedListItems.push(
            renderedListContent
              .split("\n")
              .map((line, index) =>
                index === 0
                  ? `${" ".repeat(indent)}${String(number++).padStart(orderedListMarkerWidth)}. ${line}`
                  : `${" ".repeat(indent)}${line}`,
              )
              .join("\n"),
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
          termWidth,
          noRenderHeadings,
          languageToNerdFontIconMap,
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
          termWidth,
          noRenderHeadings,
          languageToNerdFontIconMap,
        );
        const uhb = chalk.hex(alertIconAndColor!.color)("\u258c"); // unicode left half block
        contentStrings.push(
          uhb
          + chalk.hex(alertIconAndColor!.color)(
            ` ${alertIconAndColor!.icon} ${alertIconAndColor!.name}`,
          )
          + `\n${uhb}\n`
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
        const codeTokenContent = token.content;
        const language = codeTokenContent.language;
        const icon =
          languageToNerdFontIconMap[language]
          ?? languageToNerdFontIconMap.default;
        const languageLine = `  ${icon} ${language} `;
        const boxWidth = Math.min(
          Math.max(
            ...codeTokenContent.code
              .split("\n")
              .map((line) => Bun.stringWidth(line)),
            Bun.stringWidth(languageLine),
          ) + 4,
          parseInt(termWidth) - 2,
        );
        const emptyLine = " ".repeat(boxWidth);
        const code = codeTokenContent.code
          .trim()
          .split("\n")
          .map(
            (line) =>
              "  "
              + line
              + " ".repeat(boxWidth - Math.max(Bun.stringWidth(line), 0) - 2),
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
        contentStrings.push(
          await tokensToString(
            token.content,
            termWidth,
            noRenderHeadings,
            languageToNerdFontIconMap,
          ),
        );
        break;
      //#endregion
      //#region details
      case "details":
        const detailsContent = token.content;
        const summaryToken = detailsContent.find((t) => t.type === "summary");
        const detailsToken = detailsContent.find((t) => t.type === "content");
        contentStrings.push(
          "\u25bc "
          + (await tokensToString(
            summaryToken!.content,
            termWidth,
            noRenderHeadings,
            languageToNerdFontIconMap,
          )),
        );
        contentStrings.push(
          await tokensToString(
            detailsToken!.content,
            termWidth,
            noRenderHeadings,
            languageToNerdFontIconMap,
          ),
        );
        break;
      //#endregion
      //#region horizontal rule
      case "thematic-break":
        contentStrings.push("─".repeat(Number(termWidth) - 2));
        break;
      //#region default
      default:
        console.warn("DEFAULT CASE:", token);
        console.warn("args in current renderMarkdown() call:", tokens.length);
      //#endregion
    }
    //#endregion
  }
  return contentStrings.join("\n\n");
}
