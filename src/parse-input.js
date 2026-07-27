import MarkdownIt from "markdown-it";
import GithubAlerts from "markdown-it-github-alerts";
import { Parser } from "htmlparser2";
import Token from "markdown-it/lib/token.mjs";

const aliases = {
  p: "paragraph",
  b: "strong",
  i: "emph",
  em: "emph",
  var: "emph", // var is a valid tag in html apparently
  del: "s",
  a: "link",
};
let sanitizedText = "";
let isPreviousTagDisallowed = false;
const htmlToTokens = []; // the htmlParser pushes to this array
const blockHtmlTags = [
  "blockquote",
  "details",
  "div",
  "dl",
  "dd",
  "dt",
  "figure",
  "figcaption",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "ol",
  "ul",
  "li",
  "p",
  "pre",
  "summary",
  "table",
  "tbody",
  "tfoot",
  "thead",
  "tr",
  "td",
];

const htmlParser = new Parser({
  onopentag(name, attributes) {
    const openingToken = new Token("", name, 1);
    const isTagDisallowed = name.match(
      /title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext/,
    );
    // set the token type
    if (isTagDisallowed) {
      isPreviousTagDisallowed = true;
      sanitizedText += `<${name}>`;
    } else {
      isPreviousTagDisallowed = false;
      openingToken.type =
        name === "img" ? "image" : `${aliases[name] ?? name}_open`;
      // set the attributes
      if (attributes.length > 0) {
        for (const [key, value] of Object.entries(attributes)) {
          openingToken.attrSet(key, value);
        }
      }
      // if its an image token, add a kid with type = text to the children array
      if (name === "img") {
        const textToken = new Token("text", "", 0);
        textToken.content = attributes.alt;
        openingToken.content = attributes.alt; // markdown-it does this shit for some reason
        openingToken.children = [];
        openingToken.children.push(textToken);
      }
    }
    htmlToTokens.push(openingToken);
  },

  ontext(text) {
    if (isPreviousTagDisallowed) {
      sanitizedText += text;
      return;
    } else {
      const textToken = new Token("text", "", 0);
      textToken.content = text;
      htmlToTokens.push(textToken);
    }
  },

  onclosetag(name) {
    if (name === "img") {
      return;
    } else if (isPreviousTagDisallowed) {
      sanitizedText += `</${name}>`;
    } else {
      const closingToken = new Token(
        `${aliases[name] ?? name}_close`,
        name,
        -1,
      );
      htmlToTokens.push(closingToken);
    }
  },
});

function convertHtmlToMarkdownItTokens(token) {
  switch (token.type) {
    case "html_block": {
      htmlParser.write(token.content);
      const htmlTokens = htmlToTokens.splice(0);
      return htmlTokens;
    }
    case "inline": {
      const inlineTokens = [];
      for (const child of token.children) {
        const inlineToken = convertHtmlToMarkdownItTokens(child);
        inlineTokens.push(inlineToken);
      }
      return inlineTokens;
    }
    case "html_inline": {
      htmlParser.write(token.content);
      const htmlTokens = htmlToTokens.splice(0);
      return htmlTokens;
    }
    default: {
      return token;
      // note that here the token must be in token.children where token.type === "inline"
    }
  }
}

export default async function parse(input) {
  const md = new MarkdownIt({
    langPrefix: "langauge-",
    html: true,
    linkify: true,
  });
  md.use(GithubAlerts);
  md.core.ruler.after("inline", "processHTML", (state) => {
    const parsedTokens = [];
    for (let token of state.tokens) {
      if (token.type.match(/html|inline/)) {
        const convertedTokens = convertHtmlToMarkdownItTokens(token);
        parsedTokens.push(...convertedTokens);
      } else {
        parsedTokens.push(token);
      }
    }
    state.tokens = parsedTokens;
  });
  const modifiedInput = input.replaceAll(/<br( \/)?>/g, "\n\n");
  const tokens = md.parse(modifiedInput);
  return tokens;
}
