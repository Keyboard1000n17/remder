//#region args
import { parseArgs } from "node:util";

const args = parseArgs({
  options: {
    noRenderImages: {
      type: "boolean",
      default: false,
      short: "i",
    },
    noRenderHeadings: {
      type: "boolean",
      default: false,
      short: "H",
    },
    width: {
      type: "string",
      default: process.stdout.columns?.toString() || "80",
      short: "w",
    },
    height: {
      type: "string",
      default: process.stdout.rows?.toString() || "25",
      short: "y",
    },
    printToStdout: {
      type: "boolean",
      default: false,
      short: "o",
    },
    debug: {
      type: "boolean",
      default: false,
      short: "d",
    },
    help: {
      type: "boolean",
      default: false,
      short: "h",
    },
  },
  allowPositionals: true,
});
//#endregion

//#region help
if (args.values.help) {
  const options = [
    ["-h, --help", "Print this help message and exit"],
    ["-d, --debug", "Enable debug mode (enables console)"],
    ["-i, --no-render-images", "Disable rendering images"],
    [
      "-H, --no-render-headings",
      "Render headings with color instead of huge text",
    ],
    ["-w, --width <width>", "Set the TUI width"],
    ["-y, --height <height>", "Set the TUI height"],
  ];
  const optionWidth = Math.max(...options.map(([option]) => option!.length));
  const helpText = [
    "Usage: remder [options] <file?>",
    ...options.map(
      ([option, description]) =>
        `  ${option!.padEnd(optionWidth + 2)}${description}`,
    ),
  ].join("\n");
  console.log(helpText);
  process.exit(0);
}
//#endregion

//#region icon map
const languageToNerdFontIconMap: { [value: string]: string; default: string } =
{
  "angular-html": "\ued4b",
  "angular-ts": "\ued4b",
  apache: "\ue72b",
  apex: "\ue8f5",
  apl: "\ue730",
  applescript: "\ue711",
  asm: "\ue6ab",
  astro: "\ue6b3",
  awk: "\ue741",
  ballerina: "\ue75e",
  bat: "\uebc4",
  c: "\ue61e",
  cairo: "\ue773",
  clarity: "\ue78d",
  clojure: "\ue768",
  cmake: "\ue794",
  cobol: "\ue900",
  coffeescript: "\ue751",
  "common-lisp": "\ue6b0",
  cpp: "\ue61d",
  crystal: "\ue7ac",
  csharp: "\ue7b2",
  css: "\ue749",
  csv: "\ueefc",
  d: "\ue7af",
  dart: "\ue798",
  default: "\ueac4",
  desktop: "\uf108",
  diff: "\ue702", // git diffs
  dockerfile: "\ue7b0",
  dotenv: "\ueba3",
  elixir: "\ue62d",
  elm: "\ue7ce",
  "emacs-lisp": "\ue632",
  erb: "\uf33a",
  erlang: "\ue7b1",
  fennel: "\ue6af",
  fish: "\uf1af",
  "git-commit": "\ue702",
  "git-rebase": "\ue702",
  gleam: "\ue914",
  gn: "\ueadd",
  go: "\ueb93",
  graphql: "\ue8f6",
  groovy: "\ue775",
  hack: "\uf1d4",
  handlebars: "\ue7f7",
  haskell: "\ue777",
  haxe: "\ue7fa",
  html: "\ue736",
  hy: "\uebb9",
  ini: "\ueaba",
  java: "\ue738",
  javascript: "\ue781",
  jinja: "\ue66f",
  json: "\ueb0f",
  jsx: "\ue61b",
  julia: "\ue80d",
  just: "\uebf0",
  kotlin: "\ue634",
  latex: "\ue81f",
  less: "\ue758",
  liquid: "\uf1826",
  logo: "\uf0343",
  lua: "\ue826",
  makefile: "\ue673",
  markdown: "\ueb1d",
  matlab: "\ue82a",
  move: "\ueadf",
  nginx: "\ue776",
  nim: "\ueaba",
  nix: "\ue843",
  ocaml: "\ue84e",
  openscad: "\uf34e",
  perl: "\ue769",
  php: "\ue77a",
  polar: "\uf041e",
  postcss: "\ue86a",
  powershell: "\uebc7",
  prisma: "\ue86e",
  prolog: "\ue7a1",
  pug: "\ue938",
  puppet: "\ue631",
  purescript: "\ue630",
  python: "\uec39",
  r: "\uea97",
  racket: "\uebe5",
  rel: "\ueb58",
  ron: "\ueab4",
  ruby: "\ueb48",
  rust: "\ue68b",
  sas: "\ue74b",
  sass: "\ue74b",
  scala: "\ue737",
  scheme: "\ue6b1",
  shell: "\uebc7",
  solidity: "\ue8a6",
  sql: "\ue75b",
  stata: "\ue8b2",
  stylus: "\ue759",
  svelte: "\ue8b7",
  swift: "\ue755",
  templ: "\uebbf",
  terraform: "\ue8bd",
  tex: "\uec5e",
  toml: "\ue6b2",
  turtle: "\uf0cd7",
  twig: "\ue61c",
  "ts-tags": "\ue8ca",
  typescript: "\ue8ca",
  typst: "\uf37f",
  v: "\uea97",
  vala: "\ue8d1",
  vim: "\ue6ae",
  vue: "\ue8dc",
  "vue-html": "\ue8dc",
  "vue-vine": "\ue8dc",
  vyper: "\ue8df",
  wolfram: "\ue956",
  xml: "\ue8ea",
  yaml: "\ue8eb",
  zig: "\ue8ef",
};
//#endregion

//#region --print-to-stdout option
// NOTE: chatgpt made a prototype of this
if (args.values.printToStdout) {
  const tokensToString = (await import("./tokens-to-string")).default;
  if (!process.stdin.isTTY) {
    const md = await Bun.stdin.text();
    const tokens = await stylize(parseInput(md), "");
    const content = await tokensToString(
      tokens,
      args.values.width,
      args.values.noRenderHeadings,
      languageToNerdFontIconMap,
    );
    process.stdout.write(
      Bun.wrapAnsi(content, parseInt(args.values.width), { trim: false }),
    );
    process.exit(0);
  } else {
    const path = args.positionals.at(-1);
    if (!path)
      throw new Error(
        "No path specified; specify a file with the syntax `remder <options> <path>",
      );
    const content = URL.canParse(path)
      ? await got(path).text()
      : await Bun.file(path).text();
    const processedContent = await tokensToString(
      await stylize(parseInput(content), path),
      args.values.width,
      args.values.noRenderHeadings,
      languageToNerdFontIconMap,
    );
    process.stdout.write(
      Bun.wrapAnsi(processedContent, parseInt(args.values.width), {
        trim: false,
      }),
    );
    process.exit(0);
  }
}
//#endregion

//#region imports
import { flushLogBuffer } from "./stylize.js";
import {
  createCliRenderer,
  Box,
  Text,
  RGBA,
  createTextAttributes,
  StyledText,
  type BoxOptions,
  BoxRenderable,
  type TextOptions,
  ScrollBoxRenderable,
  SelectRenderable,
  TextRenderable,
  SelectRenderableEvents,
  type SelectOption,
  InputRenderable,
  InputRenderableEvents,
} from "@opentui/core";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import fuzzysort from "fuzzysort";
import { stat, glob } from "node:fs/promises";
import { closeSync, openSync } from "node:fs";
import { makeFigletFont } from "./utility-functions";
import {
  renderMarkdown,
  headingsArrayForToc,
  detailsElementsArray,
  resetDocumentState,
} from "./render-markdown";
import parseInput from "./parse-input.js";
import stylize from "./stylize.js";
import got from "got";

//#endregion

let headingIndexForToc = 0;
let detailsElementsIndex: number | null = null;

//#region handle stdin
// NOTE: chatgpt generated this part of the code, i can not be bothered to deal
// with a bug in bun that has a pr waiting since june 12 2026
// (oven-sh/bun#32153) (https://github.com/oven-sh/bun/pull/32153)
const stdinWasTTY = process.stdin.isTTY;
// Consume the pipe before replacing stdin with the console.
const pipedMarkdown =
  !stdinWasTTY && args.positionals.length === 0
    ? await Bun.stdin.text()
    : undefined;
const { ReadStream } = await import("node:tty");
let terminalInput: NodeJS.ReadStream;
if (stdinWasTTY) {
  terminalInput = process.stdin;
} else if (process.platform === "win32") {
  process.stdin.pause();
  process.stdin.destroy();
  // The old pipe must release descriptor 0 first.
  try {
    closeSync(0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EBADF") {
      throw error;
    }
  }
  const fd = openSync("\\\\.\\CONIN$", "r+");
  if (fd !== 0) {
    closeSync(fd);
    throw new Error(`Expected CONIN$ on fd 0, got fd ${fd}`);
  }
  terminalInput = new ReadStream(fd);
} else {
  terminalInput = new ReadStream(openSync("/dev/tty", "r+"));
}

terminalInput.setRawMode?.(true);
terminalInput.resume();
//#endregion

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  width: parseInt(args.values.width),
  height: parseInt(args.values.height),
  stdin: terminalInput,
  consoleOptions: {
    sizePercent: 60,
  },
});

const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
function loadSpinner(parent: ScrollBoxRenderable) {
  // i had chatgpt generate this because i'm not exactly the most productive
  let frame = 0;
  const spinner = new TextRenderable(renderer, {
    content: `${spinnerFrames[frame]} Loading...`,
    width: "100%",
  });
  parent.add(spinner);
  const interval = setInterval(() => {
    frame = (frame + 1) % spinnerFrames.length;
    spinner.content = `${spinnerFrames[frame]} Loading...`;
  }, 80);
  return () => {
    clearInterval(interval);
    if (parent.getChildren().includes(spinner)) {
      parent.remove(spinner);
    }
  };
}

const loadingText = new TextRenderable(renderer, {
  content: `${spinnerFrames[0]} Loading...`,
  width: "100%",
});

flushLogBuffer();

const root = new BoxRenderable(renderer, {
  width: "100%",
  height: "100%",
  flexDirection: "row",
});
renderer.root.add(root);

const homeRenderable = new BoxRenderable(renderer, {
  width: "100%",
  height: "100%",
  flexDirection: "column",
  visible: false,
});
const noFilesFoundText = new TextRenderable(renderer, {
  content: "No files found",
  fg: RGBA.fromHex("#888"),
  visible: false,
  width: "100%",
});
homeRenderable.add(
  new TextRenderable(renderer, {
    content: await makeFigletFont("remder", 1, "left", args.values.width),
  }),
);
homeRenderable.add(noFilesFoundText);
root.add(homeRenderable);

//#region file menu
const optionsArray = [];
for await (const file of glob("**/*.md", {})) {
  let birthTime = "";
  try {
    birthTime = new Date((await stat(file)).birthtime).toDateString();
  } catch (err) {
    birthTime = "unknown";
  }
  optionsArray.push({
    name: file,
    description: `\tCreated at: ${birthTime}`,
    value: file,
  });
}
const menu = new SelectRenderable(renderer, {
  options: optionsArray,
  width: "100%",
  flexGrow: 1,
  id: "menu",
  focusedBackgroundColor: "transparent",
  selectedBackgroundColor: "transparent",
  selectedTextColor: RGBA.fromHex("#fff"),
  focusedTextColor: RGBA.fromHex("#aaa"),
  textColor: RGBA.fromHex("#aaa"),
});
homeRenderable.add(menu);
const fuzzysortSnapshot = fuzzysort.snapshot(optionsArray, { key: "value" });
menu.on(SelectRenderableEvents.ITEM_SELECTED, async (_, opt: SelectOption) => {
  resetDocumentState();
  contentScrollBox
    .getChildren()
    .forEach((child) => contentScrollBox.remove(child));
  const removeSpinner = loadSpinner(contentScrollBox);
  // loadSpinner returns a function that removes the spinner when called!
  root.add(contentScrollBox);
  homeRenderable.visible = false;
  contentScrollBox.focus();
  root.add(contentScrollBox);
  focusedElement = "content";
  try {
    const content = await Bun.file(opt.value).text();
    const rendered = await stylize(parseInput(content), opt.value);
    (
      await renderMarkdown(
        rendered,
        renderer,
        languageToNerdFontIconMap,
        args.values.noRenderHeadings,
        args.values.noRenderImages,
        args.values.width,
      )
    ).forEach((renderable) => contentScrollBox.add(renderable));
    if (tocBox) {
      root.remove(tocBox);
      tocMenu.options = headingsArrayForToc.map((heading) => {
        const headingNumber = heading.id.split("-").at(-1)?.padStart(2, "0");
        return {
          name: `${"  ".repeat(heading.level - 1)}${headingNumber} ${heading.text}`,
          description: "",
          value: heading.id,
        };
      });
      root.add(tocBox);
      contentScrollBox.remove(loadingText);
    }
    focusedElement = "content";
    homeRenderable.visible = false;
    console.log(`selected option "${opt.name}`);
  } finally {
    removeSpinner();
  }
});
//#endregion

let focusedElement: "content" | "menu" | null = null;

const contentScrollBoxOpts = {
  width: "auto" as "auto",
  minWidth: 0,
  height: renderer.height - 1,
  id: "root-scrollbox",
  flexShrink: 1,
  flexGrow: 1,
  padding: 1,
  paddingRight: 3,
  contentOptions: {
    rowGap: 1,
    paddingLeft: 1,
  },
};
const contentScrollBox = new ScrollBoxRenderable(
  renderer,
  contentScrollBoxOpts,
);

const searchBox = new InputRenderable(renderer, {
  flexGrow: 1,
  backgroundColor: "transparent",
  textColor: RGBA.fromHex("#fff"),
});

const searchRow = new BoxRenderable(renderer, {
  visible: false,
  position: "absolute",
  bottom: 0,
  left: 0,
  width: "100%",
  backgroundColor: "#888",
  flexDirection: "row",
});
searchRow.add(
  new TextRenderable(renderer, {
    content: new StyledText([
      { __isChunk: true, text: "/", fg: RGBA.fromHex("#fff") },
    ]),
  }),
);
searchRow.add(searchBox);
root.add(searchRow);

searchBox.on(InputRenderableEvents.INPUT, (val: string) => {
  const results = fuzzysort
    .go(val, fuzzysortSnapshot, { limit: Infinity })
    .map((result) => result.obj);
  menu.options = results;
  noFilesFoundText.visible = results.length === 0;
});
searchBox.on(InputRenderableEvents.ENTER, (val: string) => {
  searchRow.visible = false;
  bottomBar.visible = true;
  const results = fuzzysort
    .go(val, fuzzysortSnapshot, { limit: Infinity })
    .map((result) => result.obj);
  menu.options = results;
  menu.focus();
  noFilesFoundText.visible = results.length === 0;
});

const keymap = createDefaultOpenTuiKeymap(renderer);
keymap.registerLayer({
  commands: [
    //#region quit
    {
      name: "app.quit",
      run() {
        renderer.destroy();
        terminalInput.destroy();
        process.exit();
      },
    },
    //#endregion
    //#region down
    {
      name: "app.down",
      run() {
        focusedElement === "content"
          ? (
            root.findDescendantById(`root-scrollbox`) as
            ScrollBoxRenderable | undefined
          )?.scrollBy(1)
          : menu?.moveDown();
      },
    },
    //#endregion
    //#region up
    {
      name: "app.up",
      run() {
        focusedElement === "content"
          ? (
            root.findDescendantById(`root-scrollbox`) as
            ScrollBoxRenderable | undefined
          )?.scrollBy(-1)
          : menu?.moveUp();
      },
    },
    //#endregion
    //#region focus previous details
    {
      name: "content.prevDetails",
      run() {
        if (focusedElement !== "content" || detailsElementsArray.length < 1)
          return;
        if (detailsElementsIndex === null) detailsElementsIndex = 0;
        detailsElementsIndex =
          (detailsElementsIndex - 1 + detailsElementsArray.length)
          % detailsElementsArray.length;
        const detailsElement = detailsElementsArray.at(detailsElementsIndex);
        console.log(
          `pressed previous details. current index is ${detailsElementsIndex}`,
        );
        detailsElement?.focus();
        contentScrollBox.scrollBy(detailsElement?.y ?? 0);
      },
    },
    //#endregion
    //#region focus next details
    {
      name: "content.nextDetails",
      run() {
        if (focusedElement !== "content") return;
        if (focusedElement !== "content" || detailsElementsArray.length < 1)
          return;
        if (detailsElementsIndex === null) detailsElementsIndex = -1;
        detailsElementsIndex =
          (detailsElementsIndex + 1) % detailsElementsArray.length;
        const detailsElement = detailsElementsArray.at(detailsElementsIndex);
        console.log(
          `pressed next details. current index is ${detailsElementsIndex}`,
        );
        detailsElement?.focus();
        contentScrollBox.scrollBy(detailsElement?.y ?? 0);
      },
    },
    //#endregion
    //#region help menu
    {
      name: "app.help",
      run() {
        const helpMenuBox = root.findDescendantById("helpMenu");
        if (helpMenuBox) helpMenuBox.visible = !helpMenuBox.visible;
      },
    },
    //#endregion
    //#region toggle console
    {
      name: "app.console",
      run() {
        if (args.values.debug) renderer.console.toggle();
      },
    },
    //#endregion
    //#region jump to previous heading
    {
      name: "content.prevHeading",
      run() {
        if (headingsArrayForToc.length > 0) {
          headingIndexForToc =
            (headingIndexForToc - 1 + headingsArrayForToc.length)
            % headingsArrayForToc.length;
          const id = headingsArrayForToc[headingIndexForToc]?.id;
          if (!id) return;
          const heading = root.findDescendantById(id);
          const y = heading?.y;
          if (y === undefined || !heading) return;
          process.nextTick(() => {
            if (contentScrollBox)
              contentScrollBox.scrollTo(heading.y + contentScrollBox.scrollTop);
          });
          tocMenu.setSelectedIndex(headingIndexForToc);
        }
      },
    },
    //#endregion
    //#region jump to next heading
    {
      name: "content.nextHeading",
      run() {
        if (headingsArrayForToc.length > 0) {
          const id = headingsArrayForToc[headingIndexForToc]?.id;
          if (!id) return;
          const heading = root.findDescendantById(id);
          const y = heading?.y;
          if (y === undefined || !heading) return;
          process.nextTick(() => {
            if (contentScrollBox)
              contentScrollBox.scrollTo(heading.y + contentScrollBox.scrollTop);
          });
          tocMenu.setSelectedIndex(headingIndexForToc);
          headingIndexForToc =
            (headingIndexForToc + 1) % headingsArrayForToc.length;
          console.log(
            `next heading / scrolled to ${contentScrollBox ? heading.y + contentScrollBox?.scrollTop : undefined}`,
          );
        }
      },
    },
    //#endregion
    //#region toggle toc
    {
      name: "app.toc",
      run() {
        if (tocBox) tocBox.visible = !tocBox.visible;
      },
    },
    //#endregion
    //#region jump to top
    {
      name: "content.goToTop",
      run() {
        focusedElement === "content"
          ? contentScrollBox?.scrollTo(0)
          : menu.setSelectedIndex(0);
      },
    },
    //#endregion
    //#region jump to bottom
    {
      name: "content.goToBottom",
      run() {
        focusedElement === "content"
          ? contentScrollBox?.scrollTo(contentScrollBox.scrollHeight)
          : menu.setSelectedIndex(menu.options.length - 1);
      },
    },
    //#endregion
    //#region go to file menu
    {
      name: "app.goToFileMenu",
      run() {
        tocMenu.options = [];
        contentScrollBox
          .getChildren()
          .forEach((child) => contentScrollBox.remove(child));
        root.remove(contentScrollBox);
        homeRenderable.visible = true;
        menu.focus();
        focusedElement = "menu";
        searchRow.visible = false;
        bottomBar.visible = true; // just in case search is open
      },
    },
    //#endregion
    //#region fuzzy search files
    {
      name: "menu.fuzzySearch",
      run() {
        searchRow.visible = !searchRow.visible;
        if (searchRow.visible) searchBox.focus();
        bottomBar.visible = !bottomBar.visible;
      },
    },
    //#endregion
  ],
  bindings: [
    { key: "q", cmd: "app.quit" },
    { key: "]d", cmd: "content.nextDetails" },
    { key: "[d", cmd: "content.prevDetails" },
    { key: "down", cmd: "app.down" },
    { key: "j", cmd: "app.down" },
    { key: "up", cmd: "app.up" },
    { key: "k", cmd: "app.up" },
    { key: "?", cmd: "app.help" },
    { key: "shift+c", cmd: "app.console" },
    { key: "shift+k", cmd: "content.prevHeading" },
    { key: "shift+j", cmd: "content.nextHeading" },
    { key: "shift+t", cmd: "app.toc" },
    { key: "g", cmd: "content.goToTop" },
    { key: "shift+g", cmd: "content.goToBottom" },
    { key: "escape", cmd: "app.goToFileMenu" },
    { key: "/", cmd: "menu.fuzzySearch" },
  ],
});

if (args.positionals.length > 0) {
  //#region handle supplied file
  const removeSpinner = loadSpinner(contentScrollBox);
  root.add(contentScrollBox);
  const filePath = args.positionals.at(-1);
  let fileContent = "";
  if (URL.canParse(filePath!)) {
    fileContent = await got(filePath!).text();
  } else {
    try {
      fileContent = await Bun.file(filePath!).text();
    } catch (err) {
      removeSpinner();
      throw new Error(`Encountered an error: ${err}`);
    }
  }
  const tokens = await stylize(parseInput(fileContent), filePath || "");
  const renderables = await renderMarkdown(
    tokens,
    renderer,
    languageToNerdFontIconMap,
    args.values.noRenderHeadings,
    args.values.noRenderImages,
    args.values.width,
  );
  renderables.forEach((renderable) => {
    contentScrollBox.add(renderable);
  });
  contentScrollBox.focus();
  focusedElement = "content";
  removeSpinner();
  //#endregion
} else if (!stdinWasTTY) {
  //#region handle piped input
  const box = new ScrollBoxRenderable(renderer, contentScrollBoxOpts);
  box.focus();
  focusedElement = "content";
  root.add(box);
  const removeSpinner = loadSpinner(box);
  try {
    const md = pipedMarkdown!;
    const tokens = await stylize(parseInput(md), "");
    const renderables = await renderMarkdown(
      tokens,
      renderer,
      languageToNerdFontIconMap,
      args.values.noRenderHeadings,
      args.values.noRenderImages,
      args.values.width,
    );
    renderables.forEach((renderable) => box.add(renderable));
  } finally {
    removeSpinner();
  }
  //#endregion
} else {
  menu.focus();
  focusedElement = "menu";
  root.add(homeRenderable);
  homeRenderable.visible = true;
}

//#region bottom bar + opts
const bottomBarOpts: BoxOptions<BoxRenderable> = {
  width: "100%",
  height: 1,
  flexDirection: "row",
  position: "absolute",
  bottom: 0,
  left: 0,
  backgroundColor: RGBA.fromInts(40, 40, 40),
  id: "bottomBar",
};
const bottomBar = new BoxRenderable(renderer, bottomBarOpts);
bottomBar.add(
  Box(
    {
      paddingLeft: 1,
      paddingRight: 1,
      backgroundColor: RGBA.fromHex("#089916"),
      columnGap: 1,
    },
    Text({
      content: "reMDer",
      attributes: createTextAttributes({ bold: true }),
    }),
  ),
);
bottomBar.add(
  Text({
    content: args.positionals.at(-1) || "stdin",
    attributes: createTextAttributes({ dim: true }),
    marginLeft: 1,
  }),
);
bottomBar.add(
  Text({
    content: "? - Help",
    alignSelf: "flex-end",
    marginLeft: "auto",
    marginRight: 1,
  }),
);
root.add(bottomBar);
//#endregion

//#region help menu
const helpMenuChildrenOpts: TextOptions = {
  width: "auto",
  height: 1,
};
// prettier-ignore
const helpMenuChildren = [
  Text({ content: "q        quit", ...helpMenuChildrenOpts }),
  Text({ content: "j/down   go down", ...helpMenuChildrenOpts }),
  Text({ content: "k/up     go up", ...helpMenuChildrenOpts }),
  Text({ content: "J        jump to next heading", ...helpMenuChildrenOpts }),
  Text({ content: "K        jump to previous heading", ...helpMenuChildrenOpts }),
  Text({ content: "T        toggle table of contents", ...helpMenuChildrenOpts }),
  Text({ content: "?        help menu", ...helpMenuChildrenOpts }),
  Text({ content: "g        go to top", ...helpMenuChildrenOpts }),
  Text({ content: "G        go to bottom", ...helpMenuChildrenOpts }),
  Text({ content: "[d       go to previous details element", ...helpMenuChildrenOpts, }),
  Text({ content: "]d       go to next details element", ...helpMenuChildrenOpts }),
];
if (args.values.debug) {
  helpMenuChildren.push(
    Text({ content: "C      - toggle console", ...helpMenuChildrenOpts }),
  );
}
const helpMenuOpts: BoxOptions<BoxRenderable> = {
  flexDirection: "column",
  position: "absolute",
  gap: 1,
  padding: 1,
  border: true,
  title: "Help",
  titleAlignment: "center",
  titleColor: "white",
  backgroundColor: RGBA.fromInts(40, 40, 40),
  borderColor: RGBA.fromInts(40, 40, 40),
  id: "helpMenu",
  visible: false,
  zIndex: 5,
  onSizeChange() {
    helpMenuBox.top = Math.floor((root.height - helpMenuBox.height) / 2);
    helpMenuBox.left = Math.floor((root.width - helpMenuBox.width) / 2);
  },
};
const helpMenuBox = new BoxRenderable(renderer, helpMenuOpts);
helpMenuChildren.forEach((child) => helpMenuBox.add(child));
console.log(root.height, helpMenuBox.height, root.width, helpMenuBox.width);
root.add(helpMenuBox);
//#endregion

//#region table of contents
const tocMenuChildren = headingsArrayForToc.map((heading) => {
  const headingNumber = heading.id.split("-").at(-1)?.padStart(2, "0");
  return {
    name: `${"  ".repeat(heading.level - 1)}${headingNumber} ${heading.text}`,
    description: "",
    value: heading.id,
  };
});
const tocMenu = new SelectRenderable(renderer, {
  padding: 1,
  width: 40,
  id: "toc-scrollbox",
  focusedBackgroundColor: RGBA.fromInts(8, 153, 22, 0.2),
  textColor: RGBA.fromInts(208, 208, 208),
  focusedTextColor: RGBA.fromInts(208, 208, 208),
  selectedTextColor: "white",
  showSelectionIndicator: false,
  options: tocMenuChildren,
  showDescription: false,
  height: "100%",
  marginTop: 1,
});
const tocBox = new BoxRenderable(renderer, {
  visible: false,
  zIndex: 10,
  flexDirection: "column",
  height: "100%",
  width: 40,
  flexShrink: 0,
  title: "Table of Contents",
  border: true,
  borderColor: "transparent",
  titleColor: "white",
  titleAlignment: "center",
  marginTop: 1,
});
tocBox.add(tocMenu);
root.add(tocBox);
//#endregion

//#region sync toc and scrollbox
// when you scroll, this is the code that updates the toc with the heading
let lastScrollTop = contentScrollBox?.scrollTop;
renderer.on("frame", () => {
  if (!contentScrollBox) return;
  const scrollTop = contentScrollBox.scrollTop;
  if (scrollTop === lastScrollTop) return;
  syncToC();
  lastScrollTop = scrollTop;
});
function syncToC() {
  if (headingsArrayForToc.length === 0 || !contentScrollBox) return;
  if (
    contentScrollBox.scrollTop
    >= Math.max(
      0,
      contentScrollBox.scrollHeight - contentScrollBox.viewport.height,
    )
  ) {
    const lastIndex = headingsArrayForToc.length - 1;
    if (tocMenu.getSelectedIndex() !== lastIndex) {
      tocMenu.setSelectedIndex(lastIndex);
    }
    return;
  }
  // binary search!
  let low = 0;
  let high = headingsArrayForToc.length - 1;
  let activeIndex = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const y = headingsArrayForToc[mid]?.renderable.screenY;
    if (y === undefined) return;
    if (y <= contentScrollBox.screenY) {
      activeIndex = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (tocMenu.getSelectedIndex() !== activeIndex) {
    tocMenu.setSelectedIndex(activeIndex);
  }
}
//#endregion
