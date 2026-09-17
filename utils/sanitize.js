import XSS from "xss";

const xss = new XSS({
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
  return xss(value);
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
    req.params = sanitizeObject(req.params);
    next();
  };
};

// Sanitize query string
const sanitizeQuery = () => {
  return async (req, res, next) => {
    req.query = sanitizeObject(req.query);
    next();
  };
};

export { sanitize, sanitizeObject, sanitizeBody, sanitizeParams, sanitizeQuery };