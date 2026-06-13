export default async function parse(input) {
  const tokens = [];
  const toBeParsed = input.replaceAll("\u0000", "\ufffd");
  let index = 0;
  while (index < toBeParsed.length) {
    // block-level
    const remainingText = toBeParsed.slice(index);
    const afxHeading = remainingText.match(/^(#+) ([^\n]+)/);
    const htmlHeading = remainingText.match(/^<(h[123456])>(.*?)<\/\1>/);
    const setextHeadingLevel1 = remainingText.match(/^([^\n]+)\n={3,}/);
    const setextHeadingLevel2 = remainingText.match(/^([^\n]+)\n-{3,}/);
    const comment = remainingText.match(/^<!--.*-->/s);
    const codeBlock = remainingText.match(/^(```(.*)```)/s);
    const blockquote = remainingText.match(/^( {0,3})((?:>\s*)+)([^\n]*)/);
    const hr = remainingText.match(/^---\n/);

    // inline
    const bold = remainingText.match(/^\*\*([^\*]+)\*\*/);
    const underline = remainingText.match(/^__([^_]*)__/);
    const italic = remainingText.match(/^([\*_])([^\*_]*)\1/);
    const strikethrough = remainingText.match(/^(~{1,2})([^~]*)\1/);
    const list = remainingText.match(/^(\s*)[\*-]\s([^\n\*\->!_~`\[\]]+)/);
    const image = remainingText.match(/^!\[([^\]]*)\]\(.*\)/);
    const link = remainingText.match(/^\[([^\]]*)\]\(.*\)/);
    const code = remainingText.match(/^(`{1,2})(.*?)\1/);
    const plainText = remainingText.match(/^[^\n\*\->!_~`\[\]]+/);
    const newline = remainingText.match(/^\n+/);

    let textType;
    let content;

    if (afxHeading) {
      textType = "afx-heading";
      content = afxHeading;
    } else if (setextHeadingLevel1) {
      textType = "setext-leading-level-1";
      content = setextHeadingLevel1;
    } else if (setextHeadingLevel2) {
      textType = "setext-leading-level-2";
      content = setextHeadingLevel2;
    } else if (comment) {
      textType = "comment";
      content = comment;
    } else if (codeBlock) {
      textType = "codeBlock";
      content = codeBlock;
    } else if (newline) {
      textType = "newline";
      content = newline;
    } else if (bold) {
      textType = "bold";
      content = bold;
    } else if (underline) {
      textType = "underline";
      content = underline;
    } else if (italic) {
      textType = "italic";
      content = italic;
    } else if (strikethrough) {
      textType = "strikethrough";
      content = strikethrough;
    } else if (blockquote) {
      textType = "blockquote";
      content = "blockquote";
    } else if (hr) {
      textType = "hr";
      content = hr;
    } else if (list) {
      textType = "list";
      content = list;
    } else if (image) {
      textType = "image";
      content = image;
    } else if (link) {
      textType = "link";
      content = link;
    } else if (code) {
      textType = "code";
      content = code;
    } else if (plainText) {
      textType = "plain-text";
      content = plainText;
    } else {
      console.log(`text for reference\n\n${remainingText}`);
      console.log("index", index);
      console.log(JSON.stringify(remainingText.slice(0, 50)));
      throw new Error("YO DEV FIX YO DAMN CODE");
    }
    tokens.push({ type: textType, text: content });
    index += content[0].length;
  }
  return tokens;
}
