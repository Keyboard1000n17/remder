import figlet, { type FigletOptions } from "figlet";
import { parseArgs } from "node:util";

const args = parseArgs({
  options: {
    name: {
      type: "string",
      short: "n",
    },
  },
});

const opts: FigletOptions = {
  font: args.values.name || "Standard",
  width: 60,
  horizontalLayout: "full",
  verticalLayout: "full",
};

console.log(
  await figlet.text("ABCDEFGHIJKLMNOPQRSTUVWXYZ", opts as FigletOptions),
  "\n",
);
console.log(
  await figlet.text("abcdefghijklmnopqrstuvwxyz", opts as FigletOptions),
  "\n",
);
console.log(await figlet.text("1234567890", opts as FigletOptions), "\n");
console.log(await figlet.text("lorem ipsum", opts as FigletOptions), "\n");
console.log(
  await figlet.text(
    "The quick fox jumps over the lazy dog.",
    opts as FigletOptions,
  ),
  "\n",
);

// 3 rows -> h6 -> calvin s (modify it)
// 4 rows -> h5 -> miniwi
// 5 rows -> h4 -> small
// 6 rows -> h3 -> ansi compact
// 7 rows -> h2 -> coder mini8
// 8 rows -> h1 -> ansi regular
