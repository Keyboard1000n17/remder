import {
  TextTableRenderable,
  bold,
  createCliRenderer,
  fg,
  type TextChunk,
  type TextTableContent,
} from "@opentui/core";

const cell = (text: string): TextChunk[] => [{ __isChunk: true, text }];
const renderer = await createCliRenderer({ exitOnCtrlC: true });

const content: TextTableContent = [
  [[bold("Service")], [bold("Status")], [bold("Notes")]],
  [cell("api"), [fg("#00d4aa")("OK")], cell("latency 28ms")],
  [cell("worker"), [fg("#b8a0ff")("DEGRADED")], cell("queue depth: 124")],
];

const table = new TextTableRenderable(renderer, {
  width: "100%",
  wrapMode: "word",
  borderStyle: "rounded",
  content,
});

renderer.root.add(table);
