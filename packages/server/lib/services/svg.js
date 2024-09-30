"use strict";

import svgstore from "@droppyjs/svgstore";
import fs from "fs";
import path from "path";
import paths from "./paths.js";

export default function svg() {
  const sprites = svgstore({
    svgAttrs: {
      style: "display: none",
    },
  });

  fs.readdirSync(paths.get().svg).forEach((file) => {
    sprites.add(
      `i-${file.replace(/\.svg/, "")}`,
      fs.readFileSync(path.join(paths.get().svg, file))
    );
  });

  return sprites.toString({ inline: true });
}
