import MarkdownIt from "markdown-it";

function giveFields(obj) {
  const fields = obj.map((token) => {
    const toReturn = {
      type: token.type,
      tag: token.tag,
      nesting: token.nesting,
      content: token.content,
      children: token.children,
      info: token.info,
    };
    if (token.children) toReturn.children = giveFields(token.children);
    return toReturn;
  });

  return fields;
}

export default async function parse(input) {
  const md = new MarkdownIt();
  const tokenized = md.parse(input);
  const tokens = giveFields(tokenized);
  return tokens;
}
