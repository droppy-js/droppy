"use strict";

import { realpathSync } from "fs";
import path from "path";
import untildify from "untildify";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import os from "os";

const homedir = os.homedir();

let configDir = resolve(homedir, "/.droppy/config");
let filesDir = resolve(homedir, "/.droppy/files");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);

const clientPath = path.normalize(
  `${path.dirname(require.resolve("@droppyjs/client"))}/../`
);

class DroppyPaths {
  get() {
    return {
      homedir,

      files: resolve(filesDir),
      config: resolve(configDir),

      pid: resolve(configDir, "droppy.pid"),
      temp: resolve(configDir, "temp"),
      cfgFile: resolve(configDir, "config.json"),
      db: resolve(configDir, "db.json"),
      tlsKey: resolve(configDir, "tls.key"),
      tlsCert: resolve(configDir, "tls.cert"),
      tlsCA: resolve(configDir, "tls.ca"),

      mod: resolve(__dirname, ".."),
      server: resolve(__dirname, "..", "server"),
      client: clientPath,
      templates: resolve(clientPath, "lib", "templates"),
      svg: resolve(clientPath, "lib", "svg"),
    };
  }

  seed(config, files) {
    if (config) {
      configDir = config;
    }

    if (files) {
      filesDir = files;
    }
  }
}

function resolve(...args) {
  let p = path.join(...args); // Join the arguments into a path
  p = path.resolve(p.startsWith("~") ? untildify(p) : p); // Resolve "~" paths with untildify
  try {
    p = realpathSync(p); // Use the synchronous version of realpath
  } catch {
    // Fail silently
  }
  return p; // Return the resolved path
}

export default new DroppyPaths();
