"use strict";

import chokidar from "chokidar";
import fs from "fs";
import crypto from "crypto";
import path from "path";

import { log, paths } from "../index.js";

const defaults = { users: {}, sessions: {}, links: {} };

let database, watching;

class DroppyDb {
  load(callback) {
    const dbFile = paths.get().db;
    fs.stat(dbFile, (err) => {
      if (err) {
        if (err.code === "ENOENT") {
          database = defaults;
          fs.mkdir(path.dirname(dbFile), { recursive: true }, (err) => {
            if (err) return callback(err);
            write();
            callback();
          });
        } else {
          callback(err);
        }
      } else {
        this.parse((err) => {
          if (err) return callback(err);
          let modified = false;

          // migrate old shortlinks
          if (database.shortlinks) {
            modified = true;
            database.sharelinks = database.shortlinks;
            delete database.shortlinks;
          }
          if (database.sharelinks) {
            modified = true;
            database.links = {};
            Object.keys(database.sharelinks).forEach((hash) => {
              database.links[hash] = {
                location: database.sharelinks[hash],
                attachment: false,
              };
            });
            delete database.sharelinks;
          }

          if (database.sessions) {
            Object.keys(database.sessions).forEach((session) => {
              // invalidate session not containing a username
              if (!database.sessions[session].username) {
                modified = true;
                delete database.sessions[session];
              }
              // invalidate pre-1.7 session tokens
              if (session.length !== 48) {
                modified = true;
                delete database.sessions[session];
              }
            });
          }

          // remove unused values
          if (database.version) {
            modified = true;
            delete database.version;
          }

          if (modified) write();
          callback();
        });
      }
    });
  }

  parse(cb) {
    const dbFile = paths.get().db;
    fs.readFile(dbFile, "utf8", (err, data) => {
      if (err) return cb(err);

      if (data.trim() !== "") {
        try {
          database = JSON.parse(data);
        } catch (err2) {
          return cb(err2);
        }
      } else {
        database = {};
      }
      database = Object.assign({}, defaults, database);
      cb();
    });
  }

  get(key) {
    return database[key];
  }

  set(key, value) {
    database[key] = value;
    write();
  }

  addOrUpdateUser(user, password, privileged) {
    const salt = crypto.randomBytes(4).toString("hex");

    database.users[user] = {
      hash: `${getHash(password + salt + user)}$${salt}`,
      privileged,
    };

    write();
  }

  delUser(user) {
    if (database.users[user]) {
      // delete user
      delete database.users[user];

      // delete user sessions
      Object.keys(database.sessions).forEach((sid) => {
        if (database.sessions[sid].username === user) {
          delete database.sessions[sid];
        }
      });

      write();
      return true;
    } else {
      return false;
    }
  }

  authUser(user, pass) {
    let parts;

    if (database.users[user]) {
      parts = database.users[user].hash.split("$");
      if (parts.length === 2 && parts[0] === getHash(pass + parts[1] + user)) {
        return true;
      }
    }

    return false;
  }

  watch(config) {
    const dbFile = paths.get().db;
    chokidar
      .watch(dbFile, {
        ignoreInitial: true,
        usePolling: Boolean(config.pollingInterval),
        interval: config.pollingInterval,
        binaryInterval: config.pollingInterval,
      })
      .on("error", log.error)
      .on("change", () => {
        if (!watching) return;
        this.parse((err) => {
          if (err) return log.error(err);
          log.info("db.json reloaded because it was changed");
        });
      })
      .on("ready", () => {
        watching = true;
      });
  }
}

// TODO: async
function write() {
  const dbFile = paths.get().db;
  watching = false;
  fs.writeFileSync(dbFile, JSON.stringify(database, null, 2));

  // watch the file 1 second after last write
  setTimeout(() => {
    watching = true;
  }, 1000);
}

function getHash(string) {
  return crypto.createHmac("sha256", string).digest("hex");
}

export default new DroppyDb();
