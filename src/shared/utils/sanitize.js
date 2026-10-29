import xssPkg from "xss";

// xss is a CJS module: default export is a one-shot filter function, and the
// configurable sanitizer is the FilterXSS class (use .process, not call).
const { FilterXSS } = xssPkg;
const xss = new FilterXSS({
  whiteList: {}, // Strip all HTML by default
  onTagAttr: (tag, name, value, isWhiteListed) => {
    // Allow certain safe attributes on a case-by-case basis
    if (name === "href" && value.startsWith("/")) return value;
    if (name === "src" && (value.startsWith("/") || value.startsWith("http"))) return value;
    return isWhiteListed ? value : false;
  },
});

// Sanitize a single string value
const sanitize = (value) => {
  if (typeof value !== "string") return value;
  return xss.process(value);
};

// Sanitize an object (recursively sanitize all string values)
const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return sanitize(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === "object") {
    const result = {};
    for (const key of Object.keys(obj)) {
      result[key] = sanitizeObject(obj[key]);
    }
    return result;
  }
  return obj;
};

// Sanitize request body (used as middleware)
const sanitizeBody = () => {
  return async (req, res, next) => {
    req.body = sanitizeObject(req.body);
    next();
  };
};

// Sanitize request params
const sanitizeParams = () => {
  return async (req, res, next) => {
    const sanitized = sanitizeObject(req.params);
    for (const key of Object.keys(req.params)) delete req.params[key];
    Object.assign(req.params, sanitized);
    next();
  };
};

// Sanitize query string
// Note: Express 5 defines req.query as a getter-only property,
// so we mutate the existing object instead of reassigning it.
const sanitizeQuery = () => {
  return async (req, res, next) => {
    const sanitized = sanitizeObject(req.query);
    for (const key of Object.keys(req.query)) delete req.query[key];
    Object.assign(req.query, sanitized);
    next();
  };
};

export { sanitize, sanitizeObject, sanitizeBody, sanitizeParams, sanitizeQuery };