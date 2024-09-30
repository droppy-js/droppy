import path from "path";

import db from "../services/db.js";
import utils from "../services/utils.js";
import log from "../services/log.js";

export default {
  handler: async ({ validatePaths, sid, sendObj, config, msg, ws, vId }) => {
    if (!validatePaths(msg.data.location, msg.type, ws, sid, vId)) return;
    const links = db.get("links");

    // Check if we already have a link for that file
    const hadLink = Object.keys(links).some((link) => {
      if (
        msg.data.location === links[link].location &&
        msg.data.attachement === links[link].attachement
      ) {
        const ext = links[link].ext || path.extname(links[link].location);
        sendObj(sid, {
          type: "SHARELINK",
          vId,
          link: config.linkExtensions && ext ? link + ext : link,
          attachement: msg.data.attachement,
        });
        return true;
      }
    });

    if (hadLink) {
      return;
    }

    const link = utils.getLink(links, config.linkLength);
    const ext = path.extname(msg.data.location);
    log.info(ws, null, `Share link created: ${link} -> ${msg.data.location}`);

    links[link] = {
      location: msg.data.location,
      attachement: msg.data.attachement,
      ext,
    };
    db.set("links", links);
    sendObj(sid, {
      type: "SHARELINK",
      vId,
      link: config.linkExtensions ? link + ext : link,
      attachement: msg.data.attachement,
    });
  },
};
