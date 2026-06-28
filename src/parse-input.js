import MarkdownIt from "markdown-it";
import Footnotes from "markdown-it-footnote";
import GithubAlerts from "markdown-it-github-alerts";
import Tables from "markdown-it-table";
import TaskLists from "markdown-it-task-lists";

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
  const md = new MarkdownIt({
    langPrefix: "langauge-",
    html: true,
    linkify: true,
  });
  md.use(Footnotes);
  md.use(GithubAlerts);
  md.use(Tables);
  md.use(TaskLists);
  const modifiedInput = input.replaceAll(/<br( \/)?>/, "\n\n");
  const tokenized = md.parse(modifiedInput);
  const tokens = giveFields(tokenized);
  return tokens;
}
