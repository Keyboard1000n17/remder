import parseInput from "./parse-input.ts";
import stylize from "./stylize.ts";
import {
  createCliRenderer,
  Box,
  Text,
  type ProxiedVNode,
  Select,
} from "@opentui/core";
import { parseArgs } from "node:util";
import got from "got";
import { Chalk } from "chalk";
import * as fs from "node:fs/promises";

const chalk = new Chalk();

const args = parseArgs({
  args: Bun.argv,
  options: {
    renderImages: {
      type: "boolean",
      default: true,
    },
  },
  allowPositionals: true,
  allowNegative: true,
});

const componentArray: ProxiedVNode<any>[] = [];
const filePath = args.positionals.at(-1);
let fileContent = "";

if (args.positionals.length > 2 && filePath) {
  if (URL.canParse(filePath)) {
    fileContent = await got(filePath).text();
  } else {
    try {
      fileContent = await Bun.file(filePath).text();
    } catch (err) {
      throw new Error(chalk.red(`Encountered an error: ${err}`));
    }
  }
}
const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  screenMode: "split-footer",
  footerHeight: 1,
});

if (fileContent.length > 0) {
  const tokens = await stylize(parseInput(fileContent));
  for (const token of tokens) {
    switch (token.type) {
      case "paragraph":
        componentArray.push(Box({}, Text({ content: token.content })));
        break;
      default:
        componentArray.push(Box({}, Text({ content: token.content })));
    }
  }
} else {
  const fileNames = (
    await fs.readdir(".", { recursive: true, withFileTypes: true })
  )
    .filter((file) => file.isFile() && file.name.endsWith(".md"))
    .map((file) => [file.parentPath, file.name].join("/"));
  const optionsArray = [];
  for (const file of fileNames) {
    let birthTime = "";
    try {
      birthTime = new Date((await fs.stat(file)).birthtime).toDateString();
    } catch (err) {
      continue;
    }
    optionsArray.push({
      name: file,
      description: `Created at: ${birthTime}`,
    });
  }
  const menu = Select({
    options: [{ name: "foo", description: "bar" }, ...optionsArray],
    width: "100%",
    height: "100%",
    focusedBackgroundColor: "transparent",
    selectedBackgroundColor: "#181825",
    selectedTextColor: "#cdd6f4",
  });
  menu.focus();
  renderer.root.add(menu);
}
