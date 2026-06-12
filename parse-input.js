export default async function parse(input) {
  const tokens = [];
  const toBeParsed = input.replaceAll("\u0000", "\ufffd");
  let index = 0;
  while (index < toBeParsed.length) {
    // block=level
    const remainingText = toBeParsed.slice(index);
    const afxHeading = remainingText.match(/^(#+) ([^\n]*)/);
    const setextHeadingLevel1 = remainingText.match(/^(.*)\n={3,}/);
    const setextHeadingLevel2 = remainingText.match(/^(.*)\n-{3,}/);
    const comment = remainingText.match(/^<!--.*-->/s);
    const codeBlock = remainingText.match(/^(```(.*)```)/s);
    const blockquote = remainingText.match(/^(\s{0,3}[^>]+)((>+)|(> )+)\s*([^\n]*)/);

    // inline
    const bold = remainingText.match(/^\*\*([^\*]*)\*\*/);
    const underline = remainingText.match(/^__([^_]*)__/);
    const italic = remainingText.match(/^[\*_]([^\*_]*)[\_*]/);
    const strikethrough = remainingText.match(/^(~{1,2})([^~]*)\1$/);
    const image = remainingText.match(/^!\[([^\]]*)\]\(.*\)/);
    const link = remainingText.match(/^\[([^\]]*)\]\(.*\)/);
    const code = remainingText.match(/^(`{1,2})([^`]*)\1$/);
    const plainText = remainingText.match(/^[^\*!_~`\[\]]+/);

    if (afxHeading) {
      tokens.push({ type: "afx-heading", text: afxHeading });
      index += afxHeading[0].length;
    } else if (setextHeadingLevel1) {
      tokens.push({
        type: "setext-leading-level-1",
        text: setextHeadingLevel1,
      });
      index += setextHeadingLevel1[0].length;
    } else if (setextHeadingLevel2) {
      tokens.push({
        type: "setext-leading-level-2",
        text: setextHeadingLevel2,
      });
      index += setextHeadingLevel2[0].length;
    } else if (comment) {
      // this will work! it's not supposed to push comments, that's just unnecessary
    } else if (bold) {
      tokens.push({ type: "bold", text: bold });
      index += bold[0].length;
    } else if (underline) {
      tokens.push({ type: "underline", text: underline });
      index += underline[0].length;
    } else if (italic) {
      tokens.push({ type: "italic", text: italic });
      index += italic[0].length;
    } else if (strikethrough) {
      tokens.push({ type: "strikethrough", text: strikethrough });
      index += strikethrough[0].length;
    } else if (blockquote) {
      tokens.push({ type: "blockquote", text: blockquote });
      index += blockquote[0].length;
    } else if (image) {
      tokens.push({ type: "image", text: image });
      index += image[0].length;
    } else if (link) {
      tokens.push({ type: "link", text: link });
      index += link[0].length;
    } else if (plainText) {
      tokens.push({ type: "plain-text", text: plainText });
      index += plainText[0].length;
    } else {
      throw new Error("YO DEV FIX YO DAMN CODE");
      console.log(`text for reference\n\n${toBeParsed}`);
    }
  }
  return tokens;
}
