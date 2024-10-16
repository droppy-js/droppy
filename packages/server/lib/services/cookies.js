"use strict";

import { db, utils } from "../index.js";

// TODO: set secure flag on cookie. Requires X-Forwarded-Proto from the proxy
const cookieParams = ["HttpOnly", "SameSite=strict"];

class DroppyCookies {
  parse(cookie) {
    const entries = {};
    if (typeof cookie === "string" && cookie.length) {
      cookie.split("; ").forEach((entry) => {
        const parts = entry.trim().split("=");
        entries[parts[0]] = parts[1];
      });
    }
    return entries;
  }

  get(cookie) {
    const entries = this.parse(cookie);
    if (!entries || !entries.s) {
      return false;
    }

    const sessions = Object.keys(db.get("sessions") || {});
    if (!sessions.includes(entries.s)) {
      return false;
    }

    return entries.s;
  }

  free(_req, res, _postData) {
    if (_postData) {
      // TODO: update eslint to not complain about unused parameters starting with an underscore
    }

    const sessions = db.get("sessions");
    const sid = utils.createSid();
    // TODO: obtain path
    res.setHeader("Set-Cookie", this.cookieHeaders(sid, "/", this.inOneYear()));
    sessions[sid] = {
      privileged: true,
      lastSeen: Date.now(),
    };
    db.set("sessions", sessions);
  }

  create(_req, res, postData) {
    const sessions = db.get("sessions");
    const sid = utils.createSid();
    const expires = postData.remember ? this.inOneYear() : null;
    res.setHeader(
      "Set-Cookie",
      this.cookieHeaders(sid, postData.path, expires)
    );
    sessions[sid] = {
      privileged: db.get("users")[postData.username].privileged,
      username: postData.username,
      lastSeen: Date.now(),
    };
    db.set("sessions", sessions);
  }

  unset(req, res, postData) {
    if (!req.headers.cookie) {
      return;
    }

    const session = this.parse(req.headers.cookie).s;
    if (!session) {
      return;
    }

    const sessions = db.get("sessions");
    delete sessions[session];
    db.set("sessions", sessions);
    res.setHeader(
      "Set-Cookie",
      this.cookieHeaders("gone", postData.path, this.epoch())
    );
  }

  inOneYear() {
    return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  }

  epoch() {
    return new Date(0).toUTCString();
  }

  cookieHeaders(sid, path, expires) {
    const realCookie = { s: sid, path: path || "/" };
    const deleteCookie = { s: "gone", expires: this.epoch(), path: "/" };
    if (path === "/" || !path) {
      if (expires) realCookie.expires = this.inOneYear();
      return this.cookieString(realCookie);
    } else {
      // expire a possible invalid old cookie on the / path
      if (expires) realCookie.expires = this.inOneYear();
      return [this.cookieString(deleteCookie), this.cookieString(realCookie)];
    }
  }

  cookieString(params) {
    return Object.keys(params)
      .map((param) => {
        return `${param}=${params[param]}`;
      })
      .concat(cookieParams)
      .join("; ");
  }
}

export default new DroppyCookies();
