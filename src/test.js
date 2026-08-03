import p from "./parse-input.js";
import s from "./stylize.js";

const md = await Bun.file("../test-files/all.md").text();
const spmd = await s(p(md));

function test(ts) {
  for (const t of ts) {
    if (Array.isArray(t.content)) {
      test(t.content);
    } else {
      console.log(t.content);
    }
  }
}

test(spmd);
