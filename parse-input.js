export default async function parse(input) {
  const tokens = [];
  const inputBlocks = input.split("");

  for (let block of inputBlocks) {
    index = 0;
    blockArr = block.split("");
    while (index < block.length) {
      const afxHeading = blockArr.match(/^(#+) ([^\n]*)/);
      const setextHeadingLevel1 = blockArr.match(/^(.*)\n={3,}/);
      const setextHeadingLevel2 = blockArr.match(/^(.*)\n-{3,}/);
      const remainingText = blockArr.slice(index);
      const bold = remainingText.match(/^\*\*(.*)\*\*/);
      const italic = remainingText.match(/^[\*_](.*)[\_*]/);
      const strikethrough = remainingText.match(/^(~{1, 2})(.*)\1$/);
      const blockquote = remainingText.match(/^(\s{0,3}[^>]*)(>+)\s*([^\n]*)/);
      if (afxHeading) tokens.push({ type: "afx-heading", text: afxHeading });
      if (setextHeadingLevel1)
        tokens.push({
          type: "setext-leading-level-1",
          text: setextHeadingLevel1,
        });
      if (setextHeadingLevel2)
        tokens.push({
          type: "setext-leading-level-2",
          text: setextHeadingLevel2,
        });
      if (bold) tokens.push({ type: "bold", text: bold });
      if (italic) tokens.push({ type: "italic", text: italic });
      if (strikethrough)
        tokens.push({ type: "strikethrough", text: strikethrough });
      if (blockquote) tokens.push({ type: "blockquote", text: blockquote });
    }
  }
}
