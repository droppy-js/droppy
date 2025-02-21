import filetree from "../services/filetree.js";

import log from "../services/log.js";
import db from "../services/db.js";

export default {
  handler: async ({ validatePaths, sid, config, sendError, msg, ws, vId }) => {
    if (config.readOnly) {
      return sendError(sid, vId, "Files are read-only");
    }

    const rSrc = msg.data.src;
    const rDst = msg.data.dst;

    // Disallow whitespace-only and empty strings in renames
    if (
      !validatePaths([rSrc, rDst], msg.type, ws, sid, vId) ||
      /^\s*$/.test(rDst) ||
      rDst === "" ||
      rSrc === rDst
    ) {
      log.info(ws, null, `Invalid rename request: ${rSrc}-> ${rDst}`);
      sendError(sid, vId, "Invalid rename request");
      return;
    }

    try {
      await filetree.move(rSrc, rDst);
    } catch (err) {
      log.error(ws, null, err);
      sendError(sid, vId, `Error renaming ${rSrc} to ${rDst}`);
      return;
    }

    // update sharelinks to new destination
    const links = db.get("links");
    for (const link of Object.keys(links)) {
      if (links[link].location === rSrc) {
        links[link].location = rDst;
        log.info(ws, null, `Share link updated: ${link} -> ${rDst}`);
      }
    }
    db.set("links", links);
  },
};
