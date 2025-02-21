"use strict";

import debounce from "lodash.debounce";
import chokidar from "chokidar";
import escRe from "escape-string-regexp";
import fs from "fs/promises";

import path from "path";
import rrdir from "rrdir";
import rfdc from "rfdc";

import log from "./log.js";
import paths from "./paths.js";
import utils from "./utils.js";

import { EventEmitter } from "events";

const clone = rfdc();

let dirs = {};
let todoDirs = [];
let initial = true;
let watching = true;
let timer = null;
let cfg = null;

const WATCHER_DELAY = 3000;

class DroppyFileTree extends EventEmitter {
  init(config) {
    cfg = config;
  }

  watch() {
    chokidar
      .watch(paths.get().files, {
        alwaysStat: true,
        ignoreInitial: true,
        usePolling: Boolean(cfg.pollingInterval),
        interval: cfg.pollingInterval,
        binaryInterval: cfg.pollingInterval,
      })
      .on("error", log.error)
      .on("all", () => {
        // TODO: only update what's really necessary
        if (watching) this.updateAll();
      });
  }

  updateAll() {
    debounce(() => {
      log.debug("Updating file tree because of local filesystem changes");
      this.updateDir(null, () => {
        this.emit("updateall");
      });
    })();
  }

  async updateDir(dir) {
    if (dir === null) {
      dir = "/";
      dirs = {};
    }

    const fullDir = utils.addFilesPath(dir);

    let stats;
    try {
      stats = await fs.lstat(fullDir);
    } catch (err) {
      log.error(err);
    }

    let entries = [];
    if (initial) {
      // sync walk for performance
      initial = false;
      try {
        entries = rrdir.sync(fullDir, {
          stats: true,
          exclude: cfg.ignorePatterns,
          followSymlinks: true,
        });
      } catch (err) {
        log.error(err);
      }
    } else {
      try {
        entries = await rrdir.async(fullDir, {
          stats: true,
          exclude: cfg.ignorePatterns,
          followSymlinks: true,
        });
      } catch (err) {
        log.error(err);
      }
    }

    for (const entry of entries || []) {
      if (entry.err) {
        if (
          entry.err.code === "ENOENT" &&
          dirs[utils.removeFilesPath(entry.path)]
        ) {
          delete dirs[utils.removeFilesPath(entry.path)];
        }
      }
    }

    const readDirs = entries.filter((entry) => entry.directory);
    const readFiles = entries.filter((entry) => !entry.directory);

    this.updateDirInCache(dir, stats, readDirs, readFiles);
  }

  async del(dir) {
    /**
     * @type {fs.Stats}
     */
    let stats;
    try {
      stats = await fs.stat(utils.addFilesPath(dir));
    } catch (err) {
      log.error(err);

      throw err;
    }

    if (stats.isFile()) {
      await this.unlink(dir);
    } else if (stats.isDirectory()) {
      await this.unlinkdir(dir);
    } else {
      throw new Error("Invalid file type");
    }
  }

  unlink(dir) {
    this.lookAway();

    // TODO: remove new promise, change to async when utils.rm is async
    return new Promise((resolve, reject) => {
      utils.rm(utils.addFilesPath(dir), (err) => {
        if (err) {
          log.error(err);
          reject(err);
        }

        delete dirs[path.dirname(dir)].files[path.basename(dir)];
        this.update(path.dirname(dir));
        resolve();
      });
    });
  }

  unlinkdir(dir) {
    this.lookAway();

    // TODO: remove new promise, change to async when utils.rmdir is async
    return new Promise((resolve, reject) => {
      utils.rmdir(utils.addFilesPath(dir), (err) => {
        if (err) {
          log.error(err);
          reject(err);
        }

        delete dirs[dir];
        Object.keys(dirs).forEach((d) => {
          if (new RegExp(`^${escRe(dir)}/`).test(d)) {
            delete dirs[d];
          }
        });

        this.update(path.dirname(dir));
        resolve();
      });
    });
  }

  async clipboard(src, dst, type) {
    /**
     * @type {fs.Stats}
     */
    let stats;

    try {
      stats = await fs.stat(utils.addFilesPath(src));
    } catch (err) {
      log.error(err);

      throw err;
    }

    this.lookAway();

    /**
     * @type {Function}
     */
    let callable;

    if (stats.isFile()) {
      if (type === "cut") {
        await this.mv(src, dst);
      } else {
        await this.cp(src, dst);
      }
    } else if (stats.isDirectory()) {
      if (type === "cut") {
        await this.mvdir(src, dst);
      } else {
        await this.cpdir(src, dst);
      }
    }

    return callable(src, dst);
  }

  async mk(dir) {
    this.lookAway();

    try {
      await fs.stat(utils.addFilesPath(dir));
    } catch (err) {
      if (err && err.code === "ENOENT") {
        const fd = await fs.open(utils.addFilesPath(dir), "wx");

        await fs.close(fd);

        dirs[path.dirname(dir)].files[path.basename(dir)] = {
          size: 0,
          mtime: Date.now(),
        };

        this.update(path.dirname(dir));
      } else {
        log.error(err);

        throw err;
      }
    }
  }

  async mkdir(dir) {
    this.lookAway();

    try {
      await fs.stat(utils.addFilesPath(dir));
    } catch (err) {
      if (err?.code !== "ENOENT") {
        log.error(err);
        throw err;
      }

      await utils.mkdir(utils.addFilesPath(dir));

      dirs[dir] = { files: {}, size: 0, mtime: Date.now() };
      this.update(path.dirname(dir));
    }
  }

  async move(src, dst) {
    this.lookAway();

    try {
      const stats = await fs.stat(utils.addFilesPath(src));

      if (stats.isFile()) {
        await this.mv(src, dst);
      } else if (stats.isDirectory()) {
        await this.mvdir(src, dst);
      }
    } catch (err) {
      log.error(err);

      throw err;
    }
  }

  mv(src, dst) {
    this.lookAway();

    return new Promise((resolve, reject) => {
      // TODO: asjust to async/await when utils.move is async
      utils.move(utils.addFilesPath(src), utils.addFilesPath(dst), (err) => {
        if (err) {
          log.error(err);

          reject(err);
        }

        dirs[path.dirname(dst)].files[path.basename(dst)] =
          dirs[path.dirname(src)].files[path.basename(src)];

        delete dirs[path.dirname(src)].files[path.basename(src)];

        this.update(path.dirname(src));
        this.update(path.dirname(dst));

        resolve();
      });
    });
  }

  mvdir(src, dst) {
    this.lookAway();

    return new Promise((resolve, reject) => {
      // TODO: asjust to async/await when utils.move is async
      utils.move(utils.addFilesPath(src), utils.addFilesPath(dst), (err) => {
        if (err) {
          log.error(err);

          reject(err);
        }

        dirs[dst] = dirs[src];
        delete dirs[src];

        Object.keys(dirs).forEach((dir) => {
          if (
            new RegExp(`^${escRe(src)}/`).test(dir) &&
            dir !== src &&
            dir !== dst
          ) {
            dirs[dir.replace(new RegExp(`^${escRe(src)}/`), `${dst}/`)] =
              dirs[dir];
            delete dirs[dir];
          }
        });

        this.update(path.dirname(src));
        this.update(path.dirname(dst));

        resolve();
      });
    });
  }

  cp(src, dst) {
    this.lookAway();

    return new Promise((resolve, reject) => {
      utils.copyFile(
        utils.addFilesPath(src),
        utils.addFilesPath(dst),
        (err) => {
          if (err) {
            log.error(err);

            reject(err);
            return;
          }

          dirs[path.dirname(dst)].files[path.basename(dst)] = clone(
            dirs[path.dirname(src)].files[path.basename(src)]
          );

          dirs[path.dirname(dst)].files[path.basename(dst)].mtime = Date.now();

          this.update(path.dirname(dst));

          resolve();
        }
      );
    });
  }

  async cpdir(src, dst) {
    this.lookAway();
    await utils.copyDir(utils.addFilesPath(src), utils.addFilesPath(dst));

    // Basedir
    dirs[dst] = clone(dirs[src]);
    dirs[dst].mtime = Date.now();

    // Subdirs
    Object.keys(dirs).forEach((dir) => {
      if (
        new RegExp(`^${escRe(src)}/`).test(dir) &&
        dir !== src &&
        dir !== dst
      ) {
        dirs[dir.replace(new RegExp(`^${escRe(src)}/`), `${dst}/`)] = clone(
          dirs[dir]
        );
        dirs[dir.replace(new RegExp(`^${escRe(src)}/`), `${dst}/`)].mtime =
          Date.now();
      }
    });

    this.update(path.dirname(dst));
  }

  async save(dst, data) {
    this.lookAway();
    try {
      await fs.stat(utils.addFilesPath(dst));
    } catch (err) {
      if (err.code !== "ENOENT") {
        log.error(err);
        throw err;
      }
    }

    await fs.writeFile(utils.addFilesPath(dst), data);

    dirs[path.dirname(dst)].files[path.basename(dst)] = {
      size: Buffer.byteLength(data),
      mtime: Date.now(),
    };

    this.update(path.dirname(dst));
  }

  search(query, p) {
    if (!dirs[p] || typeof query !== "string" || !query) return null;
    const files = [];
    const folders = [];
    query = query.toLowerCase();
    Object.keys(dirs)
      .filter((dir) => {
        return dir.indexOf(p) === 0;
      })
      .forEach((dir) => {
        if (dir.toLowerCase().includes(query) && dir !== p) {
          folders.push(dir);
        }
        Object.keys(dirs[dir].files).forEach((file) => {
          if (file.toLowerCase().includes(query)) {
            files.push(path.posix.join(dir, file));
          }
        });
      });
    const e = this.entries(files, folders, true, p);
    if (!Object.keys(e).length) return null;
    return e;
  }

  ls(p) {
    if (!dirs[p]) return;
    const files = Object.keys(dirs[p].files).map((file) => {
      return path.posix.join(p, file);
    });
    const folders = [];
    Object.keys(dirs).forEach((dir) => {
      if (path.dirname(dir) === p && path.basename(dir)) {
        folders.push(dir);
      }
    });
    return this.entries(files, folders);
  }

  lsFilter(p, re) {
    if (!dirs[p]) return;
    return Object.keys(dirs[p].files).filter((file) => {
      return re.test(file);
    });
  }

  // TODO: update references from here

  debouncedUpdate = debounce(
    () => {
      this.filterDirs(todoDirs).forEach((dir) => {
        this.emit("update", dir);
      });
      todoDirs = [];
    },
    100,
    { trailing: true }
  );

  update(dir) {
    this.updateDirSizes();
    todoDirs.push(dir);
    this.debouncedUpdate();
  }

  lookAway() {
    watching = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      watching = true;
    }, WATCHER_DELAY);
  }

  filterDirs(dirs) {
    return dirs
      .sort((a, b) => {
        return utils.countOccurences(a, "/") - utils.countOccurences(b, "/");
      })
      .filter((path, _, self) => {
        return self.every((another) => {
          return another === path || path.indexOf(`${another}/`) !== 0;
        });
      })
      .filter((path, index, self) => {
        return self.indexOf(path) === index;
      });
  }

  updateDirInCache(root, stat, readDirs, readFiles) {
    dirs[root] = {
      files: {},
      size: 0,
      mtime: stat ? stat.mtime.getTime() : Date.now(),
    };

    const readDirObj = {},
      readDirKeys = [];

    readDirs
      .sort((a, b) => utils.naturalSort(a.path, b.path))
      .forEach((d) => {
        const path = utils.removeFilesPath(d.path).normalize();
        readDirObj[path] = d.stats;
        readDirKeys[path] = path;
      });

    // Remove deleted dirs
    Object.keys(dirs).forEach((path) => {
      if (
        path.indexOf(root) === 0 &&
        readDirKeys.includes(path) &&
        path !== root
      ) {
        delete dirs[path];
      }
    });

    // Add dirs
    Object.keys(readDirObj).forEach((path) => {
      dirs[path] = {
        files: {},
        size: 0,
        mtime: readDirObj[path].mtime.getTime() || 0,
      };
    });

    // Add files
    readFiles
      .sort((a, b) => {
        return utils.naturalSort(a.path, b.path);
      })
      .forEach((f) => {
        const parentDir = utils
          .removeFilesPath(path.dirname(f.path))
          .normalize();
        const size = f.stats && f.stats.size ? f.stats.size : 0;
        const mtime =
          f.stats && f.stats.mtime && f.stats.mtime.getTime
            ? f.stats.mtime.getTime()
            : 0;
        dirs[parentDir].files[path.basename(f.path).normalize()] = {
          size,
          mtime,
        };
        dirs[parentDir].size += size;
      });

    this.update(root);
  }

  updateDirSizes() {
    const todo = Object.keys(dirs);

    todo.sort((a, b) => {
      return utils.countOccurences(b, "/") - utils.countOccurences(a, "/");
    });

    todo.forEach((d) => {
      dirs[d].size = 0;
      Object.keys(dirs[d].files).forEach((f) => {
        dirs[d].size += dirs[d].files[f].size;
      });
    });

    todo.forEach((d) => {
      if (path.dirname(d) !== "/" && dirs[path.dirname(d)]) {
        dirs[path.dirname(d)].size += dirs[d].size;
      }
    });
  }

  entries(files, folders, relativePaths, base) {
    const entries = {};
    files.forEach((file) => {
      const f = dirs[path.dirname(file)].files[path.basename(file)];
      const mtime = Math.round(f.mtime / 1e3);
      const name = relativePaths
        ? path.relative(base, file)
        : path.basename(file);
      entries[name] = ["f", mtime, f.size].join("|");
    });

    folders.forEach((folder) => {
      if (dirs[folder]) {
        const d = dirs[folder];
        const mtime = Math.round(d.mtime / 1e3);
        const name = relativePaths
          ? path.relative(base, folder)
          : path.basename(folder);
        entries[name] = ["d", mtime, d.size].join("|");
      }
    });
    return entries;
  }
}

export default new DroppyFileTree();
