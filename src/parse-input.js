import MarkdownIt from "markdown-it";
import GithubAlerts from "markdown-it-github-alerts";
import TaskLists from "markdown-it-task-lists";
import { Parse } from "htmlparser2";
import Token from "markdown-it/lib/token.mjs";

const htmlParser = new Parse({
  onopentag(name, attributes) {
    const correspondingTagAndTokenNames = {
      p: "paragraph_open",
      b: "strong_open",
      strong: "strong_open",
      i: "emph_open",
      em: "emph_open",
      var: "emph_open", // var is a valid tag in html apparently
      s: "s_open",
      del: "s_open",
      img: "image",
    };
    const openingToken = new Token("", name, 1);
    // NOTE: move this disallowed tag thing to the markdown-it config
    const isTagDisallowed = name.match(
      /title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext/,
    );

    // set the token type
    if (
      !isTagDisallowed &&
      Object.values(correspondingTagAndTokenNames).includes(name)
    ) {
      openingToken.type = correspondingTagAndTokenNames[name];
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
        openingToken.children.push(textToken);
      }
    } else if (
      !isTagDisallowed &&
      !Object.values(correspondingTagAndTokenNames).includes(name)
    ) {
      openingToken.type = `${name}_open`;
    }
  },
});

export default async function parse(input) {
  const md = new MarkdownIt({
    langPrefix: "langauge-",
    html: true,
    linkify: true,
  });
  md.use(GithubAlerts);
  md.use(TaskLists);
  md.core.ruler.after("inline", "processHTML", (tokens) => {
    const parsedTokens = [];
  });
  const modifiedInput = input.replaceAll(/<br( \/)?>/g, "\n\n");
  const tokens = md.parse(modifiedInput);
  return tokens;
}
