import MarkdownIt from "markdown-it";
import GithubAlerts from "markdown-it-github-alerts";
import { Parser } from "htmlparser2";
import Token from "markdown-it/lib/token.mjs";
const aliases = {
  p: "paragraph",
  b: "strong",
  i: "em",
  var: "em", // var is a valid tag in html apparently
  del: "s",
  a: "link",
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  h5: "heading",
  h6: "heading",
};
const blockHtmlTags = new Set([
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
]);
let sanitizedText = "";
let isPreviousTagDisallowed = false;
const htmlToTokens = []; // the htmlParser pushes to this array

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
      if (Object.keys(attributes).length > 0) {
        openingToken.attrs = [];
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

      openingToken.block = blockHtmlTags.has(name);
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
      closingToken.block = blockHtmlTags.has(name);
      htmlToTokens.push(closingToken);
    }
  },
});

function convertHtmlToMarkdownItTokens(token) {
  switch (token.type) {
    case "html_block": {
      htmlParser.write(token.content);
      const htmlTokens = htmlToTokens.splice(0);
      const imageTokenIfPresent = htmlTokens.find(
        (token) => token.type === "image",
      );
      if (imageTokenIfPresent) {
        // if there's an image token, replace it with an inline token that
        // has the image token as a child
        const inlineToken = new Token("inline", "", 1);
        inlineToken.children = [];
        inlineToken.children.push(imageTokenIfPresent);
        const indexOfImageToken = htmlTokens.indexOf(imageTokenIfPresent);
        htmlTokens.splice(indexOfImageToken, 1, inlineToken);
      }
      return htmlTokens;
    }
    case "inline": {
      const inlineTokens = [];
      for (const child of token.children) {
        const inlineToken = convertHtmlToMarkdownItTokens(child);
        if (Array.isArray(inlineToken)) {
          inlineTokens.push(...inlineToken);
        } else {
          inlineTokens.push(inlineToken);
        }
      }
      token.children = inlineTokens;
      return token;
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
        if (Array.isArray(convertedTokens)) {
          parsedTokens.push(...convertedTokens);
        } else {
          parsedTokens.push(convertedTokens);
        }
      } else {
        parsedTokens.push(token);
      }
    }

    // here, we check for non-block elements at the top level.
    // if present, they get put into an inline token
    const inlineTokenList = [];
    const finalProcessedTokens = [];
    for (const parsedToken of parsedTokens) {
      if (parsedToken.block) {
        if (inlineTokenList.length > 0) {
          const inlineToken = new Token("inline", "", 1);
          inlineToken.block = true;
          const inlineTokens = inlineTokenList.splice(0); // this empties inlineTokenList
          inlineToken.children = inlineTokens;
          finalProcessedTokens.push(inlineToken);
        }
        finalProcessedTokens.push(parsedToken);
      } else if (!parsedToken.block) {
        inlineTokenList.push(parsedToken);
      }
    }
    // after this for loop, there might still be tokens in inlineTokenList
    if (inlineTokenList.length > 0) {
      const inlineToken = new Token("inline", "", 1);
      const inlineTokens = inlineTokenList.splice(0); // this empties inlineTokenList
      inlineToken.children = inlineTokens;
    }

    state.tokens = finalProcessedTokens;
  });
  const modifiedInput = input.replaceAll(/<br( \/)?>/g, "\n\n");
  const tokens = md.parse(modifiedInput);
  return tokens;
}
