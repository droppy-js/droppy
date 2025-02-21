"use strict";

import cd from "content-disposition";
import crypto from "crypto";
import escapeStringRegexp from "escape-string-regexp";
import fs from "fs";
import { isBinary } from "istextorbinary";
import mimeTypes from "mime-types";
import mv from "mv";
import path from "path";
import util from "util";

import { mkdir, stat, lstat, copyFile, readdir, access } from "fs/promises";

import { paths } from "../index.js";

const forceBinaryTypes = ["pdf", "ps", "eps", "ai"];

const overrideMimeTypes = {
  "video/x-matroska": "video/webm",
};

// Regex referenced from https://github.com/sindresorhus/filename-reserved-regex
// Copyright (c) Sindre Sorhus <sindresorhus@gmail.com>
// LICENSE: https://github.com/sindresorhus/filename-reserved-regex/blob/main/license
// eslint-disable-next-line no-control-regex
const filenameReservedRegex = /[<>:"/\\|?*\u0000-\u001F]/g;
const windowsReservedNameRegex = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

class DroppyUtils {
  isValidFilename(string) {
    // Function referenced from https://github.com/sindresorhus/valid-filename
    // Copyright (c) Sindre Sorhus <sindresorhus@gmail.com>
    // LICENSE: https://github.com/sindresorhus/valid-filename/blob/main/license

    if (!string || string.length > 255) {
      return false;
    }

    if (
      filenameReservedRegex.test(string) ||
      windowsReservedNameRegex.test(string)
    ) {
      return false;
    }

    if (string === "." || string === "..") {
      return false;
    }

    return true;
  }

  async mkdir(dir, cb) {
    for (const d of Array.isArray(dir) ? dir : [dir]) {
      await mkdir(d, { mode: "755", recursive: true });
    }
    if (cb) {
      cb();
    }
  }

  rm(p, cb) {
    fs.unlink(p, cb);
  }

  rmdir(p, cb) {
    fs.rm(p, { recursive: true }, cb);
  }

  move(src, dst, cb) {
    mv(src, dst, (err) => {
      if (cb) cb(err);
    });
  }

  copyFile(src, dst, cb) {
    let cbCalled = false;
    const read = fs.createReadStream(src);
    const write = fs.createWriteStream(dst);

    function done(err) {
      if (cbCalled) return;
      cbCalled = true;
      if (cb) cb(err);
    }

    read.on("error", done);
    write.on("error", done);
    write.on("close", done);
    read.pipe(write);
  }

  async copyDir(src, dest) {
    await mkdir(dest);

    for (const file of await readdir(src)) {
      if ((await lstat(path.join(src, file))).isFile()) {
        await copyFile(path.join(src, file), path.join(dest, file));
      } else {
        await this.copyDir(path.join(src, file), path.join(dest, file));
      }
    }
  }

  /**
   * Get a pseudo-random n-character lowercase string.
   */
  getLink(links, length) {
    const linkChars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456789";

    let link = "";
    do {
      while (link.length < length) {
        link += linkChars.charAt(Math.floor(Math.random() * linkChars.length));
      }
    } while (links[link]); // In case the RNG generates an existing link, go again

    return link;
  }

  pretty(data) {
    return util
      .inspect(data, { colors: true })
      .replace(/^\s+/gm, " ")
      .replace(/\s+$/gm, "")
      .replace(/[\r\n]+/gm, "");
  }

  async getNewPath(origPath, callback) {
    let stats;
    try {
      stats = await stat(origPath);
    } catch {
      return callback(origPath);
    }

    let filename = path.basename(origPath);
    const dirname = path.dirname(origPath);
    let extension = "";

    if (filename.includes(".") && stats.isFile()) {
      extension = filename.substring(filename.lastIndexOf("."));
      filename = filename.substring(0, filename.lastIndexOf("."));
    }

    if (!/-\d+$/.test(filename)) {
      filename += "-1";
    }

    let canCreate = false;
    while (!canCreate) {
      const num = parseInt(filename.substring(filename.lastIndexOf("-") + 1));
      filename =
        filename.substring(0, filename.lastIndexOf("-") + 1) + (num + 1);
      try {
        await access(path.join(dirname, filename + extension));
      } catch {
        canCreate = true;
      }
    }

    callback(path.join(dirname, filename + extension));
  }

  normalizePath(p) {
    return p.replace(/[\\|/]+/g, "/");
  }

  addFilesPath(p) {
    const filesPath = path.resolve(
      p === "/" ? paths.get().files : path.join(`${paths.get().files}/${p}`)
    );

    if (!filesPath.startsWith(path.resolve(paths.get().files))) {
      return paths.get().files;
    }

    return filesPath;
  }

  removeFilesPath(p) {
    if (p.length > paths.get().files.length) {
      return this.normalizePath(p.substring(paths.get().files.length));
    } else if (p === paths.get().files) {
      return "/";
    }
  }

  sanitizePathsInString(str) {
    return (str || "").replace(
      new RegExp(escapeStringRegexp(paths.get().files), "g"),
      ""
    );
  }

  isPathSane(p, isURL) {
    if (isURL) {
      // Navigating up/down the tree
      if (/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(p)) {
        return false;
      }
      // Invalid URL path characters
      if (!/^[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=%]+$/.test(p)) {
        return false;
      }
      return true;
    } else {
      return p.split(/[\\/]/gm).every((name) => {
        if (name === "." || name === "..") return false;
        if (!name) return true;
        return this.isValidFilename(name); // will reject invalid filenames on Windows
      });
    }
  }

  isBinary(p) {
    if (forceBinaryTypes.includes(path.extname(p).substring(1))) {
      return true;
    }

    return isBinary(p);
  }

  contentType(p) {
    const type = mimeTypes.lookup(p);
    if (overrideMimeTypes[type]) return overrideMimeTypes[type];

    if (type) {
      const charset = mimeTypes.charsets.lookup(type);
      return type + (charset ? `; charset=${charset}` : "");
    } else {
      try {
        return isBinary(p) ? "application/octet-stream" : "text/plain";
      } catch {
        return "application/octet-stream";
      }
    }
  }

  getDispo(fileName, download) {
    return cd(path.basename(fileName), {
      type: download ? "attachment" : "inline",
    });
  }

  createSid() {
    return crypto.randomBytes(64).toString("base64").substring(0, 48);
  }

  readJsonBody(req) {
    return new Promise((resolve, reject) => {
      try {
        if (req.body) {
          // This is needed if the express application is using body-parser
          if (typeof req.body === "object") {
            resolve(req.body);
          } else {
            resolve(JSON.parse(req.body));
          }
        } else {
          let body = [];
          req
            .on("data", (chunk) => {
              body.push(chunk);
            })
            .on("end", () => {
              body = String(Buffer.concat(body));
              resolve(JSON.parse(body));
            });
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  countOccurences(string, search) {
    let num = 0,
      pos = 0;
    while (true) {
      pos = string.indexOf(search, pos);
      if (pos >= 0) {
        num += 1;
        pos += search.length;
      } else break;
    }
    return num;
  }

  formatBytes(num) {
    if (num < 1) return `${num} B`;
    const units = ["B", "kB", "MB", "GB", "TB", "PB"];
    const exp = Math.min(
      Math.floor(Math.log(num) / Math.log(1000)),
      units.length - 1
    );
    return `${(num / 1000 ** exp).toPrecision(3)} ${units[exp]}`;
  }

  ip(req) {
    // TODO: https://tools.ietf.org/html/rfc7239

    return (
      (req.headers &&
        req.headers["x-forwarded-for"] &&
        req.headers["x-forwarded-for"].split(",")[0].trim()) ||
      (req.headers && req.headers["x-real-ip"]) ||
      (req.connection && req.connection.remoteAddress) ||
      (req.connection &&
        req.connection.socket &&
        req.connection.socket.remoteAddress) ||
      req.addr || // custom cached property
      (req.remoteAddress && req.remoteAddress)
    );
  }

  port(req) {
    return (
      (req.headers && req.headers["x-real-port"]) ||
      (req.connection && req.connection.remotePort) ||
      (req.connection &&
        req.connection.socket &&
        req.connection.socket.remotePort) ||
      req.port || // custom cached property
      (req.remotePort && req.remotePort)
    );
  }

  strcmp(a, b) {
    return a > b ? 1 : a < b ? -1 : 0;
  }

  naturalSort(a, b) {
    const x = [];
    const y = [];

    a.replace(/(\d+)|(\D+)/g, (_, a, b) => {
      x.push([a || 0, b]);
    });

    b.replace(/(\d+)|(\D+)/g, (_, a, b) => {
      y.push([a || 0, b]);
    });

    while (x.length && y.length) {
      const xx = x.shift();
      const yy = y.shift();
      const nn = xx[0] - yy[0] || this.strcmp(xx[1], yy[1]);
      if (nn) {
        return nn;
      }
    }
    if (x.length) {
      return -1;
    }

    if (y.length) {
      return 1;
    }

    return 0;
  }

  extensionRe(arr) {
    const result = arr.map((ext) => {
      return escapeStringRegexp(ext);
    });
    return new RegExp(`\\.(${result.join("|")})$`, "i");
  }

  readFile(p, cb) {
    if (typeof p !== "string") {
      return cb(null);
    }

    fs.stat(p, (_, stats) => {
      if (stats && stats.isFile()) {
        fs.readFile(p, (err, data) => {
          if (err) {
            return cb(err);
          }
          cb(null, String(data));
        });
      } else {
        cb(null);
      }
    });
  }

  arrify(val) {
    return Array.isArray(val) ? val : [val];
  }

  addUploadTempExt(p) {
    return p.replace(/(\/?[^/]+)/, (_, p1) => `${p1}.droppy-upload`);
  }

  removeUploadTempExt(p) {
    return p.replace(/(^\/?[^/]+)(\.droppy-upload)/, (_, p1) => p1);
  }

  rootname(p) {
    return p.split("/").find((p) => !!p);
  }
}

export default new DroppyUtils();
