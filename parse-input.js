export default async function parse(input) {
  const tokens = [];
  const splitInput = input.replaceAll("\u0000", "\ufffd").split("\n");
  const blockMatches = {
    afxHeading: /^\s{0,3}(#{1,6}) (.*?)( +#+\s*)?$/,
    setextHeadingLevel1: /^(.*?)(\n={3,})/,
    setextHeadingLevel2: /^(.*?)(\n-{3,})/,
    comment: /^<!--.*-->/s,
    codeBlock: /^(```(.*)```)/s,
    indentedCodeBlock: /^\n\s{4,}(.*?(?=\n\n|\n{0,3}))/,
    blockquote: /^( {0,3})((?:>\s*)+)([^\n]*)/,
    hr: /^([-\*_] *){3,}\s*\n/,
    table: /^\|?(.*)\|?\n(\|?:?---+:?\|?)+(\|?(.*)\|?)+/,
    list: /^(\s*)[\*\-\+]\s([^\n\*\->!_~`\[\]]+)/,
    numberedList: /^(\s*)(\d+)\. ([^\n\*\->!_~`\[\]])/,
    // htmlHeading: /^<(h[123456])>(.*?)<\/\1>/s,
    // htmlCodeBlock: /^<pre><code>(.*?)<\/pre><\/code>/s,
    // htmlBlockquote: /^<blockquote>(.*?)<\/blockquote>/,
    // htmlHr: /(<\/hr>)/,
    // htmlDiv: /^<div(.*?)>(.*?)<\/div>/s,
    // htmlTable: /^<table(.*?)>(.*)<\/table>/s,
    // htmlList: /^<ul>(<li>.*?<\/li>)+<\/ul>/s,
    // htmlNumberedList: /^<ol>(<li>.*?<\/li>)+<\/ol>/s,
  };
  const inlineMatches = {
    // inline
    bold: /^\*\*([^\*]+)\*\*/,
    htmlBold: /^<(b|strong)>(.*?)<\/\1>/s,
    underline: /^__([^_]*)__/,
    htmlUnderline: /^<(u)>(.*?)<\/u>/s,
    italic: /^([\*_])([^\*_]*)\1/,
    htmlItalic: /^<(i|em)>(.*?)<\/\1>/s,
    strikethrough: /^(~{1,2})([^~]*)\1/,
    htmlStrikethrough: /^<(s|del)>(.*?)<\/\1>/s,
    image: /^!\[([^\]]*)\]\(.*\)/,
    htmlImage: /^<img(.*?)\/?>/s,
    link: /^\[([^\]]*)\]\(.*\)/,
    htmlLink: /^<a(.*?)>(.*?)<\/a>/s,
    code: /^(`{1,2})(.*?)\1/,
    htmlCode: /^<code(.*?)>(.*?)<\/code>/s,
    plainText: /^[^\n\*\->!_~`\[\]]+/,
    htmlParagraph: /^<p(.*?)>(.*?)<\/p>/s,
    newline: /^\n+/,
  };

  let index = 0;

  while (index < splitInput.length) {
    let blockType;
    let content;
    const line = splitInput[index];

    const afxHeading = line.match(blockMatches.afxHeading);
    const thematicBreak = /^([-_\*]\s*){3,}$/.test(line);

    if (thematicBreak) {
      tokens.push({ type: "thematicBreak" });
    } else if (afxHeading) {
      tokens.push(
        { type: "heading-start", content: "" },
        { type: "text", content: afxHeading[2], level: afxHeading[1] },
        { type: "heading-end", content: "" },
      );
    } else if (line.match(/^\s{0,3}(?:>|\*|\+|-|_{3,}|\d+[\.)])/)) {
      // ignore for now because what the fuck? i think this should
      // be matched second-last, since the gfm spec states that if
      // the underline isn't there, it can only be interpreted as a
      // paragraph.
    }
    index++;
  }
  return tokens;
}
