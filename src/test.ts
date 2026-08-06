import p from "./parse-input.js";
import s from "./stylize.js";

const md = await Bun.file("../test-files/all.md").text();
const spmd = await s(p(md));

function test(ts: any[]) {
  let str = "";
  for (const t of ts) {
    if (Array.isArray(t.content)) {
      test(t.content);
    } else if (typeof t.content === "string") {
      str += t.content.trim();
    }
  }
  console.log(str);
}

test(spmd);

console.log("———————————————————UNKNOWN TAG HANDLING————————————————————————");
test(p("<foo>bar</foo>"));
test(p("<foo><p>baz</p>bar</foo>"));
