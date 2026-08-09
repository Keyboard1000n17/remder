import p from "./parse-input.js";
import s from "./stylize.js";
import type { ProcessedToken } from "./stylize.js";

const md = await Bun.file("../test-files/all.md").text();
const spmd = await s(p(md));
const width: number = parseInt(process.stdout.columns);

function test(ts: ProcessedToken[]) {
  let str = "";
  for (const t of ts) {
    if (t.type === "heading") {
      const rows = t.content.headingTextArray;
      let start = 0;
      while (start < rows[0].length) {
        let end = start;
        let lineWidth = 0;
        while (
          end < rows[0].length &&
          lineWidth + rows[0][end].length <= width
        ) {
          lineWidth += rows[0][end].length;
          end++;
        }
        for (const row of rows) {
          str += row.slice(start, end).join("");
          str += "\n";
        }
        str += "\n";
        start = end;
      }
    } else if (Array.isArray(t.content)) {
      str += test(t.content);
    } else if (typeof t.content === "string") {
      str += t.content;
    }
    str += t.block ? "\n\n" : " ";
  }
  return str;
}

console.log(test(spmd));

console.log("———————————————————UNKNOWN TAG HANDLING————————————————————————");
test(await s(p("<foo>bar</foo>")));
test(await s(p("<foo><p>baz</p>bar</foo>")));
