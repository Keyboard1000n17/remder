import MarkdownIt from "markdown-it";
import GithubAlerts from "markdown-it-github-alerts";
import { Parser } from "htmlparser2";
import Token from "markdown-it/lib/token.mjs";

const aliases = new Map(
  Object.entries({
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
    ul: "bullet_list",
    ol: "ordered_list",
    li: "list_item",
    u: "ins",
    img: "image",
  }),
);
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
  "th",
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
      openingToken.type = name === `${aliases.get(name) ?? name}_open`;
      // set the attributes
      if (Object.keys(attributes).length > 0) {
        openingToken.attrs = [];
        for (const [key, value] of Object.entries(attributes)) {
          openingToken.attrSet(key, value);
        }
      }

      openingToken.block = blockHtmlTags.has(name);
    }
    htmlToTokens.push(openingToken);
  },

  ontext(text) {
    if (isPreviousTagDisallowed) {
      sanitizedText += text;
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
        `${aliases.get(name) ?? name}_close`,
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

export default function parse(input) {
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
    // we also set the token.level here
    const inlineTokenList = [];
    let level = 0;
    const finalProcessedTokens = [];
    for (let i = 0; i < parsedTokens.length; i++) {
      const parsedToken = parsedTokens[i];
      if (parsedToken.nesting === -1) level--;
      parsedToken.level = level;
      if (parsedToken.nesting === 1) level++;
      if (parsedToken.block) {
        if (inlineTokenList.length > 0) {
          const inlineToken = new Token("inline", "", 0);
          inlineToken.block = true;
          const codeTokenIndex = inlineTokenList.findIndex(
            (token) => token.type === "code_open",
          );
          if (
            codeTokenIndex !== -1 &&
            inlineTokenList[codeTokenIndex + 1].type === "text" &&
            inlineTokenList[codeTokenIndex + 2].type === "code_close"
          ) {
            const codeToken = new Token("code_inline", "code", 0);
            codeToken.content = inlineTokenList[codeTokenIndex + 1].content;
            codeToken.block = false;
            inlineTokenList.splice(codeTokenIndex, 3, codeToken);
          } // this ugly thing replaces a sequence of [code_open, text, code_close] with a single `code_inline element`
          inlineToken.children = inlineTokenList.splice(0); // this empties inlineTokenList
          inlineToken.level = inlineToken.children[0].level;
          finalProcessedTokens.push(inlineToken);
        }
        finalProcessedTokens.push(parsedToken);
      } else if (!parsedToken.block) {
        inlineTokenList.push(parsedToken);
      }
    }
    // just in case if inlineTokenList isn't empty
    if (inlineTokenList.length > 0) {
      const inlineToken = new Token("inline", "", 0);
      inlineToken.block = true;
      inlineToken.children = inlineTokenList.splice(0); // this empties inlineTokenList
      inlineToken.level = inlineToken.children[0].level;
      finalProcessedTokens.push(inlineToken);
    }

    state.tokens = finalProcessedTokens;
  });
  const modifiedInput = input.replaceAll(/<br( \/)?>/g, "\n\n");
  const tokens = md.parse(modifiedInput, {});
  return tokens;
}
