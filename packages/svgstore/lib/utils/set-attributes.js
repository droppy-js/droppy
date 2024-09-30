/**
 * Utility function to set the attributes of an element. Allows values to be
 * passed as functions so existing values may be manipulated or left untouched.
 */

"use strict";

export default function setAttributes(el, attrs) {
  if (!attrs || typeof attrs !== "object") {
    return el;
  }

  Object.keys(attrs).forEach((attr) => {
    let value = attrs[attr];

    // Handle function values directly as cherrio passes an unhelpful index
    // as the first argument in the native function handler.
    if (typeof value === "function") {
      value = value(el.attr(attr));
    }

    el.attr(attr, value);
  });

  return el;
}
