import filetree from "../services/filetree.js";

export default {
  handler: async ({ validatePaths, sendObj, sid, msg, ws, vId }) => {
    const query = msg.data.query;
    const dir = msg.data.dir;
    if (!validatePaths(dir, msg.type, ws, sid, vId)) {
      return;
    }

    sendObj(sid, {
      type: "SEARCH_RESULTS",
      vId,
      folder: dir,
      results: filetree.search(query, dir),
    });
  },
};
