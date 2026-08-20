import { createCliRenderer } from "@opentui/core";
import chalk from "chalk";
import { GhosttyTerminalRenderable } from "ghostty-opentui/terminal-buffer";

const renderer = await createCliRenderer({
  consoleOptions: {
    startInDebugMode: true,
  },
});

const terminal = new GhosttyTerminalRenderable(renderer, {
  ansi: chalk.bgBlue("hi"),
});

renderer.root.add(terminal);
console.log(terminal);
// renderer.console.toggle();
