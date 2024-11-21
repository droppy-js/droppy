#!/usr/bin/env node

"use strict";

import fs from "fs";
import untildify from "untildify";
import path from "path";
import util from "util";
import { fileURLToPath } from "url";

import pkg from "../package.json" with { type: "json" };

import { server, paths, resources, log, cfg, db } from "@droppyjs/server";

import minimist from "minimist";

import daemonize from 'daemonize-process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

util.inspect.defaultOptions.depth = 4;

const argv = minimist(process.argv.slice(2), {
  boolean: ["color", "d", "daemon", "dev"],
});

if (!argv.dev) {
  process.env.NODE_ENV = "production";
}

process.title = pkg.name;
process.chdir(__dirname);

const cmds = {
  start: "start                  Start the server",
  stop: "stop                   Stop all daemonized servers",
  config: "config                 Edit the config",
  list: "list                   List users",
  add: "add <user> <pass> [p]  Add or update a user. Specify 'p' for privileged",
  del: "del <user>             Delete a user",
  build: "build                  Build client resources",
  version: "version, -v            Print version",
};

const opts = {
  configdir:
    "-c, --configdir <dir>  Config directory. Default: ~/.droppy/config",
  filesdir: "-f, --filesdir <dir>   Files directory. Default: ~/.droppy/files",
  daemon: "-d, --daemon           Daemonize (background) process",
  log: "-l, --log <file>       Log to file instead of stdout",
  dev: "--dev                  Enable developing mode",
  color: "--color                Force-enable colored log output",
  nocolor: "--no-color             Force-disable colored log output",
};

if (argv.v || argv.V || argv.version) {
  console.info(pkg.version);
  process.exit(0);
}

if (argv.daemon || argv.d) {
  daemonize();
}

if (argv.configdir || argv.filesdir || argv.c || argv.f) {
  paths.seed(argv.configdir || argv.c, argv.filesdir || argv.f);
}

if (argv.log || argv.l) {
  try {
    log.setLogFile(
      fs.openSync(untildify(path.resolve(argv.log || argv.l)), "a", "644")
    );
  } catch (err) {
    console.error(`Unable to open log file for writing: ${err.message}`);
    process.exit(1);
  }
}

if (!argv._.length) {
  printHelp();
  process.exit(0);
}

const cmd = argv._[0];
const args = argv._.slice(1);

switch (cmd) {
  default:
    printHelp();
    break;

  case "start":
    server(null, true, argv.dev, (err) => {
      if (err) {
        log.error(err);
        process.exit(1);
      }
    });
    break;

  case "stop": {
    const ps = require("ps-node");
    ps.lookup({ command: pkg.name }, async (err, procs) => {
      if (err) {
        log.error(err);
        process.exit(1);
      } else {
        procs = procs.filter((proc) => Number(proc.pid) !== process.pid);
        if (!procs.length) {
          log.info("No processes found");
          process.exit(0);
        }

        const pids = await Promise.all(
          procs.map((proc) => {
            return new Promise((resolve) => {
              ps.kill(proc.pid, (err) => {
                if (err) {
                  log.error(err);
                  return process.exit(1);
                }
                resolve(proc.pid);
              });
            });
          })
        );

        if (pids.length) {
          console.info(`Killed PIDs: ${pids.join(", ")}`);
        }
        process.exit(0);
      }
    });
    break;
  }

  case "build":
    console.info("Building resources ...");
    resources.build((err) => {
      console.info(err || "Resources built successfully");
      process.exit(err ? 1 : 0);
    });
    break;

  case "version":
    console.info(pkg.version);
    break;

  case "config": {
    const ourPaths = paths.get();
    const edit = () => {
      findEditor((editor) => {
        if (!editor)
          return console.error(
            `No suitable editor found, please edit ${ourPaths.cfgFile}`
          );
        require("child_process").spawn(editor, [ourPaths.cfgFile], {
          stdio: "inherit",
        });
      });
    };
    fs.stat(ourPaths.cfgFile, (err) => {
      if (err && err.code === "ENOENT") {
        fs.mkdir(ourPaths.config, { recursive: true }, async () => {
          try {
            await cfg.init(null);
            edit();
          } catch (err) {
            console.error(new Error(err.message || err).stack);
          }
        });
      } else {
        edit();
      }
    });
    break;
  }
  case "list":
    db.load(() => {
      printUsers(db.get("users"));
    });
    break;
  case "add":
    if (args.length !== 2 && args.length !== 3) {
      printHelp();
    } else {
      db.load(() => {
        db.addOrUpdateUser(args[0], args[1], args[2] === "p", () => {
          printUsers(db.get("users"));
        });
      });
    }
    break;

  case "del":
    if (args.length !== 1) {
      printHelp();
    } else {
      db.load(() => {
        db.delUser(args[0], () => {
          printUsers(db.get("users"));
        });
      });
    }

    break;
}

function printHelp() {
  let help = `Usage: ${pkg.name} command [options]\n\n Commands:`;

  Object.keys(cmds).forEach((command) => {
    help += `\n   ${cmds[command]}`;
  });

  help += "\n\n Options:";

  Object.keys(opts).forEach((option) => {
    help += `\n   ${opts[option]}`;
  });

  console.info(help);
  process.exit();
}

function printUsers(users) {
  if (Object.keys(users).length === 0) {
    console.info("No users defined. Use 'add' to add one.");
  } else {
    console.info(
      `Current Users:\n${Object.keys(users)
        .map((user) => {
          return `  - ${user}`;
        })
        .join("\n")}`
    );
  }
}

function findEditor(cb) {
  const editors = ["vim", "nano", "vi", "npp", "pico", "emacs", "notepad"];
  const basename = require("path").basename;
  const which = require("which");
  const userEditor = basename(process.env.VISUAL || process.env.EDITOR);

  if (!editors.includes(userEditor)) {
    editors.unshift(userEditor);
  }

  (function find(editor) {
    try {
      cb(which.sync(editor));
    } catch {
      if (editors.length) {
        find(editors.shift());
      } else {
        cb();
      }
    }
  })(editors.shift());
}
