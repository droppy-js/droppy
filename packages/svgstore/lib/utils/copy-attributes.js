/**
 * Utility to copy specific attributes from one node to another.
 */

"use strict";

const ALWAYS_COPY_ATTRS = ["viewBox", "aria-labelledby", "role"];

export default function copyAttributes(a, b, attrs) {
  const attrsToCopy = ALWAYS_COPY_ATTRS.concat(attrs || []);
  const copiedAttrs = Object.create(null);

  attrsToCopy.forEach((attr) => {
    if (!attr || copiedAttrs[attr]) {
      return;
    }

    copiedAttrs[attr] = true;

    const bAttr = b.attr(attr);

    if (bAttr !== null) {
      a.attr(attr, bAttr);
    }
  });

  return a;
}
