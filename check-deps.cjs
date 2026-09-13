const fs = require("fs");
const s = fs.readFileSync("node_modules/.vite/deps/react-globe__gl.js", "utf8");
for (const kw of ["isPointerDragging", "pointerup", "onDblClick", "isPointerPressed"]) {
  let i = s.indexOf(kw);
  let n = 0;
  while (i !== -1 && n < 6) {
    const ctx = s.slice(i - 150, i + 260).replace(/\s+/g, " ");
    console.log("=== " + kw + " at", i);
    console.log(ctx);
    console.log();
    n++;
    i = s.indexOf(kw, i + 1);
    if (kw === "pointerup" && n >= 3) break;
  }
}
