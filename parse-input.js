function gibIndent(text) {
  return text.match(/^(\s*)/)[1].length;
}

function blockState(state) {
  let cond;
  if (state === "list") cond = true;
}

export default async function parse(input) {
  const tokens = [];
  const splitInput = input
    .replaceAll("\u0000", "\ufffd")
    .split("\n\n")
    .forEach((e) => {
      e.split("\n");
    });

  let index = 0;

  while (index < splitInput.length) {
    // note to self:
    // here's the precedence of blocks:
    // 1. html blocks (types 1-5)
    // 2. fenced code blocks (the ones that go ```)
    // 3. atx headings
    // 4. thematic breaks (---)
    // 5. list items
    // 6. html blocks (types 6-7)
    // 7. indented code blocks
    // 8. paragraphs

    let blockType;
    let content;
    const block = splitInput[index];

    const fencedCodeBlock = /^[`~]{3}/.test(block);
    const afxHeading = line.match(/^\s{0,3}(#{1,6})\s(.*?)( +#+\s*)?$/);
    const thematicBreak = /^([-_\*]\s*){3,}$/.test(line);
    const commentStart = /^<!--/;
    const commentEnd = /^-->/;

    let type;
    let content;
    let extra;

    if (thematicBreak) {
      tokens.push({ type: "thematicBreak" });
    } else if (afxHeading) {
      tokens.push((type = `heading-level-${afxHeading[1].length}`));
    } else if (commentStart) {
      while (!splitInput[index].match(commentEnd)) {
        index++;
      }
    }

    // else if (line.match(/^\s{0,3}(?:>|\*|\+|-|_{3,}|\d+[\.)])/)) {
    // ignore for now because what the fuck? i think this should
    // be matched second-last, since the gfm spec states that if
    // the underline isn't there, it can only be interpreted as a
    // paragraph.
    index++;
  }
  return tokens;
}
