"use strict";

import crypto from "crypto";

let tokens = [];

class DroppyCsrf {
  create() {
    const token = crypto.randomBytes(16).toString("hex");
    tokens.unshift(token);
    tokens = tokens.slice(0, 500);
    return token;
  }

  validate(token) {
    return tokens.some((storedToken) => {
      return storedToken === token;
    });
  }
}

export default new DroppyCsrf();
