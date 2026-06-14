export default async function parse(input) {
  const tokens = [];
  const toBeParsed = input.replaceAll("\u0000", "\ufffd");
  let index = 0;
  while (index < toBeParsed.length) {
    const remainingText = toBeParsed.slice(index);
    const matches = {
      // block-level
      afxHeading: /^(#+) ([^\n]+)/,
      htmlHeading: /^<(h[123456])>(.*?)<\/\1>/s,
      setextHeadingLevel1: /^([^\n]+)\n={3,}/,
      setextHeadingLevel2: /^([^\n]+)\n-{3,}/,
      comment: /^<!--.*-->/s,
      codeBlock: /^(```(.*)```)/s,
      htmlCodeBlock: /^<pre><code>(.*?)<\/pre><\/code>/s,
      blockquote: /^( {0,3})((?:>\s*)+)([^\n]*)/,
      htmlBlockquote: /^<blockquote>(.*?)<\/blockquote>/,
      hr: /^---\n/,
      htmlHr: /(<\/hr>)/,
      htmlDiv: /^<div(.*?)>(.*?)<\/div>/s,
      table: /^\|?(.*)\|?\n(\|?:?---+:?\|?)+(\|?(.*)\|?)+/,
      htmlTable: /^<table(.*?)>(.*)<\/table>/s,

      // inline
      bold: /^\*\*([^\*]+)\*\*/,
      htmlBold: /^(<(b|strong)(.*?)<\/\1>/s,
      underline: /^__([^_]*)__/,
      htmlUnderline: /^<(u)>(.*?)<\/u>/s,
      italic: /^([\*_])([^\*_]*)\1/,
      htmlItalic: /^<(i|em)>(.*?)<\/\1>/s,
      strikethrough: /^(~{1,2})([^~]*)\1/,
      htmlStrikethrough: /^<(s|del)>(.*?)<\/\1>/s,
      list: /^(\s*)[\*-]\s([^\n\*\->!_~`\[\]]+)/,
      htmlList: /^<ul>(<li>.*?<\/li>)+<\/ul>/s,
      numberedList: /^(\s*)(\d+)\. ([^\n\*\->!_~`\[\]])/,
      htmlNumberedList: /^<ol>(<li>.*?<\/li>)+<\/ol>/s,
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

    let textType;
    let content;

    for (let [i, expr] of Object.values(matches)) {
      if (remainingText.match(expr)) {
        textType = Object.keys(matches)[i];
        content = remainingText.match(expr);
        break;
      }
    }
    if (!/newline|comment/.test(textType))
      tokens.push({ type: textType, text: content });
    index += content[0].length;
  }
  return tokens;
}
