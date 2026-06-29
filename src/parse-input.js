import MarkdownIt from "markdown-it";
import GithubAlerts from "markdown-it-github-alerts";
import TaskLists from "markdown-it-task-lists";

export default function parse(input) {
  const md = new MarkdownIt({
    langPrefix: "langauge-",
    html: true,
    linkify: true,
  });
  md.use(GithubAlerts);
  md.use(TaskLists);
  const modifiedInput = input.replaceAll(/<br( \/)?>/g, "\n\n");
  const tokens = md.parse(modifiedInput);
  return tokens;
}
