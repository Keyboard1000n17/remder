// import {
//   Box,
//   createCliRenderer,
//   ScrollBox,
//   Text,
//   type ProxiedVNode,
// } from "@opentui/core";
// import chalk from "chalk";
// import got from "got";
// import stylize, { type ProcessedToken } from "./stylize";
// import parseInput from "./parse-input.ts";
// import { parseArgs } from "node:util";
//
// const args = parseArgs({
//   args: Bun.argv,
//   options: {
//     renderImages: {
//       type: "boolean",
//       default: true,
//     },
//     width: {
//       type: "string",
//       default: process.env.COLUMNS || "80",
//     },
//   },
//   allowPositionals: true,
//   allowNegative: true,
// });
//
// const renderedMarkdown = Text({
//   content: (await stylize(parseInput("**bold** *italic* test")))[0]?.content[0]
//     .content,
// });
//
// const renderer = await createCliRenderer({ exitOnCtrlC: true });
// renderer.root.add(ScrollBox({}, renderedMarkdown));
