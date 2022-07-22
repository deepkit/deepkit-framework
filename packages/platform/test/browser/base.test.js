"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // dist/cjs/index.cjs
  var require_cjs = __commonJS({
    "dist/cjs/index.cjs"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.getFilename = exports.getDirname = void 0;
      var DIRNAME_POSIX_REGEX = /^((?:\.(?![^\/]))|(?:(?:\/?|)(?:[\s\S]*?)))(?:\/+?|)(?:(?:\.{1,2}|[^\/]+?|)(?:\.[^.\/]*|))(?:[\/]*)$/;
      var DIRNAME_WIN32_REGEX = /^((?:\.(?![^\\]))|(?:(?:\\?|)(?:[\s\S]*?)))(?:\\+?|)(?:(?:\.{1,2}|[^\\]+?|)(?:\.[^.\\]*|))(?:[\\]*)$/;
      var EXTRACT_PATH_REGEX = /@?(?<path>[file:\/\/]?[^\(\s]+):[0-9]+:[0-9]+/;
      var WIN_POSIX_DRIVE_REGEX = /^\/[A-Z]:\/*/;
      var pathDirname = (path) => {
        let dirname = DIRNAME_POSIX_REGEX.exec(path)?.[1];
        if (!dirname) {
          dirname = DIRNAME_WIN32_REGEX.exec(path)?.[1];
        }
        if (!dirname) {
          throw new Error(`Can't extract dirname from ${path}`);
        }
        return dirname;
      };
      var getPathFromErrorStack = () => {
        let path = "";
        const stack = new Error().stack;
        if (!stack) {
          console.warn("Error has no stack!");
          return path;
        }
        let initiator = stack.split("\n").slice(4, 5)[0];
        if (!initiator) {
          initiator = stack.split("\n").slice(3, 4)[0];
        }
        if (initiator) {
          path = EXTRACT_PATH_REGEX.exec(initiator)?.groups?.path || "";
        }
        if (!initiator || !path) {
          console.warn("Can't get path from error stack!");
        }
        return path;
      };
      var getPath = () => {
        let path = getPathFromErrorStack();
        const protocol = "file://";
        if (path.indexOf(protocol) >= 0) {
          path = path.slice(protocol.length);
        }
        if (WIN_POSIX_DRIVE_REGEX.test(path)) {
          path = path.slice(1).replace(/\//g, "\\");
        }
        return path;
      };
      var getDirname = () => {
        let path = getPath();
        const dirname = pathDirname(path);
        return dirname;
      };
      exports.getDirname = getDirname;
      var getFilename = () => {
        let filename = getPath();
        return filename;
      };
      exports.getFilename = getFilename;
    }
  });

  // node_modules/assertion-error/index.js
  var require_assertion_error = __commonJS({
    "node_modules/assertion-error/index.js"(exports, module) {
      function exclude() {
        var excludes = [].slice.call(arguments);
        function excludeProps(res, obj) {
          Object.keys(obj).forEach(function(key) {
            if (!~excludes.indexOf(key))
              res[key] = obj[key];
          });
        }
        return function extendExclude() {
          var args = [].slice.call(arguments), i = 0, res = {};
          for (; i < args.length; i++) {
            excludeProps(res, args[i]);
          }
          return res;
        };
      }
      module.exports = AssertionError;
      function AssertionError(message, _props, ssf) {
        var extend = exclude("name", "message", "stack", "constructor", "toJSON"), props = extend(_props || {});
        this.message = message || "Unspecified AssertionError";
        this.showDiff = false;
        for (var key in props) {
          this[key] = props[key];
        }
        ssf = ssf || AssertionError;
        if (Error.captureStackTrace) {
          Error.captureStackTrace(this, ssf);
        } else {
          try {
            throw new Error();
          } catch (e) {
            this.stack = e.stack;
          }
        }
      }
      AssertionError.prototype = Object.create(Error.prototype);
      AssertionError.prototype.name = "AssertionError";
      AssertionError.prototype.constructor = AssertionError;
      AssertionError.prototype.toJSON = function(stack) {
        var extend = exclude("constructor", "toJSON", "stack"), props = extend({ name: this.name }, this);
        if (false !== stack && this.stack) {
          props.stack = this.stack;
        }
        return props;
      };
    }
  });

  // node_modules/pathval/index.js
  var require_pathval = __commonJS({
    "node_modules/pathval/index.js"(exports, module) {
      "use strict";
      function hasProperty(obj, name) {
        if (typeof obj === "undefined" || obj === null) {
          return false;
        }
        return name in Object(obj);
      }
      function parsePath(path) {
        var str = path.replace(/([^\\])\[/g, "$1.[");
        var parts = str.match(/(\\\.|[^.]+?)+/g);
        return parts.map(function mapMatches(value) {
          if (value === "constructor" || value === "__proto__" || value === "prototype") {
            return {};
          }
          var regexp = /^\[(\d+)\]$/;
          var mArr = regexp.exec(value);
          var parsed = null;
          if (mArr) {
            parsed = { i: parseFloat(mArr[1]) };
          } else {
            parsed = { p: value.replace(/\\([.[\]])/g, "$1") };
          }
          return parsed;
        });
      }
      function internalGetPathValue(obj, parsed, pathDepth) {
        var temporaryValue = obj;
        var res = null;
        pathDepth = typeof pathDepth === "undefined" ? parsed.length : pathDepth;
        for (var i = 0; i < pathDepth; i++) {
          var part = parsed[i];
          if (temporaryValue) {
            if (typeof part.p === "undefined") {
              temporaryValue = temporaryValue[part.i];
            } else {
              temporaryValue = temporaryValue[part.p];
            }
            if (i === pathDepth - 1) {
              res = temporaryValue;
            }
          }
        }
        return res;
      }
      function internalSetPathValue(obj, val, parsed) {
        var tempObj = obj;
        var pathDepth = parsed.length;
        var part = null;
        for (var i = 0; i < pathDepth; i++) {
          var propName = null;
          var propVal = null;
          part = parsed[i];
          if (i === pathDepth - 1) {
            propName = typeof part.p === "undefined" ? part.i : part.p;
            tempObj[propName] = val;
          } else if (typeof part.p !== "undefined" && tempObj[part.p]) {
            tempObj = tempObj[part.p];
          } else if (typeof part.i !== "undefined" && tempObj[part.i]) {
            tempObj = tempObj[part.i];
          } else {
            var next = parsed[i + 1];
            propName = typeof part.p === "undefined" ? part.i : part.p;
            propVal = typeof next.p === "undefined" ? [] : {};
            tempObj[propName] = propVal;
            tempObj = tempObj[propName];
          }
        }
      }
      function getPathInfo(obj, path) {
        var parsed = parsePath(path);
        var last = parsed[parsed.length - 1];
        var info = {
          parent: parsed.length > 1 ? internalGetPathValue(obj, parsed, parsed.length - 1) : obj,
          name: last.p || last.i,
          value: internalGetPathValue(obj, parsed)
        };
        info.exists = hasProperty(info.parent, info.name);
        return info;
      }
      function getPathValue(obj, path) {
        var info = getPathInfo(obj, path);
        return info.value;
      }
      function setPathValue(obj, path, val) {
        var parsed = parsePath(path);
        internalSetPathValue(obj, val, parsed);
        return obj;
      }
      module.exports = {
        hasProperty,
        getPathInfo,
        getPathValue,
        setPathValue
      };
    }
  });

  // node_modules/chai/lib/chai/utils/flag.js
  var require_flag = __commonJS({
    "node_modules/chai/lib/chai/utils/flag.js"(exports, module) {
      module.exports = function flag(obj, key, value) {
        var flags = obj.__flags || (obj.__flags = /* @__PURE__ */ Object.create(null));
        if (arguments.length === 3) {
          flags[key] = value;
        } else {
          return flags[key];
        }
      };
    }
  });

  // node_modules/chai/lib/chai/utils/test.js
  var require_test = __commonJS({
    "node_modules/chai/lib/chai/utils/test.js"(exports, module) {
      var flag = require_flag();
      module.exports = function test(obj, args) {
        var negate = flag(obj, "negate"), expr = args[0];
        return negate ? !expr : expr;
      };
    }
  });

  // node_modules/type-detect/type-detect.js
  var require_type_detect = __commonJS({
    "node_modules/type-detect/type-detect.js"(exports, module) {
      (function(global2, factory) {
        typeof exports === "object" && typeof module !== "undefined" ? module.exports = factory() : typeof define === "function" && define.amd ? define(factory) : global2.typeDetect = factory();
      })(exports, function() {
        "use strict";
        var promiseExists = typeof Promise === "function";
        var globalObject = typeof self === "object" ? self : global;
        var symbolExists = typeof Symbol !== "undefined";
        var mapExists = typeof Map !== "undefined";
        var setExists = typeof Set !== "undefined";
        var weakMapExists = typeof WeakMap !== "undefined";
        var weakSetExists = typeof WeakSet !== "undefined";
        var dataViewExists = typeof DataView !== "undefined";
        var symbolIteratorExists = symbolExists && typeof Symbol.iterator !== "undefined";
        var symbolToStringTagExists = symbolExists && typeof Symbol.toStringTag !== "undefined";
        var setEntriesExists = setExists && typeof Set.prototype.entries === "function";
        var mapEntriesExists = mapExists && typeof Map.prototype.entries === "function";
        var setIteratorPrototype = setEntriesExists && Object.getPrototypeOf((/* @__PURE__ */ new Set()).entries());
        var mapIteratorPrototype = mapEntriesExists && Object.getPrototypeOf((/* @__PURE__ */ new Map()).entries());
        var arrayIteratorExists = symbolIteratorExists && typeof Array.prototype[Symbol.iterator] === "function";
        var arrayIteratorPrototype = arrayIteratorExists && Object.getPrototypeOf([][Symbol.iterator]());
        var stringIteratorExists = symbolIteratorExists && typeof String.prototype[Symbol.iterator] === "function";
        var stringIteratorPrototype = stringIteratorExists && Object.getPrototypeOf(""[Symbol.iterator]());
        var toStringLeftSliceLength = 8;
        var toStringRightSliceLength = -1;
        function typeDetect(obj) {
          var typeofObj = typeof obj;
          if (typeofObj !== "object") {
            return typeofObj;
          }
          if (obj === null) {
            return "null";
          }
          if (obj === globalObject) {
            return "global";
          }
          if (Array.isArray(obj) && (symbolToStringTagExists === false || !(Symbol.toStringTag in obj))) {
            return "Array";
          }
          if (typeof window === "object" && window !== null) {
            if (typeof window.location === "object" && obj === window.location) {
              return "Location";
            }
            if (typeof window.document === "object" && obj === window.document) {
              return "Document";
            }
            if (typeof window.navigator === "object") {
              if (typeof window.navigator.mimeTypes === "object" && obj === window.navigator.mimeTypes) {
                return "MimeTypeArray";
              }
              if (typeof window.navigator.plugins === "object" && obj === window.navigator.plugins) {
                return "PluginArray";
              }
            }
            if ((typeof window.HTMLElement === "function" || typeof window.HTMLElement === "object") && obj instanceof window.HTMLElement) {
              if (obj.tagName === "BLOCKQUOTE") {
                return "HTMLQuoteElement";
              }
              if (obj.tagName === "TD") {
                return "HTMLTableDataCellElement";
              }
              if (obj.tagName === "TH") {
                return "HTMLTableHeaderCellElement";
              }
            }
          }
          var stringTag = symbolToStringTagExists && obj[Symbol.toStringTag];
          if (typeof stringTag === "string") {
            return stringTag;
          }
          var objPrototype = Object.getPrototypeOf(obj);
          if (objPrototype === RegExp.prototype) {
            return "RegExp";
          }
          if (objPrototype === Date.prototype) {
            return "Date";
          }
          if (promiseExists && objPrototype === Promise.prototype) {
            return "Promise";
          }
          if (setExists && objPrototype === Set.prototype) {
            return "Set";
          }
          if (mapExists && objPrototype === Map.prototype) {
            return "Map";
          }
          if (weakSetExists && objPrototype === WeakSet.prototype) {
            return "WeakSet";
          }
          if (weakMapExists && objPrototype === WeakMap.prototype) {
            return "WeakMap";
          }
          if (dataViewExists && objPrototype === DataView.prototype) {
            return "DataView";
          }
          if (mapExists && objPrototype === mapIteratorPrototype) {
            return "Map Iterator";
          }
          if (setExists && objPrototype === setIteratorPrototype) {
            return "Set Iterator";
          }
          if (arrayIteratorExists && objPrototype === arrayIteratorPrototype) {
            return "Array Iterator";
          }
          if (stringIteratorExists && objPrototype === stringIteratorPrototype) {
            return "String Iterator";
          }
          if (objPrototype === null) {
            return "Object";
          }
          return Object.prototype.toString.call(obj).slice(toStringLeftSliceLength, toStringRightSliceLength);
        }
        return typeDetect;
      });
    }
  });

  // node_modules/chai/lib/chai/utils/expectTypes.js
  var require_expectTypes = __commonJS({
    "node_modules/chai/lib/chai/utils/expectTypes.js"(exports, module) {
      var AssertionError = require_assertion_error();
      var flag = require_flag();
      var type = require_type_detect();
      module.exports = function expectTypes(obj, types) {
        var flagMsg = flag(obj, "message");
        var ssfi = flag(obj, "ssfi");
        flagMsg = flagMsg ? flagMsg + ": " : "";
        obj = flag(obj, "object");
        types = types.map(function(t) {
          return t.toLowerCase();
        });
        types.sort();
        var str = types.map(function(t, index) {
          var art = ~["a", "e", "i", "o", "u"].indexOf(t.charAt(0)) ? "an" : "a";
          var or = types.length > 1 && index === types.length - 1 ? "or " : "";
          return or + art + " " + t;
        }).join(", ");
        var objType = type(obj).toLowerCase();
        if (!types.some(function(expected) {
          return objType === expected;
        })) {
          throw new AssertionError(flagMsg + "object tested must be " + str + ", but " + objType + " given", void 0, ssfi);
        }
      };
    }
  });

  // node_modules/chai/lib/chai/utils/getActual.js
  var require_getActual = __commonJS({
    "node_modules/chai/lib/chai/utils/getActual.js"(exports, module) {
      module.exports = function getActual(obj, args) {
        return args.length > 4 ? args[4] : obj._obj;
      };
    }
  });

  // node_modules/get-func-name/index.js
  var require_get_func_name = __commonJS({
    "node_modules/get-func-name/index.js"(exports, module) {
      "use strict";
      var toString = Function.prototype.toString;
      var functionNameMatch = /\s*function(?:\s|\s*\/\*[^(?:*\/)]+\*\/\s*)*([^\s\(\/]+)/;
      function getFuncName(aFunc) {
        if (typeof aFunc !== "function") {
          return null;
        }
        var name = "";
        if (typeof Function.prototype.name === "undefined" && typeof aFunc.name === "undefined") {
          var match = toString.call(aFunc).match(functionNameMatch);
          if (match) {
            name = match[1];
          }
        } else {
          name = aFunc.name;
        }
        return name;
      }
      module.exports = getFuncName;
    }
  });

  // (disabled):util
  var require_util = __commonJS({
    "(disabled):util"() {
    }
  });

  // node_modules/loupe/loupe.js
  var require_loupe = __commonJS({
    "node_modules/loupe/loupe.js"(exports, module) {
      (function(global2, factory) {
        typeof exports === "object" && typeof module !== "undefined" ? factory(exports) : typeof define === "function" && define.amd ? define(["exports"], factory) : (global2 = typeof globalThis !== "undefined" ? globalThis : global2 || self, factory(global2.loupe = {}));
      })(exports, function(exports2) {
        "use strict";
        function _typeof(obj) {
          "@babel/helpers - typeof";
          if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
            _typeof = function(obj2) {
              return typeof obj2;
            };
          } else {
            _typeof = function(obj2) {
              return obj2 && typeof Symbol === "function" && obj2.constructor === Symbol && obj2 !== Symbol.prototype ? "symbol" : typeof obj2;
            };
          }
          return _typeof(obj);
        }
        function _slicedToArray(arr, i) {
          return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest();
        }
        function _arrayWithHoles(arr) {
          if (Array.isArray(arr))
            return arr;
        }
        function _iterableToArrayLimit(arr, i) {
          if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr)))
            return;
          var _arr = [];
          var _n = true;
          var _d = false;
          var _e = void 0;
          try {
            for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
              _arr.push(_s.value);
              if (i && _arr.length === i)
                break;
            }
          } catch (err) {
            _d = true;
            _e = err;
          } finally {
            try {
              if (!_n && _i["return"] != null)
                _i["return"]();
            } finally {
              if (_d)
                throw _e;
            }
          }
          return _arr;
        }
        function _unsupportedIterableToArray(o, minLen) {
          if (!o)
            return;
          if (typeof o === "string")
            return _arrayLikeToArray(o, minLen);
          var n = Object.prototype.toString.call(o).slice(8, -1);
          if (n === "Object" && o.constructor)
            n = o.constructor.name;
          if (n === "Map" || n === "Set")
            return Array.from(o);
          if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))
            return _arrayLikeToArray(o, minLen);
        }
        function _arrayLikeToArray(arr, len) {
          if (len == null || len > arr.length)
            len = arr.length;
          for (var i = 0, arr2 = new Array(len); i < len; i++)
            arr2[i] = arr[i];
          return arr2;
        }
        function _nonIterableRest() {
          throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
        }
        var ansiColors = {
          bold: ["1", "22"],
          dim: ["2", "22"],
          italic: ["3", "23"],
          underline: ["4", "24"],
          inverse: ["7", "27"],
          hidden: ["8", "28"],
          strike: ["9", "29"],
          black: ["30", "39"],
          red: ["31", "39"],
          green: ["32", "39"],
          yellow: ["33", "39"],
          blue: ["34", "39"],
          magenta: ["35", "39"],
          cyan: ["36", "39"],
          white: ["37", "39"],
          brightblack: ["30;1", "39"],
          brightred: ["31;1", "39"],
          brightgreen: ["32;1", "39"],
          brightyellow: ["33;1", "39"],
          brightblue: ["34;1", "39"],
          brightmagenta: ["35;1", "39"],
          brightcyan: ["36;1", "39"],
          brightwhite: ["37;1", "39"],
          grey: ["90", "39"]
        };
        var styles = {
          special: "cyan",
          number: "yellow",
          bigint: "yellow",
          boolean: "yellow",
          undefined: "grey",
          null: "bold",
          string: "green",
          symbol: "green",
          date: "magenta",
          regexp: "red"
        };
        var truncator = "\u2026";
        function colorise(value, styleType) {
          var color = ansiColors[styles[styleType]] || ansiColors[styleType];
          if (!color) {
            return String(value);
          }
          return "\x1B[".concat(color[0], "m").concat(String(value), "\x1B[").concat(color[1], "m");
        }
        function normaliseOptions() {
          var _ref = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, _ref$showHidden = _ref.showHidden, showHidden = _ref$showHidden === void 0 ? false : _ref$showHidden, _ref$depth = _ref.depth, depth = _ref$depth === void 0 ? 2 : _ref$depth, _ref$colors = _ref.colors, colors = _ref$colors === void 0 ? false : _ref$colors, _ref$customInspect = _ref.customInspect, customInspect = _ref$customInspect === void 0 ? true : _ref$customInspect, _ref$showProxy = _ref.showProxy, showProxy = _ref$showProxy === void 0 ? false : _ref$showProxy, _ref$maxArrayLength = _ref.maxArrayLength, maxArrayLength = _ref$maxArrayLength === void 0 ? Infinity : _ref$maxArrayLength, _ref$breakLength = _ref.breakLength, breakLength = _ref$breakLength === void 0 ? Infinity : _ref$breakLength, _ref$seen = _ref.seen, seen = _ref$seen === void 0 ? [] : _ref$seen, _ref$truncate = _ref.truncate, truncate2 = _ref$truncate === void 0 ? Infinity : _ref$truncate, _ref$stylize = _ref.stylize, stylize = _ref$stylize === void 0 ? String : _ref$stylize;
          var options = {
            showHidden: Boolean(showHidden),
            depth: Number(depth),
            colors: Boolean(colors),
            customInspect: Boolean(customInspect),
            showProxy: Boolean(showProxy),
            maxArrayLength: Number(maxArrayLength),
            breakLength: Number(breakLength),
            truncate: Number(truncate2),
            seen,
            stylize
          };
          if (options.colors) {
            options.stylize = colorise;
          }
          return options;
        }
        function truncate(string, length) {
          var tail = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : truncator;
          string = String(string);
          var tailLength = tail.length;
          var stringLength = string.length;
          if (tailLength > length && stringLength > tailLength) {
            return tail;
          }
          if (stringLength > length && stringLength > tailLength) {
            return "".concat(string.slice(0, length - tailLength)).concat(tail);
          }
          return string;
        }
        function inspectList(list, options, inspectItem) {
          var separator = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : ", ";
          inspectItem = inspectItem || options.inspect;
          var size = list.length;
          if (size === 0)
            return "";
          var originalLength = options.truncate;
          var output = "";
          var peek = "";
          var truncated = "";
          for (var i = 0; i < size; i += 1) {
            var last = i + 1 === list.length;
            var secondToLast = i + 2 === list.length;
            truncated = "".concat(truncator, "(").concat(list.length - i, ")");
            var value = list[i];
            options.truncate = originalLength - output.length - (last ? 0 : separator.length);
            var string = peek || inspectItem(value, options) + (last ? "" : separator);
            var nextLength = output.length + string.length;
            var truncatedLength = nextLength + truncated.length;
            if (last && nextLength > originalLength && output.length + truncated.length <= originalLength) {
              break;
            }
            if (!last && !secondToLast && truncatedLength > originalLength) {
              break;
            }
            peek = last ? "" : inspectItem(list[i + 1], options) + (secondToLast ? "" : separator);
            if (!last && secondToLast && truncatedLength > originalLength && nextLength + peek.length > originalLength) {
              break;
            }
            output += string;
            if (!last && !secondToLast && nextLength + peek.length >= originalLength) {
              truncated = "".concat(truncator, "(").concat(list.length - i - 1, ")");
              break;
            }
            truncated = "";
          }
          return "".concat(output).concat(truncated);
        }
        function quoteComplexKey(key) {
          if (key.match(/^[a-zA-Z_][a-zA-Z_0-9]*$/)) {
            return key;
          }
          return JSON.stringify(key).replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
        }
        function inspectProperty(_ref2, options) {
          var _ref3 = _slicedToArray(_ref2, 2), key = _ref3[0], value = _ref3[1];
          options.truncate -= 2;
          if (typeof key === "string") {
            key = quoteComplexKey(key);
          } else if (typeof key !== "number") {
            key = "[".concat(options.inspect(key, options), "]");
          }
          options.truncate -= key.length;
          value = options.inspect(value, options);
          return "".concat(key, ": ").concat(value);
        }
        function inspectArray(array, options) {
          var nonIndexProperties = Object.keys(array).slice(array.length);
          if (!array.length && !nonIndexProperties.length)
            return "[]";
          options.truncate -= 4;
          var listContents = inspectList(array, options);
          options.truncate -= listContents.length;
          var propertyContents = "";
          if (nonIndexProperties.length) {
            propertyContents = inspectList(nonIndexProperties.map(function(key) {
              return [key, array[key]];
            }), options, inspectProperty);
          }
          return "[ ".concat(listContents).concat(propertyContents ? ", ".concat(propertyContents) : "", " ]");
        }
        var toString = Function.prototype.toString;
        var functionNameMatch = /\s*function(?:\s|\s*\/\*[^(?:*\/)]+\*\/\s*)*([^\s\(\/]+)/;
        function getFuncName(aFunc) {
          if (typeof aFunc !== "function") {
            return null;
          }
          var name = "";
          if (typeof Function.prototype.name === "undefined" && typeof aFunc.name === "undefined") {
            var match = toString.call(aFunc).match(functionNameMatch);
            if (match) {
              name = match[1];
            }
          } else {
            name = aFunc.name;
          }
          return name;
        }
        var getFuncName_1 = getFuncName;
        var getArrayName = function getArrayName2(array) {
          if (typeof Buffer === "function" && array instanceof Buffer) {
            return "Buffer";
          }
          if (array[Symbol.toStringTag]) {
            return array[Symbol.toStringTag];
          }
          return getFuncName_1(array.constructor);
        };
        function inspectTypedArray(array, options) {
          var name = getArrayName(array);
          options.truncate -= name.length + 4;
          var nonIndexProperties = Object.keys(array).slice(array.length);
          if (!array.length && !nonIndexProperties.length)
            return "".concat(name, "[]");
          var output = "";
          for (var i = 0; i < array.length; i++) {
            var string = "".concat(options.stylize(truncate(array[i], options.truncate), "number")).concat(i === array.length - 1 ? "" : ", ");
            options.truncate -= string.length;
            if (array[i] !== array.length && options.truncate <= 3) {
              output += "".concat(truncator, "(").concat(array.length - array[i] + 1, ")");
              break;
            }
            output += string;
          }
          var propertyContents = "";
          if (nonIndexProperties.length) {
            propertyContents = inspectList(nonIndexProperties.map(function(key) {
              return [key, array[key]];
            }), options, inspectProperty);
          }
          return "".concat(name, "[ ").concat(output).concat(propertyContents ? ", ".concat(propertyContents) : "", " ]");
        }
        function inspectDate(dateObject, options) {
          var split = dateObject.toJSON().split("T");
          var date = split[0];
          return options.stylize("".concat(date, "T").concat(truncate(split[1], options.truncate - date.length - 1)), "date");
        }
        function inspectFunction(func, options) {
          var name = getFuncName_1(func);
          if (!name) {
            return options.stylize("[Function]", "special");
          }
          return options.stylize("[Function ".concat(truncate(name, options.truncate - 11), "]"), "special");
        }
        function inspectMapEntry(_ref, options) {
          var _ref2 = _slicedToArray(_ref, 2), key = _ref2[0], value = _ref2[1];
          options.truncate -= 4;
          key = options.inspect(key, options);
          options.truncate -= key.length;
          value = options.inspect(value, options);
          return "".concat(key, " => ").concat(value);
        }
        function mapToEntries(map) {
          var entries = [];
          map.forEach(function(value, key) {
            entries.push([key, value]);
          });
          return entries;
        }
        function inspectMap(map, options) {
          var size = map.size - 1;
          if (size <= 0) {
            return "Map{}";
          }
          options.truncate -= 7;
          return "Map{ ".concat(inspectList(mapToEntries(map), options, inspectMapEntry), " }");
        }
        var isNaN = Number.isNaN || function(i) {
          return i !== i;
        };
        function inspectNumber(number, options) {
          if (isNaN(number)) {
            return options.stylize("NaN", "number");
          }
          if (number === Infinity) {
            return options.stylize("Infinity", "number");
          }
          if (number === -Infinity) {
            return options.stylize("-Infinity", "number");
          }
          if (number === 0) {
            return options.stylize(1 / number === Infinity ? "+0" : "-0", "number");
          }
          return options.stylize(truncate(number, options.truncate), "number");
        }
        function inspectBigInt(number, options) {
          var nums = truncate(number.toString(), options.truncate - 1);
          if (nums !== truncator)
            nums += "n";
          return options.stylize(nums, "bigint");
        }
        function inspectRegExp(value, options) {
          var flags = value.toString().split("/")[2];
          var sourceLength = options.truncate - (2 + flags.length);
          var source = value.source;
          return options.stylize("/".concat(truncate(source, sourceLength), "/").concat(flags), "regexp");
        }
        function arrayFromSet(set) {
          var values = [];
          set.forEach(function(value) {
            values.push(value);
          });
          return values;
        }
        function inspectSet(set, options) {
          if (set.size === 0)
            return "Set{}";
          options.truncate -= 7;
          return "Set{ ".concat(inspectList(arrayFromSet(set), options), " }");
        }
        var stringEscapeChars = new RegExp("['\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\uffff]", "g");
        var escapeCharacters = {
          "\b": "\\b",
          "	": "\\t",
          "\n": "\\n",
          "\f": "\\f",
          "\r": "\\r",
          "'": "\\'",
          "\\": "\\\\"
        };
        var hex = 16;
        var unicodeLength = 4;
        function escape(char) {
          return escapeCharacters[char] || "\\u".concat("0000".concat(char.charCodeAt(0).toString(hex)).slice(-unicodeLength));
        }
        function inspectString(string, options) {
          if (stringEscapeChars.test(string)) {
            string = string.replace(stringEscapeChars, escape);
          }
          return options.stylize("'".concat(truncate(string, options.truncate - 2), "'"), "string");
        }
        function inspectSymbol(value) {
          if ("description" in Symbol.prototype) {
            return value.description ? "Symbol(".concat(value.description, ")") : "Symbol()";
          }
          return value.toString();
        }
        var getPromiseValue = function getPromiseValue2() {
          return "Promise{\u2026}";
        };
        try {
          var _process$binding = process.binding("util"), getPromiseDetails = _process$binding.getPromiseDetails, kPending = _process$binding.kPending, kRejected = _process$binding.kRejected;
          if (Array.isArray(getPromiseDetails(Promise.resolve()))) {
            getPromiseValue = function getPromiseValue2(value, options) {
              var _getPromiseDetails = getPromiseDetails(value), _getPromiseDetails2 = _slicedToArray(_getPromiseDetails, 2), state = _getPromiseDetails2[0], innerValue = _getPromiseDetails2[1];
              if (state === kPending) {
                return "Promise{<pending>}";
              }
              return "Promise".concat(state === kRejected ? "!" : "", "{").concat(options.inspect(innerValue, options), "}");
            };
          }
        } catch (notNode) {
        }
        var inspectPromise = getPromiseValue;
        function inspectObject(object, options) {
          var properties = Object.getOwnPropertyNames(object);
          var symbols = Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(object) : [];
          if (properties.length === 0 && symbols.length === 0) {
            return "{}";
          }
          options.truncate -= 4;
          options.seen = options.seen || [];
          if (options.seen.indexOf(object) >= 0) {
            return "[Circular]";
          }
          options.seen.push(object);
          var propertyContents = inspectList(properties.map(function(key) {
            return [key, object[key]];
          }), options, inspectProperty);
          var symbolContents = inspectList(symbols.map(function(key) {
            return [key, object[key]];
          }), options, inspectProperty);
          options.seen.pop();
          var sep = "";
          if (propertyContents && symbolContents) {
            sep = ", ";
          }
          return "{ ".concat(propertyContents).concat(sep).concat(symbolContents, " }");
        }
        var toStringTag = typeof Symbol !== "undefined" && Symbol.toStringTag ? Symbol.toStringTag : false;
        function inspectClass(value, options) {
          var name = "";
          if (toStringTag && toStringTag in value) {
            name = value[toStringTag];
          }
          name = name || getFuncName_1(value.constructor);
          if (!name || name === "_class") {
            name = "<Anonymous Class>";
          }
          options.truncate -= name.length;
          return "".concat(name).concat(inspectObject(value, options));
        }
        function inspectArguments(args, options) {
          if (args.length === 0)
            return "Arguments[]";
          options.truncate -= 13;
          return "Arguments[ ".concat(inspectList(args, options), " ]");
        }
        var errorKeys = ["stack", "line", "column", "name", "message", "fileName", "lineNumber", "columnNumber", "number", "description"];
        function inspectObject$1(error, options) {
          var properties = Object.getOwnPropertyNames(error).filter(function(key) {
            return errorKeys.indexOf(key) === -1;
          });
          var name = error.name;
          options.truncate -= name.length;
          var message = "";
          if (typeof error.message === "string") {
            message = truncate(error.message, options.truncate);
          } else {
            properties.unshift("message");
          }
          message = message ? ": ".concat(message) : "";
          options.truncate -= message.length + 5;
          var propertyContents = inspectList(properties.map(function(key) {
            return [key, error[key]];
          }), options, inspectProperty);
          return "".concat(name).concat(message).concat(propertyContents ? " { ".concat(propertyContents, " }") : "");
        }
        function inspectAttribute(_ref, options) {
          var _ref2 = _slicedToArray(_ref, 2), key = _ref2[0], value = _ref2[1];
          options.truncate -= 3;
          if (!value) {
            return "".concat(options.stylize(key, "yellow"));
          }
          return "".concat(options.stylize(key, "yellow"), "=").concat(options.stylize('"'.concat(value, '"'), "string"));
        }
        function inspectHTMLCollection(collection, options) {
          return inspectList(collection, options, inspectHTML, "\n");
        }
        function inspectHTML(element, options) {
          var properties = element.getAttributeNames();
          var name = element.tagName.toLowerCase();
          var head = options.stylize("<".concat(name), "special");
          var headClose = options.stylize(">", "special");
          var tail = options.stylize("</".concat(name, ">"), "special");
          options.truncate -= name.length * 2 + 5;
          var propertyContents = "";
          if (properties.length > 0) {
            propertyContents += " ";
            propertyContents += inspectList(properties.map(function(key) {
              return [key, element.getAttribute(key)];
            }), options, inspectAttribute, " ");
          }
          options.truncate -= propertyContents.length;
          var truncate2 = options.truncate;
          var children = inspectHTMLCollection(element.children, options);
          if (children && children.length > truncate2) {
            children = "".concat(truncator, "(").concat(element.children.length, ")");
          }
          return "".concat(head).concat(propertyContents).concat(headClose).concat(children).concat(tail);
        }
        var symbolsSupported = typeof Symbol === "function" && typeof Symbol.for === "function";
        var chaiInspect = symbolsSupported ? Symbol.for("chai/inspect") : "@@chai/inspect";
        var nodeInspect = false;
        try {
          var nodeUtil = require_util();
          nodeInspect = nodeUtil.inspect ? nodeUtil.inspect.custom : false;
        } catch (noNodeInspect) {
          nodeInspect = false;
        }
        var constructorMap = /* @__PURE__ */ new WeakMap();
        var stringTagMap = {};
        var baseTypesMap = {
          undefined: function undefined$1(value, options) {
            return options.stylize("undefined", "undefined");
          },
          null: function _null(value, options) {
            return options.stylize(null, "null");
          },
          boolean: function boolean(value, options) {
            return options.stylize(value, "boolean");
          },
          Boolean: function Boolean2(value, options) {
            return options.stylize(value, "boolean");
          },
          number: inspectNumber,
          Number: inspectNumber,
          bigint: inspectBigInt,
          BigInt: inspectBigInt,
          string: inspectString,
          String: inspectString,
          function: inspectFunction,
          Function: inspectFunction,
          symbol: inspectSymbol,
          Symbol: inspectSymbol,
          Array: inspectArray,
          Date: inspectDate,
          Map: inspectMap,
          Set: inspectSet,
          RegExp: inspectRegExp,
          Promise: inspectPromise,
          WeakSet: function WeakSet2(value, options) {
            return options.stylize("WeakSet{\u2026}", "special");
          },
          WeakMap: function WeakMap2(value, options) {
            return options.stylize("WeakMap{\u2026}", "special");
          },
          Arguments: inspectArguments,
          Int8Array: inspectTypedArray,
          Uint8Array: inspectTypedArray,
          Uint8ClampedArray: inspectTypedArray,
          Int16Array: inspectTypedArray,
          Uint16Array: inspectTypedArray,
          Int32Array: inspectTypedArray,
          Uint32Array: inspectTypedArray,
          Float32Array: inspectTypedArray,
          Float64Array: inspectTypedArray,
          Generator: function Generator() {
            return "";
          },
          DataView: function DataView2() {
            return "";
          },
          ArrayBuffer: function ArrayBuffer() {
            return "";
          },
          Error: inspectObject$1,
          HTMLCollection: inspectHTMLCollection,
          NodeList: inspectHTMLCollection
        };
        var inspectCustom = function inspectCustom2(value, options, type) {
          if (chaiInspect in value && typeof value[chaiInspect] === "function") {
            return value[chaiInspect](options);
          }
          if (nodeInspect && nodeInspect in value && typeof value[nodeInspect] === "function") {
            return value[nodeInspect](options.depth, options);
          }
          if ("inspect" in value && typeof value.inspect === "function") {
            return value.inspect(options.depth, options);
          }
          if ("constructor" in value && constructorMap.has(value.constructor)) {
            return constructorMap.get(value.constructor)(value, options);
          }
          if (stringTagMap[type]) {
            return stringTagMap[type](value, options);
          }
          return "";
        };
        var toString$1 = Object.prototype.toString;
        function inspect(value, options) {
          options = normaliseOptions(options);
          options.inspect = inspect;
          var _options = options, customInspect = _options.customInspect;
          var type = value === null ? "null" : _typeof(value);
          if (type === "object") {
            type = toString$1.call(value).slice(8, -1);
          }
          if (baseTypesMap[type]) {
            return baseTypesMap[type](value, options);
          }
          if (customInspect && value) {
            var output = inspectCustom(value, options, type);
            if (output) {
              if (typeof output === "string")
                return output;
              return inspect(output, options);
            }
          }
          var proto = value ? Object.getPrototypeOf(value) : false;
          if (proto === Object.prototype || proto === null) {
            return inspectObject(value, options);
          }
          if (value && typeof HTMLElement === "function" && value instanceof HTMLElement) {
            return inspectHTML(value, options);
          }
          if ("constructor" in value) {
            if (value.constructor !== Object) {
              return inspectClass(value, options);
            }
            return inspectObject(value, options);
          }
          if (value === Object(value)) {
            return inspectObject(value, options);
          }
          return options.stylize(String(value), type);
        }
        function registerConstructor(constructor, inspector) {
          if (constructorMap.has(constructor)) {
            return false;
          }
          constructorMap.add(constructor, inspector);
          return true;
        }
        function registerStringTag(stringTag, inspector) {
          if (stringTag in stringTagMap) {
            return false;
          }
          stringTagMap[stringTag] = inspector;
          return true;
        }
        var custom = chaiInspect;
        exports2.custom = custom;
        exports2.default = inspect;
        exports2.inspect = inspect;
        exports2.registerConstructor = registerConstructor;
        exports2.registerStringTag = registerStringTag;
        Object.defineProperty(exports2, "__esModule", { value: true });
      });
    }
  });

  // node_modules/chai/lib/chai/config.js
  var require_config = __commonJS({
    "node_modules/chai/lib/chai/config.js"(exports, module) {
      module.exports = {
        includeStack: false,
        showDiff: true,
        truncateThreshold: 40,
        useProxy: true,
        proxyExcludedKeys: ["then", "catch", "inspect", "toJSON"]
      };
    }
  });

  // node_modules/chai/lib/chai/utils/inspect.js
  var require_inspect = __commonJS({
    "node_modules/chai/lib/chai/utils/inspect.js"(exports, module) {
      var getName = require_get_func_name();
      var loupe = require_loupe();
      var config = require_config();
      module.exports = inspect;
      function inspect(obj, showHidden, depth, colors) {
        var options = {
          colors,
          depth: typeof depth === "undefined" ? 2 : depth,
          showHidden,
          truncate: config.truncateThreshold ? config.truncateThreshold : Infinity
        };
        return loupe.inspect(obj, options);
      }
    }
  });

  // node_modules/chai/lib/chai/utils/objDisplay.js
  var require_objDisplay = __commonJS({
    "node_modules/chai/lib/chai/utils/objDisplay.js"(exports, module) {
      var inspect = require_inspect();
      var config = require_config();
      module.exports = function objDisplay(obj) {
        var str = inspect(obj), type = Object.prototype.toString.call(obj);
        if (config.truncateThreshold && str.length >= config.truncateThreshold) {
          if (type === "[object Function]") {
            return !obj.name || obj.name === "" ? "[Function]" : "[Function: " + obj.name + "]";
          } else if (type === "[object Array]") {
            return "[ Array(" + obj.length + ") ]";
          } else if (type === "[object Object]") {
            var keys = Object.keys(obj), kstr = keys.length > 2 ? keys.splice(0, 2).join(", ") + ", ..." : keys.join(", ");
            return "{ Object (" + kstr + ") }";
          } else {
            return str;
          }
        } else {
          return str;
        }
      };
    }
  });

  // node_modules/chai/lib/chai/utils/getMessage.js
  var require_getMessage = __commonJS({
    "node_modules/chai/lib/chai/utils/getMessage.js"(exports, module) {
      var flag = require_flag();
      var getActual = require_getActual();
      var objDisplay = require_objDisplay();
      module.exports = function getMessage(obj, args) {
        var negate = flag(obj, "negate"), val = flag(obj, "object"), expected = args[3], actual = getActual(obj, args), msg = negate ? args[2] : args[1], flagMsg = flag(obj, "message");
        if (typeof msg === "function")
          msg = msg();
        msg = msg || "";
        msg = msg.replace(/#\{this\}/g, function() {
          return objDisplay(val);
        }).replace(/#\{act\}/g, function() {
          return objDisplay(actual);
        }).replace(/#\{exp\}/g, function() {
          return objDisplay(expected);
        });
        return flagMsg ? flagMsg + ": " + msg : msg;
      };
    }
  });

  // node_modules/chai/lib/chai/utils/transferFlags.js
  var require_transferFlags = __commonJS({
    "node_modules/chai/lib/chai/utils/transferFlags.js"(exports, module) {
      module.exports = function transferFlags(assertion, object, includeAll) {
        var flags = assertion.__flags || (assertion.__flags = /* @__PURE__ */ Object.create(null));
        if (!object.__flags) {
          object.__flags = /* @__PURE__ */ Object.create(null);
        }
        includeAll = arguments.length === 3 ? includeAll : true;
        for (var flag in flags) {
          if (includeAll || flag !== "object" && flag !== "ssfi" && flag !== "lockSsfi" && flag != "message") {
            object.__flags[flag] = flags[flag];
          }
        }
      };
    }
  });

  // node_modules/deep-eql/index.js
  var require_deep_eql = __commonJS({
    "node_modules/deep-eql/index.js"(exports, module) {
      "use strict";
      var type = require_type_detect();
      function FakeMap() {
        this._key = "chai/deep-eql__" + Math.random() + Date.now();
      }
      FakeMap.prototype = {
        get: function getMap(key) {
          return key[this._key];
        },
        set: function setMap(key, value) {
          if (Object.isExtensible(key)) {
            Object.defineProperty(key, this._key, {
              value,
              configurable: true
            });
          }
        }
      };
      var MemoizeMap = typeof WeakMap === "function" ? WeakMap : FakeMap;
      function memoizeCompare(leftHandOperand, rightHandOperand, memoizeMap) {
        if (!memoizeMap || isPrimitive(leftHandOperand) || isPrimitive(rightHandOperand)) {
          return null;
        }
        var leftHandMap = memoizeMap.get(leftHandOperand);
        if (leftHandMap) {
          var result = leftHandMap.get(rightHandOperand);
          if (typeof result === "boolean") {
            return result;
          }
        }
        return null;
      }
      function memoizeSet(leftHandOperand, rightHandOperand, memoizeMap, result) {
        if (!memoizeMap || isPrimitive(leftHandOperand) || isPrimitive(rightHandOperand)) {
          return;
        }
        var leftHandMap = memoizeMap.get(leftHandOperand);
        if (leftHandMap) {
          leftHandMap.set(rightHandOperand, result);
        } else {
          leftHandMap = new MemoizeMap();
          leftHandMap.set(rightHandOperand, result);
          memoizeMap.set(leftHandOperand, leftHandMap);
        }
      }
      module.exports = deepEqual;
      module.exports.MemoizeMap = MemoizeMap;
      function deepEqual(leftHandOperand, rightHandOperand, options) {
        if (options && options.comparator) {
          return extensiveDeepEqual(leftHandOperand, rightHandOperand, options);
        }
        var simpleResult = simpleEqual(leftHandOperand, rightHandOperand);
        if (simpleResult !== null) {
          return simpleResult;
        }
        return extensiveDeepEqual(leftHandOperand, rightHandOperand, options);
      }
      function simpleEqual(leftHandOperand, rightHandOperand) {
        if (leftHandOperand === rightHandOperand) {
          return leftHandOperand !== 0 || 1 / leftHandOperand === 1 / rightHandOperand;
        }
        if (leftHandOperand !== leftHandOperand && rightHandOperand !== rightHandOperand) {
          return true;
        }
        if (isPrimitive(leftHandOperand) || isPrimitive(rightHandOperand)) {
          return false;
        }
        return null;
      }
      function extensiveDeepEqual(leftHandOperand, rightHandOperand, options) {
        options = options || {};
        options.memoize = options.memoize === false ? false : options.memoize || new MemoizeMap();
        var comparator = options && options.comparator;
        var memoizeResultLeft = memoizeCompare(leftHandOperand, rightHandOperand, options.memoize);
        if (memoizeResultLeft !== null) {
          return memoizeResultLeft;
        }
        var memoizeResultRight = memoizeCompare(rightHandOperand, leftHandOperand, options.memoize);
        if (memoizeResultRight !== null) {
          return memoizeResultRight;
        }
        if (comparator) {
          var comparatorResult = comparator(leftHandOperand, rightHandOperand);
          if (comparatorResult === false || comparatorResult === true) {
            memoizeSet(leftHandOperand, rightHandOperand, options.memoize, comparatorResult);
            return comparatorResult;
          }
          var simpleResult = simpleEqual(leftHandOperand, rightHandOperand);
          if (simpleResult !== null) {
            return simpleResult;
          }
        }
        var leftHandType = type(leftHandOperand);
        if (leftHandType !== type(rightHandOperand)) {
          memoizeSet(leftHandOperand, rightHandOperand, options.memoize, false);
          return false;
        }
        memoizeSet(leftHandOperand, rightHandOperand, options.memoize, true);
        var result = extensiveDeepEqualByType(leftHandOperand, rightHandOperand, leftHandType, options);
        memoizeSet(leftHandOperand, rightHandOperand, options.memoize, result);
        return result;
      }
      function extensiveDeepEqualByType(leftHandOperand, rightHandOperand, leftHandType, options) {
        switch (leftHandType) {
          case "String":
          case "Number":
          case "Boolean":
          case "Date":
            return deepEqual(leftHandOperand.valueOf(), rightHandOperand.valueOf());
          case "Promise":
          case "Symbol":
          case "function":
          case "WeakMap":
          case "WeakSet":
          case "Error":
            return leftHandOperand === rightHandOperand;
          case "Arguments":
          case "Int8Array":
          case "Uint8Array":
          case "Uint8ClampedArray":
          case "Int16Array":
          case "Uint16Array":
          case "Int32Array":
          case "Uint32Array":
          case "Float32Array":
          case "Float64Array":
          case "Array":
            return iterableEqual(leftHandOperand, rightHandOperand, options);
          case "RegExp":
            return regexpEqual(leftHandOperand, rightHandOperand);
          case "Generator":
            return generatorEqual(leftHandOperand, rightHandOperand, options);
          case "DataView":
            return iterableEqual(new Uint8Array(leftHandOperand.buffer), new Uint8Array(rightHandOperand.buffer), options);
          case "ArrayBuffer":
            return iterableEqual(new Uint8Array(leftHandOperand), new Uint8Array(rightHandOperand), options);
          case "Set":
            return entriesEqual(leftHandOperand, rightHandOperand, options);
          case "Map":
            return entriesEqual(leftHandOperand, rightHandOperand, options);
          default:
            return objectEqual(leftHandOperand, rightHandOperand, options);
        }
      }
      function regexpEqual(leftHandOperand, rightHandOperand) {
        return leftHandOperand.toString() === rightHandOperand.toString();
      }
      function entriesEqual(leftHandOperand, rightHandOperand, options) {
        if (leftHandOperand.size !== rightHandOperand.size) {
          return false;
        }
        if (leftHandOperand.size === 0) {
          return true;
        }
        var leftHandItems = [];
        var rightHandItems = [];
        leftHandOperand.forEach(function gatherEntries(key, value) {
          leftHandItems.push([key, value]);
        });
        rightHandOperand.forEach(function gatherEntries(key, value) {
          rightHandItems.push([key, value]);
        });
        return iterableEqual(leftHandItems.sort(), rightHandItems.sort(), options);
      }
      function iterableEqual(leftHandOperand, rightHandOperand, options) {
        var length = leftHandOperand.length;
        if (length !== rightHandOperand.length) {
          return false;
        }
        if (length === 0) {
          return true;
        }
        var index = -1;
        while (++index < length) {
          if (deepEqual(leftHandOperand[index], rightHandOperand[index], options) === false) {
            return false;
          }
        }
        return true;
      }
      function generatorEqual(leftHandOperand, rightHandOperand, options) {
        return iterableEqual(getGeneratorEntries(leftHandOperand), getGeneratorEntries(rightHandOperand), options);
      }
      function hasIteratorFunction(target) {
        return typeof Symbol !== "undefined" && typeof target === "object" && typeof Symbol.iterator !== "undefined" && typeof target[Symbol.iterator] === "function";
      }
      function getIteratorEntries(target) {
        if (hasIteratorFunction(target)) {
          try {
            return getGeneratorEntries(target[Symbol.iterator]());
          } catch (iteratorError) {
            return [];
          }
        }
        return [];
      }
      function getGeneratorEntries(generator) {
        var generatorResult = generator.next();
        var accumulator = [generatorResult.value];
        while (generatorResult.done === false) {
          generatorResult = generator.next();
          accumulator.push(generatorResult.value);
        }
        return accumulator;
      }
      function getEnumerableKeys(target) {
        var keys = [];
        for (var key in target) {
          keys.push(key);
        }
        return keys;
      }
      function keysEqual(leftHandOperand, rightHandOperand, keys, options) {
        var length = keys.length;
        if (length === 0) {
          return true;
        }
        for (var i = 0; i < length; i += 1) {
          if (deepEqual(leftHandOperand[keys[i]], rightHandOperand[keys[i]], options) === false) {
            return false;
          }
        }
        return true;
      }
      function objectEqual(leftHandOperand, rightHandOperand, options) {
        var leftHandKeys = getEnumerableKeys(leftHandOperand);
        var rightHandKeys = getEnumerableKeys(rightHandOperand);
        if (leftHandKeys.length && leftHandKeys.length === rightHandKeys.length) {
          leftHandKeys.sort();
          rightHandKeys.sort();
          if (iterableEqual(leftHandKeys, rightHandKeys) === false) {
            return false;
          }
          return keysEqual(leftHandOperand, rightHandOperand, leftHandKeys, options);
        }
        var leftHandEntries = getIteratorEntries(leftHandOperand);
        var rightHandEntries = getIteratorEntries(rightHandOperand);
        if (leftHandEntries.length && leftHandEntries.length === rightHandEntries.length) {
          leftHandEntries.sort();
          rightHandEntries.sort();
          return iterableEqual(leftHandEntries, rightHandEntries, options);
        }
        if (leftHandKeys.length === 0 && leftHandEntries.length === 0 && rightHandKeys.length === 0 && rightHandEntries.length === 0) {
          return true;
        }
        return false;
      }
      function isPrimitive(value) {
        return value === null || typeof value !== "object";
      }
    }
  });

  // node_modules/chai/lib/chai/utils/isProxyEnabled.js
  var require_isProxyEnabled = __commonJS({
    "node_modules/chai/lib/chai/utils/isProxyEnabled.js"(exports, module) {
      var config = require_config();
      module.exports = function isProxyEnabled() {
        return config.useProxy && typeof Proxy !== "undefined" && typeof Reflect !== "undefined";
      };
    }
  });

  // node_modules/chai/lib/chai/utils/addProperty.js
  var require_addProperty = __commonJS({
    "node_modules/chai/lib/chai/utils/addProperty.js"(exports, module) {
      var chai = require_chai();
      var flag = require_flag();
      var isProxyEnabled = require_isProxyEnabled();
      var transferFlags = require_transferFlags();
      module.exports = function addProperty(ctx, name, getter) {
        getter = getter === void 0 ? function() {
        } : getter;
        Object.defineProperty(ctx, name, {
          get: function propertyGetter() {
            if (!isProxyEnabled() && !flag(this, "lockSsfi")) {
              flag(this, "ssfi", propertyGetter);
            }
            var result = getter.call(this);
            if (result !== void 0)
              return result;
            var newAssertion = new chai.Assertion();
            transferFlags(this, newAssertion);
            return newAssertion;
          },
          configurable: true
        });
      };
    }
  });

  // node_modules/chai/lib/chai/utils/addLengthGuard.js
  var require_addLengthGuard = __commonJS({
    "node_modules/chai/lib/chai/utils/addLengthGuard.js"(exports, module) {
      var fnLengthDesc = Object.getOwnPropertyDescriptor(function() {
      }, "length");
      module.exports = function addLengthGuard(fn, assertionName, isChainable) {
        if (!fnLengthDesc.configurable)
          return fn;
        Object.defineProperty(fn, "length", {
          get: function() {
            if (isChainable) {
              throw Error("Invalid Chai property: " + assertionName + '.length. Due to a compatibility issue, "length" cannot directly follow "' + assertionName + '". Use "' + assertionName + '.lengthOf" instead.');
            }
            throw Error("Invalid Chai property: " + assertionName + '.length. See docs for proper usage of "' + assertionName + '".');
          }
        });
        return fn;
      };
    }
  });

  // node_modules/chai/lib/chai/utils/getProperties.js
  var require_getProperties = __commonJS({
    "node_modules/chai/lib/chai/utils/getProperties.js"(exports, module) {
      module.exports = function getProperties(object) {
        var result = Object.getOwnPropertyNames(object);
        function addProperty(property) {
          if (result.indexOf(property) === -1) {
            result.push(property);
          }
        }
        var proto = Object.getPrototypeOf(object);
        while (proto !== null) {
          Object.getOwnPropertyNames(proto).forEach(addProperty);
          proto = Object.getPrototypeOf(proto);
        }
        return result;
      };
    }
  });

  // node_modules/chai/lib/chai/utils/proxify.js
  var require_proxify = __commonJS({
    "node_modules/chai/lib/chai/utils/proxify.js"(exports, module) {
      var config = require_config();
      var flag = require_flag();
      var getProperties = require_getProperties();
      var isProxyEnabled = require_isProxyEnabled();
      var builtins = ["__flags", "__methods", "_obj", "assert"];
      module.exports = function proxify(obj, nonChainableMethodName) {
        if (!isProxyEnabled())
          return obj;
        return new Proxy(obj, {
          get: function proxyGetter(target, property) {
            if (typeof property === "string" && config.proxyExcludedKeys.indexOf(property) === -1 && !Reflect.has(target, property)) {
              if (nonChainableMethodName) {
                throw Error("Invalid Chai property: " + nonChainableMethodName + "." + property + '. See docs for proper usage of "' + nonChainableMethodName + '".');
              }
              var suggestion = null;
              var suggestionDistance = 4;
              getProperties(target).forEach(function(prop) {
                if (!Object.prototype.hasOwnProperty(prop) && builtins.indexOf(prop) === -1) {
                  var dist = stringDistanceCapped(property, prop, suggestionDistance);
                  if (dist < suggestionDistance) {
                    suggestion = prop;
                    suggestionDistance = dist;
                  }
                }
              });
              if (suggestion !== null) {
                throw Error("Invalid Chai property: " + property + '. Did you mean "' + suggestion + '"?');
              } else {
                throw Error("Invalid Chai property: " + property);
              }
            }
            if (builtins.indexOf(property) === -1 && !flag(target, "lockSsfi")) {
              flag(target, "ssfi", proxyGetter);
            }
            return Reflect.get(target, property);
          }
        });
      };
      function stringDistanceCapped(strA, strB, cap) {
        if (Math.abs(strA.length - strB.length) >= cap) {
          return cap;
        }
        var memo = [];
        for (var i = 0; i <= strA.length; i++) {
          memo[i] = Array(strB.length + 1).fill(0);
          memo[i][0] = i;
        }
        for (var j = 0; j < strB.length; j++) {
          memo[0][j] = j;
        }
        for (var i = 1; i <= strA.length; i++) {
          var ch = strA.charCodeAt(i - 1);
          for (var j = 1; j <= strB.length; j++) {
            if (Math.abs(i - j) >= cap) {
              memo[i][j] = cap;
              continue;
            }
            memo[i][j] = Math.min(memo[i - 1][j] + 1, memo[i][j - 1] + 1, memo[i - 1][j - 1] + (ch === strB.charCodeAt(j - 1) ? 0 : 1));
          }
        }
        return memo[strA.length][strB.length];
      }
    }
  });

  // node_modules/chai/lib/chai/utils/addMethod.js
  var require_addMethod = __commonJS({
    "node_modules/chai/lib/chai/utils/addMethod.js"(exports, module) {
      var addLengthGuard = require_addLengthGuard();
      var chai = require_chai();
      var flag = require_flag();
      var proxify = require_proxify();
      var transferFlags = require_transferFlags();
      module.exports = function addMethod(ctx, name, method) {
        var methodWrapper = function() {
          if (!flag(this, "lockSsfi")) {
            flag(this, "ssfi", methodWrapper);
          }
          var result = method.apply(this, arguments);
          if (result !== void 0)
            return result;
          var newAssertion = new chai.Assertion();
          transferFlags(this, newAssertion);
          return newAssertion;
        };
        addLengthGuard(methodWrapper, name, false);
        ctx[name] = proxify(methodWrapper, name);
      };
    }
  });

  // node_modules/chai/lib/chai/utils/overwriteProperty.js
  var require_overwriteProperty = __commonJS({
    "node_modules/chai/lib/chai/utils/overwriteProperty.js"(exports, module) {
      var chai = require_chai();
      var flag = require_flag();
      var isProxyEnabled = require_isProxyEnabled();
      var transferFlags = require_transferFlags();
      module.exports = function overwriteProperty(ctx, name, getter) {
        var _get = Object.getOwnPropertyDescriptor(ctx, name), _super = function() {
        };
        if (_get && "function" === typeof _get.get)
          _super = _get.get;
        Object.defineProperty(ctx, name, {
          get: function overwritingPropertyGetter() {
            if (!isProxyEnabled() && !flag(this, "lockSsfi")) {
              flag(this, "ssfi", overwritingPropertyGetter);
            }
            var origLockSsfi = flag(this, "lockSsfi");
            flag(this, "lockSsfi", true);
            var result = getter(_super).call(this);
            flag(this, "lockSsfi", origLockSsfi);
            if (result !== void 0) {
              return result;
            }
            var newAssertion = new chai.Assertion();
            transferFlags(this, newAssertion);
            return newAssertion;
          },
          configurable: true
        });
      };
    }
  });

  // node_modules/chai/lib/chai/utils/overwriteMethod.js
  var require_overwriteMethod = __commonJS({
    "node_modules/chai/lib/chai/utils/overwriteMethod.js"(exports, module) {
      var addLengthGuard = require_addLengthGuard();
      var chai = require_chai();
      var flag = require_flag();
      var proxify = require_proxify();
      var transferFlags = require_transferFlags();
      module.exports = function overwriteMethod(ctx, name, method) {
        var _method = ctx[name], _super = function() {
          throw new Error(name + " is not a function");
        };
        if (_method && "function" === typeof _method)
          _super = _method;
        var overwritingMethodWrapper = function() {
          if (!flag(this, "lockSsfi")) {
            flag(this, "ssfi", overwritingMethodWrapper);
          }
          var origLockSsfi = flag(this, "lockSsfi");
          flag(this, "lockSsfi", true);
          var result = method(_super).apply(this, arguments);
          flag(this, "lockSsfi", origLockSsfi);
          if (result !== void 0) {
            return result;
          }
          var newAssertion = new chai.Assertion();
          transferFlags(this, newAssertion);
          return newAssertion;
        };
        addLengthGuard(overwritingMethodWrapper, name, false);
        ctx[name] = proxify(overwritingMethodWrapper, name);
      };
    }
  });

  // node_modules/chai/lib/chai/utils/addChainableMethod.js
  var require_addChainableMethod = __commonJS({
    "node_modules/chai/lib/chai/utils/addChainableMethod.js"(exports, module) {
      var addLengthGuard = require_addLengthGuard();
      var chai = require_chai();
      var flag = require_flag();
      var proxify = require_proxify();
      var transferFlags = require_transferFlags();
      var canSetPrototype = typeof Object.setPrototypeOf === "function";
      var testFn = function() {
      };
      var excludeNames = Object.getOwnPropertyNames(testFn).filter(function(name) {
        var propDesc = Object.getOwnPropertyDescriptor(testFn, name);
        if (typeof propDesc !== "object")
          return true;
        return !propDesc.configurable;
      });
      var call = Function.prototype.call;
      var apply = Function.prototype.apply;
      module.exports = function addChainableMethod(ctx, name, method, chainingBehavior) {
        if (typeof chainingBehavior !== "function") {
          chainingBehavior = function() {
          };
        }
        var chainableBehavior = {
          method,
          chainingBehavior
        };
        if (!ctx.__methods) {
          ctx.__methods = {};
        }
        ctx.__methods[name] = chainableBehavior;
        Object.defineProperty(ctx, name, {
          get: function chainableMethodGetter() {
            chainableBehavior.chainingBehavior.call(this);
            var chainableMethodWrapper = function() {
              if (!flag(this, "lockSsfi")) {
                flag(this, "ssfi", chainableMethodWrapper);
              }
              var result = chainableBehavior.method.apply(this, arguments);
              if (result !== void 0) {
                return result;
              }
              var newAssertion = new chai.Assertion();
              transferFlags(this, newAssertion);
              return newAssertion;
            };
            addLengthGuard(chainableMethodWrapper, name, true);
            if (canSetPrototype) {
              var prototype = Object.create(this);
              prototype.call = call;
              prototype.apply = apply;
              Object.setPrototypeOf(chainableMethodWrapper, prototype);
            } else {
              var asserterNames = Object.getOwnPropertyNames(ctx);
              asserterNames.forEach(function(asserterName) {
                if (excludeNames.indexOf(asserterName) !== -1) {
                  return;
                }
                var pd = Object.getOwnPropertyDescriptor(ctx, asserterName);
                Object.defineProperty(chainableMethodWrapper, asserterName, pd);
              });
            }
            transferFlags(this, chainableMethodWrapper);
            return proxify(chainableMethodWrapper);
          },
          configurable: true
        });
      };
    }
  });

  // node_modules/chai/lib/chai/utils/overwriteChainableMethod.js
  var require_overwriteChainableMethod = __commonJS({
    "node_modules/chai/lib/chai/utils/overwriteChainableMethod.js"(exports, module) {
      var chai = require_chai();
      var transferFlags = require_transferFlags();
      module.exports = function overwriteChainableMethod(ctx, name, method, chainingBehavior) {
        var chainableBehavior = ctx.__methods[name];
        var _chainingBehavior = chainableBehavior.chainingBehavior;
        chainableBehavior.chainingBehavior = function overwritingChainableMethodGetter() {
          var result = chainingBehavior(_chainingBehavior).call(this);
          if (result !== void 0) {
            return result;
          }
          var newAssertion = new chai.Assertion();
          transferFlags(this, newAssertion);
          return newAssertion;
        };
        var _method = chainableBehavior.method;
        chainableBehavior.method = function overwritingChainableMethodWrapper() {
          var result = method(_method).apply(this, arguments);
          if (result !== void 0) {
            return result;
          }
          var newAssertion = new chai.Assertion();
          transferFlags(this, newAssertion);
          return newAssertion;
        };
      };
    }
  });

  // node_modules/chai/lib/chai/utils/compareByInspect.js
  var require_compareByInspect = __commonJS({
    "node_modules/chai/lib/chai/utils/compareByInspect.js"(exports, module) {
      var inspect = require_inspect();
      module.exports = function compareByInspect(a, b) {
        return inspect(a) < inspect(b) ? -1 : 1;
      };
    }
  });

  // node_modules/chai/lib/chai/utils/getOwnEnumerablePropertySymbols.js
  var require_getOwnEnumerablePropertySymbols = __commonJS({
    "node_modules/chai/lib/chai/utils/getOwnEnumerablePropertySymbols.js"(exports, module) {
      module.exports = function getOwnEnumerablePropertySymbols(obj) {
        if (typeof Object.getOwnPropertySymbols !== "function")
          return [];
        return Object.getOwnPropertySymbols(obj).filter(function(sym) {
          return Object.getOwnPropertyDescriptor(obj, sym).enumerable;
        });
      };
    }
  });

  // node_modules/chai/lib/chai/utils/getOwnEnumerableProperties.js
  var require_getOwnEnumerableProperties = __commonJS({
    "node_modules/chai/lib/chai/utils/getOwnEnumerableProperties.js"(exports, module) {
      var getOwnEnumerablePropertySymbols = require_getOwnEnumerablePropertySymbols();
      module.exports = function getOwnEnumerableProperties(obj) {
        return Object.keys(obj).concat(getOwnEnumerablePropertySymbols(obj));
      };
    }
  });

  // node_modules/check-error/index.js
  var require_check_error = __commonJS({
    "node_modules/check-error/index.js"(exports, module) {
      "use strict";
      function compatibleInstance(thrown, errorLike) {
        return errorLike instanceof Error && thrown === errorLike;
      }
      function compatibleConstructor(thrown, errorLike) {
        if (errorLike instanceof Error) {
          return thrown.constructor === errorLike.constructor || thrown instanceof errorLike.constructor;
        } else if (errorLike.prototype instanceof Error || errorLike === Error) {
          return thrown.constructor === errorLike || thrown instanceof errorLike;
        }
        return false;
      }
      function compatibleMessage(thrown, errMatcher) {
        var comparisonString = typeof thrown === "string" ? thrown : thrown.message;
        if (errMatcher instanceof RegExp) {
          return errMatcher.test(comparisonString);
        } else if (typeof errMatcher === "string") {
          return comparisonString.indexOf(errMatcher) !== -1;
        }
        return false;
      }
      var functionNameMatch = /\s*function(?:\s|\s*\/\*[^(?:*\/)]+\*\/\s*)*([^\(\/]+)/;
      function getFunctionName(constructorFn) {
        var name = "";
        if (typeof constructorFn.name === "undefined") {
          var match = String(constructorFn).match(functionNameMatch);
          if (match) {
            name = match[1];
          }
        } else {
          name = constructorFn.name;
        }
        return name;
      }
      function getConstructorName(errorLike) {
        var constructorName = errorLike;
        if (errorLike instanceof Error) {
          constructorName = getFunctionName(errorLike.constructor);
        } else if (typeof errorLike === "function") {
          constructorName = getFunctionName(errorLike).trim() || getFunctionName(new errorLike());
        }
        return constructorName;
      }
      function getMessage(errorLike) {
        var msg = "";
        if (errorLike && errorLike.message) {
          msg = errorLike.message;
        } else if (typeof errorLike === "string") {
          msg = errorLike;
        }
        return msg;
      }
      module.exports = {
        compatibleInstance,
        compatibleConstructor,
        compatibleMessage,
        getMessage,
        getConstructorName
      };
    }
  });

  // node_modules/chai/lib/chai/utils/isNaN.js
  var require_isNaN = __commonJS({
    "node_modules/chai/lib/chai/utils/isNaN.js"(exports, module) {
      function isNaN(value) {
        return value !== value;
      }
      module.exports = Number.isNaN || isNaN;
    }
  });

  // node_modules/chai/lib/chai/utils/getOperator.js
  var require_getOperator = __commonJS({
    "node_modules/chai/lib/chai/utils/getOperator.js"(exports, module) {
      var type = require_type_detect();
      var flag = require_flag();
      function isObjectType(obj) {
        var objectType = type(obj);
        var objectTypes = ["Array", "Object", "function"];
        return objectTypes.indexOf(objectType) !== -1;
      }
      module.exports = function getOperator(obj, args) {
        var operator = flag(obj, "operator");
        var negate = flag(obj, "negate");
        var expected = args[3];
        var msg = negate ? args[2] : args[1];
        if (operator) {
          return operator;
        }
        if (typeof msg === "function")
          msg = msg();
        msg = msg || "";
        if (!msg) {
          return void 0;
        }
        if (/\shave\s/.test(msg)) {
          return void 0;
        }
        var isObject = isObjectType(expected);
        if (/\snot\s/.test(msg)) {
          return isObject ? "notDeepStrictEqual" : "notStrictEqual";
        }
        return isObject ? "deepStrictEqual" : "strictEqual";
      };
    }
  });

  // node_modules/chai/lib/chai/utils/index.js
  var require_utils = __commonJS({
    "node_modules/chai/lib/chai/utils/index.js"(exports) {
      var pathval = require_pathval();
      exports.test = require_test();
      exports.type = require_type_detect();
      exports.expectTypes = require_expectTypes();
      exports.getMessage = require_getMessage();
      exports.getActual = require_getActual();
      exports.inspect = require_inspect();
      exports.objDisplay = require_objDisplay();
      exports.flag = require_flag();
      exports.transferFlags = require_transferFlags();
      exports.eql = require_deep_eql();
      exports.getPathInfo = pathval.getPathInfo;
      exports.hasProperty = pathval.hasProperty;
      exports.getName = require_get_func_name();
      exports.addProperty = require_addProperty();
      exports.addMethod = require_addMethod();
      exports.overwriteProperty = require_overwriteProperty();
      exports.overwriteMethod = require_overwriteMethod();
      exports.addChainableMethod = require_addChainableMethod();
      exports.overwriteChainableMethod = require_overwriteChainableMethod();
      exports.compareByInspect = require_compareByInspect();
      exports.getOwnEnumerablePropertySymbols = require_getOwnEnumerablePropertySymbols();
      exports.getOwnEnumerableProperties = require_getOwnEnumerableProperties();
      exports.checkError = require_check_error();
      exports.proxify = require_proxify();
      exports.addLengthGuard = require_addLengthGuard();
      exports.isProxyEnabled = require_isProxyEnabled();
      exports.isNaN = require_isNaN();
      exports.getOperator = require_getOperator();
    }
  });

  // node_modules/chai/lib/chai/assertion.js
  var require_assertion = __commonJS({
    "node_modules/chai/lib/chai/assertion.js"(exports, module) {
      var config = require_config();
      module.exports = function(_chai, util) {
        var AssertionError = _chai.AssertionError, flag = util.flag;
        _chai.Assertion = Assertion;
        function Assertion(obj, msg, ssfi, lockSsfi) {
          flag(this, "ssfi", ssfi || Assertion);
          flag(this, "lockSsfi", lockSsfi);
          flag(this, "object", obj);
          flag(this, "message", msg);
          return util.proxify(this);
        }
        Object.defineProperty(Assertion, "includeStack", {
          get: function() {
            console.warn("Assertion.includeStack is deprecated, use chai.config.includeStack instead.");
            return config.includeStack;
          },
          set: function(value) {
            console.warn("Assertion.includeStack is deprecated, use chai.config.includeStack instead.");
            config.includeStack = value;
          }
        });
        Object.defineProperty(Assertion, "showDiff", {
          get: function() {
            console.warn("Assertion.showDiff is deprecated, use chai.config.showDiff instead.");
            return config.showDiff;
          },
          set: function(value) {
            console.warn("Assertion.showDiff is deprecated, use chai.config.showDiff instead.");
            config.showDiff = value;
          }
        });
        Assertion.addProperty = function(name, fn) {
          util.addProperty(this.prototype, name, fn);
        };
        Assertion.addMethod = function(name, fn) {
          util.addMethod(this.prototype, name, fn);
        };
        Assertion.addChainableMethod = function(name, fn, chainingBehavior) {
          util.addChainableMethod(this.prototype, name, fn, chainingBehavior);
        };
        Assertion.overwriteProperty = function(name, fn) {
          util.overwriteProperty(this.prototype, name, fn);
        };
        Assertion.overwriteMethod = function(name, fn) {
          util.overwriteMethod(this.prototype, name, fn);
        };
        Assertion.overwriteChainableMethod = function(name, fn, chainingBehavior) {
          util.overwriteChainableMethod(this.prototype, name, fn, chainingBehavior);
        };
        Assertion.prototype.assert = function(expr, msg, negateMsg, expected, _actual, showDiff) {
          var ok = util.test(this, arguments);
          if (false !== showDiff)
            showDiff = true;
          if (void 0 === expected && void 0 === _actual)
            showDiff = false;
          if (true !== config.showDiff)
            showDiff = false;
          if (!ok) {
            msg = util.getMessage(this, arguments);
            var actual = util.getActual(this, arguments);
            var assertionErrorObjectProperties = {
              actual,
              expected,
              showDiff
            };
            var operator = util.getOperator(this, arguments);
            if (operator) {
              assertionErrorObjectProperties.operator = operator;
            }
            throw new AssertionError(msg, assertionErrorObjectProperties, config.includeStack ? this.assert : flag(this, "ssfi"));
          }
        };
        Object.defineProperty(Assertion.prototype, "_obj", {
          get: function() {
            return flag(this, "object");
          },
          set: function(val) {
            flag(this, "object", val);
          }
        });
      };
    }
  });

  // node_modules/chai/lib/chai/core/assertions.js
  var require_assertions = __commonJS({
    "node_modules/chai/lib/chai/core/assertions.js"(exports, module) {
      module.exports = function(chai, _) {
        var Assertion = chai.Assertion, AssertionError = chai.AssertionError, flag = _.flag;
        [
          "to",
          "be",
          "been",
          "is",
          "and",
          "has",
          "have",
          "with",
          "that",
          "which",
          "at",
          "of",
          "same",
          "but",
          "does",
          "still",
          "also"
        ].forEach(function(chain) {
          Assertion.addProperty(chain);
        });
        Assertion.addProperty("not", function() {
          flag(this, "negate", true);
        });
        Assertion.addProperty("deep", function() {
          flag(this, "deep", true);
        });
        Assertion.addProperty("nested", function() {
          flag(this, "nested", true);
        });
        Assertion.addProperty("own", function() {
          flag(this, "own", true);
        });
        Assertion.addProperty("ordered", function() {
          flag(this, "ordered", true);
        });
        Assertion.addProperty("any", function() {
          flag(this, "any", true);
          flag(this, "all", false);
        });
        Assertion.addProperty("all", function() {
          flag(this, "all", true);
          flag(this, "any", false);
        });
        function an(type, msg) {
          if (msg)
            flag(this, "message", msg);
          type = type.toLowerCase();
          var obj = flag(this, "object"), article = ~["a", "e", "i", "o", "u"].indexOf(type.charAt(0)) ? "an " : "a ";
          this.assert(type === _.type(obj).toLowerCase(), "expected #{this} to be " + article + type, "expected #{this} not to be " + article + type);
        }
        Assertion.addChainableMethod("an", an);
        Assertion.addChainableMethod("a", an);
        function SameValueZero(a, b) {
          return _.isNaN(a) && _.isNaN(b) || a === b;
        }
        function includeChainingBehavior() {
          flag(this, "contains", true);
        }
        function include(val, msg) {
          if (msg)
            flag(this, "message", msg);
          var obj = flag(this, "object"), objType = _.type(obj).toLowerCase(), flagMsg = flag(this, "message"), negate = flag(this, "negate"), ssfi = flag(this, "ssfi"), isDeep = flag(this, "deep"), descriptor = isDeep ? "deep " : "";
          flagMsg = flagMsg ? flagMsg + ": " : "";
          var included = false;
          switch (objType) {
            case "string":
              included = obj.indexOf(val) !== -1;
              break;
            case "weakset":
              if (isDeep) {
                throw new AssertionError(flagMsg + "unable to use .deep.include with WeakSet", void 0, ssfi);
              }
              included = obj.has(val);
              break;
            case "map":
              var isEql = isDeep ? _.eql : SameValueZero;
              obj.forEach(function(item) {
                included = included || isEql(item, val);
              });
              break;
            case "set":
              if (isDeep) {
                obj.forEach(function(item) {
                  included = included || _.eql(item, val);
                });
              } else {
                included = obj.has(val);
              }
              break;
            case "array":
              if (isDeep) {
                included = obj.some(function(item) {
                  return _.eql(item, val);
                });
              } else {
                included = obj.indexOf(val) !== -1;
              }
              break;
            default:
              if (val !== Object(val)) {
                throw new AssertionError(flagMsg + "the given combination of arguments (" + objType + " and " + _.type(val).toLowerCase() + ") is invalid for this assertion. You can use an array, a map, an object, a set, a string, or a weakset instead of a " + _.type(val).toLowerCase(), void 0, ssfi);
              }
              var props = Object.keys(val), firstErr = null, numErrs = 0;
              props.forEach(function(prop) {
                var propAssertion = new Assertion(obj);
                _.transferFlags(this, propAssertion, true);
                flag(propAssertion, "lockSsfi", true);
                if (!negate || props.length === 1) {
                  propAssertion.property(prop, val[prop]);
                  return;
                }
                try {
                  propAssertion.property(prop, val[prop]);
                } catch (err) {
                  if (!_.checkError.compatibleConstructor(err, AssertionError)) {
                    throw err;
                  }
                  if (firstErr === null)
                    firstErr = err;
                  numErrs++;
                }
              }, this);
              if (negate && props.length > 1 && numErrs === props.length) {
                throw firstErr;
              }
              return;
          }
          this.assert(included, "expected #{this} to " + descriptor + "include " + _.inspect(val), "expected #{this} to not " + descriptor + "include " + _.inspect(val));
        }
        Assertion.addChainableMethod("include", include, includeChainingBehavior);
        Assertion.addChainableMethod("contain", include, includeChainingBehavior);
        Assertion.addChainableMethod("contains", include, includeChainingBehavior);
        Assertion.addChainableMethod("includes", include, includeChainingBehavior);
        Assertion.addProperty("ok", function() {
          this.assert(flag(this, "object"), "expected #{this} to be truthy", "expected #{this} to be falsy");
        });
        Assertion.addProperty("true", function() {
          this.assert(true === flag(this, "object"), "expected #{this} to be true", "expected #{this} to be false", flag(this, "negate") ? false : true);
        });
        Assertion.addProperty("false", function() {
          this.assert(false === flag(this, "object"), "expected #{this} to be false", "expected #{this} to be true", flag(this, "negate") ? true : false);
        });
        Assertion.addProperty("null", function() {
          this.assert(null === flag(this, "object"), "expected #{this} to be null", "expected #{this} not to be null");
        });
        Assertion.addProperty("undefined", function() {
          this.assert(void 0 === flag(this, "object"), "expected #{this} to be undefined", "expected #{this} not to be undefined");
        });
        Assertion.addProperty("NaN", function() {
          this.assert(_.isNaN(flag(this, "object")), "expected #{this} to be NaN", "expected #{this} not to be NaN");
        });
        function assertExist() {
          var val = flag(this, "object");
          this.assert(val !== null && val !== void 0, "expected #{this} to exist", "expected #{this} to not exist");
        }
        Assertion.addProperty("exist", assertExist);
        Assertion.addProperty("exists", assertExist);
        Assertion.addProperty("empty", function() {
          var val = flag(this, "object"), ssfi = flag(this, "ssfi"), flagMsg = flag(this, "message"), itemsCount;
          flagMsg = flagMsg ? flagMsg + ": " : "";
          switch (_.type(val).toLowerCase()) {
            case "array":
            case "string":
              itemsCount = val.length;
              break;
            case "map":
            case "set":
              itemsCount = val.size;
              break;
            case "weakmap":
            case "weakset":
              throw new AssertionError(flagMsg + ".empty was passed a weak collection", void 0, ssfi);
            case "function":
              var msg = flagMsg + ".empty was passed a function " + _.getName(val);
              throw new AssertionError(msg.trim(), void 0, ssfi);
            default:
              if (val !== Object(val)) {
                throw new AssertionError(flagMsg + ".empty was passed non-string primitive " + _.inspect(val), void 0, ssfi);
              }
              itemsCount = Object.keys(val).length;
          }
          this.assert(0 === itemsCount, "expected #{this} to be empty", "expected #{this} not to be empty");
        });
        function checkArguments() {
          var obj = flag(this, "object"), type = _.type(obj);
          this.assert("Arguments" === type, "expected #{this} to be arguments but got " + type, "expected #{this} to not be arguments");
        }
        Assertion.addProperty("arguments", checkArguments);
        Assertion.addProperty("Arguments", checkArguments);
        function assertEqual(val, msg) {
          if (msg)
            flag(this, "message", msg);
          var obj = flag(this, "object");
          if (flag(this, "deep")) {
            var prevLockSsfi = flag(this, "lockSsfi");
            flag(this, "lockSsfi", true);
            this.eql(val);
            flag(this, "lockSsfi", prevLockSsfi);
          } else {
            this.assert(val === obj, "expected #{this} to equal #{exp}", "expected #{this} to not equal #{exp}", val, this._obj, true);
          }
        }
        Assertion.addMethod("equal", assertEqual);
        Assertion.addMethod("equals", assertEqual);
        Assertion.addMethod("eq", assertEqual);
        function assertEql(obj, msg) {
          if (msg)
            flag(this, "message", msg);
          this.assert(_.eql(obj, flag(this, "object")), "expected #{this} to deeply equal #{exp}", "expected #{this} to not deeply equal #{exp}", obj, this._obj, true);
        }
        Assertion.addMethod("eql", assertEql);
        Assertion.addMethod("eqls", assertEql);
        function assertAbove(n, msg) {
          if (msg)
            flag(this, "message", msg);
          var obj = flag(this, "object"), doLength = flag(this, "doLength"), flagMsg = flag(this, "message"), msgPrefix = flagMsg ? flagMsg + ": " : "", ssfi = flag(this, "ssfi"), objType = _.type(obj).toLowerCase(), nType = _.type(n).toLowerCase(), errorMessage, shouldThrow = true;
          if (doLength && objType !== "map" && objType !== "set") {
            new Assertion(obj, flagMsg, ssfi, true).to.have.property("length");
          }
          if (!doLength && (objType === "date" && nType !== "date")) {
            errorMessage = msgPrefix + "the argument to above must be a date";
          } else if (nType !== "number" && (doLength || objType === "number")) {
            errorMessage = msgPrefix + "the argument to above must be a number";
          } else if (!doLength && (objType !== "date" && objType !== "number")) {
            var printObj = objType === "string" ? "'" + obj + "'" : obj;
            errorMessage = msgPrefix + "expected " + printObj + " to be a number or a date";
          } else {
            shouldThrow = false;
          }
          if (shouldThrow) {
            throw new AssertionError(errorMessage, void 0, ssfi);
          }
          if (doLength) {
            var descriptor = "length", itemsCount;
            if (objType === "map" || objType === "set") {
              descriptor = "size";
              itemsCount = obj.size;
            } else {
              itemsCount = obj.length;
            }
            this.assert(itemsCount > n, "expected #{this} to have a " + descriptor + " above #{exp} but got #{act}", "expected #{this} to not have a " + descriptor + " above #{exp}", n, itemsCount);
          } else {
            this.assert(obj > n, "expected #{this} to be above #{exp}", "expected #{this} to be at most #{exp}", n);
          }
        }
        Assertion.addMethod("above", assertAbove);
        Assertion.addMethod("gt", assertAbove);
        Assertion.addMethod("greaterThan", assertAbove);
        function assertLeast(n, msg) {
          if (msg)
            flag(this, "message", msg);
          var obj = flag(this, "object"), doLength = flag(this, "doLength"), flagMsg = flag(this, "message"), msgPrefix = flagMsg ? flagMsg + ": " : "", ssfi = flag(this, "ssfi"), objType = _.type(obj).toLowerCase(), nType = _.type(n).toLowerCase(), errorMessage, shouldThrow = true;
          if (doLength && objType !== "map" && objType !== "set") {
            new Assertion(obj, flagMsg, ssfi, true).to.have.property("length");
          }
          if (!doLength && (objType === "date" && nType !== "date")) {
            errorMessage = msgPrefix + "the argument to least must be a date";
          } else if (nType !== "number" && (doLength || objType === "number")) {
            errorMessage = msgPrefix + "the argument to least must be a number";
          } else if (!doLength && (objType !== "date" && objType !== "number")) {
            var printObj = objType === "string" ? "'" + obj + "'" : obj;
            errorMessage = msgPrefix + "expected " + printObj + " to be a number or a date";
          } else {
            shouldThrow = false;
          }
          if (shouldThrow) {
            throw new AssertionError(errorMessage, void 0, ssfi);
          }
          if (doLength) {
            var descriptor = "length", itemsCount;
            if (objType === "map" || objType === "set") {
              descriptor = "size";
              itemsCount = obj.size;
            } else {
              itemsCount = obj.length;
            }
            this.assert(itemsCount >= n, "expected #{this} to have a " + descriptor + " at least #{exp} but got #{act}", "expected #{this} to have a " + descriptor + " below #{exp}", n, itemsCount);
          } else {
            this.assert(obj >= n, "expected #{this} to be at least #{exp}", "expected #{this} to be below #{exp}", n);
          }
        }
        Assertion.addMethod("least", assertLeast);
        Assertion.addMethod("gte", assertLeast);
        Assertion.addMethod("greaterThanOrEqual", assertLeast);
        function assertBelow(n, msg) {
          if (msg)
            flag(this, "message", msg);
          var obj = flag(this, "object"), doLength = flag(this, "doLength"), flagMsg = flag(this, "message"), msgPrefix = flagMsg ? flagMsg + ": " : "", ssfi = flag(this, "ssfi"), objType = _.type(obj).toLowerCase(), nType = _.type(n).toLowerCase(), errorMessage, shouldThrow = true;
          if (doLength && objType !== "map" && objType !== "set") {
            new Assertion(obj, flagMsg, ssfi, true).to.have.property("length");
          }
          if (!doLength && (objType === "date" && nType !== "date")) {
            errorMessage = msgPrefix + "the argument to below must be a date";
          } else if (nType !== "number" && (doLength || objType === "number")) {
            errorMessage = msgPrefix + "the argument to below must be a number";
          } else if (!doLength && (objType !== "date" && objType !== "number")) {
            var printObj = objType === "string" ? "'" + obj + "'" : obj;
            errorMessage = msgPrefix + "expected " + printObj + " to be a number or a date";
          } else {
            shouldThrow = false;
          }
          if (shouldThrow) {
            throw new AssertionError(errorMessage, void 0, ssfi);
          }
          if (doLength) {
            var descriptor = "length", itemsCount;
            if (objType === "map" || objType === "set") {
              descriptor = "size";
              itemsCount = obj.size;
            } else {
              itemsCount = obj.length;
            }
            this.assert(itemsCount < n, "expected #{this} to have a " + descriptor + " below #{exp} but got #{act}", "expected #{this} to not have a " + descriptor + " below #{exp}", n, itemsCount);
          } else {
            this.assert(obj < n, "expected #{this} to be below #{exp}", "expected #{this} to be at least #{exp}", n);
          }
        }
        Assertion.addMethod("below", assertBelow);
        Assertion.addMethod("lt", assertBelow);
        Assertion.addMethod("lessThan", assertBelow);
        function assertMost(n, msg) {
          if (msg)
            flag(this, "message", msg);
          var obj = flag(this, "object"), doLength = flag(this, "doLength"), flagMsg = flag(this, "message"), msgPrefix = flagMsg ? flagMsg + ": " : "", ssfi = flag(this, "ssfi"), objType = _.type(obj).toLowerCase(), nType = _.type(n).toLowerCase(), errorMessage, shouldThrow = true;
          if (doLength && objType !== "map" && objType !== "set") {
            new Assertion(obj, flagMsg, ssfi, true).to.have.property("length");
          }
          if (!doLength && (objType === "date" && nType !== "date")) {
            errorMessage = msgPrefix + "the argument to most must be a date";
          } else if (nType !== "number" && (doLength || objType === "number")) {
            errorMessage = msgPrefix + "the argument to most must be a number";
          } else if (!doLength && (objType !== "date" && objType !== "number")) {
            var printObj = objType === "string" ? "'" + obj + "'" : obj;
            errorMessage = msgPrefix + "expected " + printObj + " to be a number or a date";
          } else {
            shouldThrow = false;
          }
          if (shouldThrow) {
            throw new AssertionError(errorMessage, void 0, ssfi);
          }
          if (doLength) {
            var descriptor = "length", itemsCount;
            if (objType === "map" || objType === "set") {
              descriptor = "size";
              itemsCount = obj.size;
            } else {
              itemsCount = obj.length;
            }
            this.assert(itemsCount <= n, "expected #{this} to have a " + descriptor + " at most #{exp} but got #{act}", "expected #{this} to have a " + descriptor + " above #{exp}", n, itemsCount);
          } else {
            this.assert(obj <= n, "expected #{this} to be at most #{exp}", "expected #{this} to be above #{exp}", n);
          }
        }
        Assertion.addMethod("most", assertMost);
        Assertion.addMethod("lte", assertMost);
        Assertion.addMethod("lessThanOrEqual", assertMost);
        Assertion.addMethod("within", function(start, finish, msg) {
          if (msg)
            flag(this, "message", msg);
          var obj = flag(this, "object"), doLength = flag(this, "doLength"), flagMsg = flag(this, "message"), msgPrefix = flagMsg ? flagMsg + ": " : "", ssfi = flag(this, "ssfi"), objType = _.type(obj).toLowerCase(), startType = _.type(start).toLowerCase(), finishType = _.type(finish).toLowerCase(), errorMessage, shouldThrow = true, range = startType === "date" && finishType === "date" ? start.toISOString() + ".." + finish.toISOString() : start + ".." + finish;
          if (doLength && objType !== "map" && objType !== "set") {
            new Assertion(obj, flagMsg, ssfi, true).to.have.property("length");
          }
          if (!doLength && (objType === "date" && (startType !== "date" || finishType !== "date"))) {
            errorMessage = msgPrefix + "the arguments to within must be dates";
          } else if ((startType !== "number" || finishType !== "number") && (doLength || objType === "number")) {
            errorMessage = msgPrefix + "the arguments to within must be numbers";
          } else if (!doLength && (objType !== "date" && objType !== "number")) {
            var printObj = objType === "string" ? "'" + obj + "'" : obj;
            errorMessage = msgPrefix + "expected " + printObj + " to be a number or a date";
          } else {
            shouldThrow = false;
          }
          if (shouldThrow) {
            throw new AssertionError(errorMessage, void 0, ssfi);
          }
          if (doLength) {
            var descriptor = "length", itemsCount;
            if (objType === "map" || objType === "set") {
              descriptor = "size";
              itemsCount = obj.size;
            } else {
              itemsCount = obj.length;
            }
            this.assert(itemsCount >= start && itemsCount <= finish, "expected #{this} to have a " + descriptor + " within " + range, "expected #{this} to not have a " + descriptor + " within " + range);
          } else {
            this.assert(obj >= start && obj <= finish, "expected #{this} to be within " + range, "expected #{this} to not be within " + range);
          }
        });
        function assertInstanceOf(constructor, msg) {
          if (msg)
            flag(this, "message", msg);
          var target = flag(this, "object");
          var ssfi = flag(this, "ssfi");
          var flagMsg = flag(this, "message");
          try {
            var isInstanceOf = target instanceof constructor;
          } catch (err) {
            if (err instanceof TypeError) {
              flagMsg = flagMsg ? flagMsg + ": " : "";
              throw new AssertionError(flagMsg + "The instanceof assertion needs a constructor but " + _.type(constructor) + " was given.", void 0, ssfi);
            }
            throw err;
          }
          var name = _.getName(constructor);
          if (name === null) {
            name = "an unnamed constructor";
          }
          this.assert(isInstanceOf, "expected #{this} to be an instance of " + name, "expected #{this} to not be an instance of " + name);
        }
        ;
        Assertion.addMethod("instanceof", assertInstanceOf);
        Assertion.addMethod("instanceOf", assertInstanceOf);
        function assertProperty(name, val, msg) {
          if (msg)
            flag(this, "message", msg);
          var isNested = flag(this, "nested"), isOwn = flag(this, "own"), flagMsg = flag(this, "message"), obj = flag(this, "object"), ssfi = flag(this, "ssfi"), nameType = typeof name;
          flagMsg = flagMsg ? flagMsg + ": " : "";
          if (isNested) {
            if (nameType !== "string") {
              throw new AssertionError(flagMsg + "the argument to property must be a string when using nested syntax", void 0, ssfi);
            }
          } else {
            if (nameType !== "string" && nameType !== "number" && nameType !== "symbol") {
              throw new AssertionError(flagMsg + "the argument to property must be a string, number, or symbol", void 0, ssfi);
            }
          }
          if (isNested && isOwn) {
            throw new AssertionError(flagMsg + 'The "nested" and "own" flags cannot be combined.', void 0, ssfi);
          }
          if (obj === null || obj === void 0) {
            throw new AssertionError(flagMsg + "Target cannot be null or undefined.", void 0, ssfi);
          }
          var isDeep = flag(this, "deep"), negate = flag(this, "negate"), pathInfo = isNested ? _.getPathInfo(obj, name) : null, value = isNested ? pathInfo.value : obj[name];
          var descriptor = "";
          if (isDeep)
            descriptor += "deep ";
          if (isOwn)
            descriptor += "own ";
          if (isNested)
            descriptor += "nested ";
          descriptor += "property ";
          var hasProperty;
          if (isOwn)
            hasProperty = Object.prototype.hasOwnProperty.call(obj, name);
          else if (isNested)
            hasProperty = pathInfo.exists;
          else
            hasProperty = _.hasProperty(obj, name);
          if (!negate || arguments.length === 1) {
            this.assert(hasProperty, "expected #{this} to have " + descriptor + _.inspect(name), "expected #{this} to not have " + descriptor + _.inspect(name));
          }
          if (arguments.length > 1) {
            this.assert(hasProperty && (isDeep ? _.eql(val, value) : val === value), "expected #{this} to have " + descriptor + _.inspect(name) + " of #{exp}, but got #{act}", "expected #{this} to not have " + descriptor + _.inspect(name) + " of #{act}", val, value);
          }
          flag(this, "object", value);
        }
        Assertion.addMethod("property", assertProperty);
        function assertOwnProperty(name, value, msg) {
          flag(this, "own", true);
          assertProperty.apply(this, arguments);
        }
        Assertion.addMethod("ownProperty", assertOwnProperty);
        Assertion.addMethod("haveOwnProperty", assertOwnProperty);
        function assertOwnPropertyDescriptor(name, descriptor, msg) {
          if (typeof descriptor === "string") {
            msg = descriptor;
            descriptor = null;
          }
          if (msg)
            flag(this, "message", msg);
          var obj = flag(this, "object");
          var actualDescriptor = Object.getOwnPropertyDescriptor(Object(obj), name);
          if (actualDescriptor && descriptor) {
            this.assert(_.eql(descriptor, actualDescriptor), "expected the own property descriptor for " + _.inspect(name) + " on #{this} to match " + _.inspect(descriptor) + ", got " + _.inspect(actualDescriptor), "expected the own property descriptor for " + _.inspect(name) + " on #{this} to not match " + _.inspect(descriptor), descriptor, actualDescriptor, true);
          } else {
            this.assert(actualDescriptor, "expected #{this} to have an own property descriptor for " + _.inspect(name), "expected #{this} to not have an own property descriptor for " + _.inspect(name));
          }
          flag(this, "object", actualDescriptor);
        }
        Assertion.addMethod("ownPropertyDescriptor", assertOwnPropertyDescriptor);
        Assertion.addMethod("haveOwnPropertyDescriptor", assertOwnPropertyDescriptor);
        function assertLengthChain() {
          flag(this, "doLength", true);
        }
        function assertLength(n, msg) {
          if (msg)
            flag(this, "message", msg);
          var obj = flag(this, "object"), objType = _.type(obj).toLowerCase(), flagMsg = flag(this, "message"), ssfi = flag(this, "ssfi"), descriptor = "length", itemsCount;
          switch (objType) {
            case "map":
            case "set":
              descriptor = "size";
              itemsCount = obj.size;
              break;
            default:
              new Assertion(obj, flagMsg, ssfi, true).to.have.property("length");
              itemsCount = obj.length;
          }
          this.assert(itemsCount == n, "expected #{this} to have a " + descriptor + " of #{exp} but got #{act}", "expected #{this} to not have a " + descriptor + " of #{act}", n, itemsCount);
        }
        Assertion.addChainableMethod("length", assertLength, assertLengthChain);
        Assertion.addChainableMethod("lengthOf", assertLength, assertLengthChain);
        function assertMatch(re, msg) {
          if (msg)
            flag(this, "message", msg);
          var obj = flag(this, "object");
          this.assert(re.exec(obj), "expected #{this} to match " + re, "expected #{this} not to match " + re);
        }
        Assertion.addMethod("match", assertMatch);
        Assertion.addMethod("matches", assertMatch);
        Assertion.addMethod("string", function(str, msg) {
          if (msg)
            flag(this, "message", msg);
          var obj = flag(this, "object"), flagMsg = flag(this, "message"), ssfi = flag(this, "ssfi");
          new Assertion(obj, flagMsg, ssfi, true).is.a("string");
          this.assert(~obj.indexOf(str), "expected #{this} to contain " + _.inspect(str), "expected #{this} to not contain " + _.inspect(str));
        });
        function assertKeys(keys) {
          var obj = flag(this, "object"), objType = _.type(obj), keysType = _.type(keys), ssfi = flag(this, "ssfi"), isDeep = flag(this, "deep"), str, deepStr = "", actual, ok = true, flagMsg = flag(this, "message");
          flagMsg = flagMsg ? flagMsg + ": " : "";
          var mixedArgsMsg = flagMsg + "when testing keys against an object or an array you must give a single Array|Object|String argument or multiple String arguments";
          if (objType === "Map" || objType === "Set") {
            deepStr = isDeep ? "deeply " : "";
            actual = [];
            obj.forEach(function(val, key) {
              actual.push(key);
            });
            if (keysType !== "Array") {
              keys = Array.prototype.slice.call(arguments);
            }
          } else {
            actual = _.getOwnEnumerableProperties(obj);
            switch (keysType) {
              case "Array":
                if (arguments.length > 1) {
                  throw new AssertionError(mixedArgsMsg, void 0, ssfi);
                }
                break;
              case "Object":
                if (arguments.length > 1) {
                  throw new AssertionError(mixedArgsMsg, void 0, ssfi);
                }
                keys = Object.keys(keys);
                break;
              default:
                keys = Array.prototype.slice.call(arguments);
            }
            keys = keys.map(function(val) {
              return typeof val === "symbol" ? val : String(val);
            });
          }
          if (!keys.length) {
            throw new AssertionError(flagMsg + "keys required", void 0, ssfi);
          }
          var len = keys.length, any = flag(this, "any"), all = flag(this, "all"), expected = keys;
          if (!any && !all) {
            all = true;
          }
          if (any) {
            ok = expected.some(function(expectedKey) {
              return actual.some(function(actualKey) {
                if (isDeep) {
                  return _.eql(expectedKey, actualKey);
                } else {
                  return expectedKey === actualKey;
                }
              });
            });
          }
          if (all) {
            ok = expected.every(function(expectedKey) {
              return actual.some(function(actualKey) {
                if (isDeep) {
                  return _.eql(expectedKey, actualKey);
                } else {
                  return expectedKey === actualKey;
                }
              });
            });
            if (!flag(this, "contains")) {
              ok = ok && keys.length == actual.length;
            }
          }
          if (len > 1) {
            keys = keys.map(function(key) {
              return _.inspect(key);
            });
            var last = keys.pop();
            if (all) {
              str = keys.join(", ") + ", and " + last;
            }
            if (any) {
              str = keys.join(", ") + ", or " + last;
            }
          } else {
            str = _.inspect(keys[0]);
          }
          str = (len > 1 ? "keys " : "key ") + str;
          str = (flag(this, "contains") ? "contain " : "have ") + str;
          this.assert(ok, "expected #{this} to " + deepStr + str, "expected #{this} to not " + deepStr + str, expected.slice(0).sort(_.compareByInspect), actual.sort(_.compareByInspect), true);
        }
        Assertion.addMethod("keys", assertKeys);
        Assertion.addMethod("key", assertKeys);
        function assertThrows(errorLike, errMsgMatcher, msg) {
          if (msg)
            flag(this, "message", msg);
          var obj = flag(this, "object"), ssfi = flag(this, "ssfi"), flagMsg = flag(this, "message"), negate = flag(this, "negate") || false;
          new Assertion(obj, flagMsg, ssfi, true).is.a("function");
          if (errorLike instanceof RegExp || typeof errorLike === "string") {
            errMsgMatcher = errorLike;
            errorLike = null;
          }
          var caughtErr;
          try {
            obj();
          } catch (err) {
            caughtErr = err;
          }
          var everyArgIsUndefined = errorLike === void 0 && errMsgMatcher === void 0;
          var everyArgIsDefined = Boolean(errorLike && errMsgMatcher);
          var errorLikeFail = false;
          var errMsgMatcherFail = false;
          if (everyArgIsUndefined || !everyArgIsUndefined && !negate) {
            var errorLikeString = "an error";
            if (errorLike instanceof Error) {
              errorLikeString = "#{exp}";
            } else if (errorLike) {
              errorLikeString = _.checkError.getConstructorName(errorLike);
            }
            this.assert(caughtErr, "expected #{this} to throw " + errorLikeString, "expected #{this} to not throw an error but #{act} was thrown", errorLike && errorLike.toString(), caughtErr instanceof Error ? caughtErr.toString() : typeof caughtErr === "string" ? caughtErr : caughtErr && _.checkError.getConstructorName(caughtErr));
          }
          if (errorLike && caughtErr) {
            if (errorLike instanceof Error) {
              var isCompatibleInstance = _.checkError.compatibleInstance(caughtErr, errorLike);
              if (isCompatibleInstance === negate) {
                if (everyArgIsDefined && negate) {
                  errorLikeFail = true;
                } else {
                  this.assert(negate, "expected #{this} to throw #{exp} but #{act} was thrown", "expected #{this} to not throw #{exp}" + (caughtErr && !negate ? " but #{act} was thrown" : ""), errorLike.toString(), caughtErr.toString());
                }
              }
            }
            var isCompatibleConstructor = _.checkError.compatibleConstructor(caughtErr, errorLike);
            if (isCompatibleConstructor === negate) {
              if (everyArgIsDefined && negate) {
                errorLikeFail = true;
              } else {
                this.assert(negate, "expected #{this} to throw #{exp} but #{act} was thrown", "expected #{this} to not throw #{exp}" + (caughtErr ? " but #{act} was thrown" : ""), errorLike instanceof Error ? errorLike.toString() : errorLike && _.checkError.getConstructorName(errorLike), caughtErr instanceof Error ? caughtErr.toString() : caughtErr && _.checkError.getConstructorName(caughtErr));
              }
            }
          }
          if (caughtErr && errMsgMatcher !== void 0 && errMsgMatcher !== null) {
            var placeholder = "including";
            if (errMsgMatcher instanceof RegExp) {
              placeholder = "matching";
            }
            var isCompatibleMessage = _.checkError.compatibleMessage(caughtErr, errMsgMatcher);
            if (isCompatibleMessage === negate) {
              if (everyArgIsDefined && negate) {
                errMsgMatcherFail = true;
              } else {
                this.assert(negate, "expected #{this} to throw error " + placeholder + " #{exp} but got #{act}", "expected #{this} to throw error not " + placeholder + " #{exp}", errMsgMatcher, _.checkError.getMessage(caughtErr));
              }
            }
          }
          if (errorLikeFail && errMsgMatcherFail) {
            this.assert(negate, "expected #{this} to throw #{exp} but #{act} was thrown", "expected #{this} to not throw #{exp}" + (caughtErr ? " but #{act} was thrown" : ""), errorLike instanceof Error ? errorLike.toString() : errorLike && _.checkError.getConstructorName(errorLike), caughtErr instanceof Error ? caughtErr.toString() : caughtErr && _.checkError.getConstructorName(caughtErr));
          }
          flag(this, "object", caughtErr);
        }
        ;
        Assertion.addMethod("throw", assertThrows);
        Assertion.addMethod("throws", assertThrows);
        Assertion.addMethod("Throw", assertThrows);
        function respondTo(method, msg) {
          if (msg)
            flag(this, "message", msg);
          var obj = flag(this, "object"), itself = flag(this, "itself"), context = "function" === typeof obj && !itself ? obj.prototype[method] : obj[method];
          this.assert("function" === typeof context, "expected #{this} to respond to " + _.inspect(method), "expected #{this} to not respond to " + _.inspect(method));
        }
        Assertion.addMethod("respondTo", respondTo);
        Assertion.addMethod("respondsTo", respondTo);
        Assertion.addProperty("itself", function() {
          flag(this, "itself", true);
        });
        function satisfy(matcher, msg) {
          if (msg)
            flag(this, "message", msg);
          var obj = flag(this, "object");
          var result = matcher(obj);
          this.assert(result, "expected #{this} to satisfy " + _.objDisplay(matcher), "expected #{this} to not satisfy" + _.objDisplay(matcher), flag(this, "negate") ? false : true, result);
        }
        Assertion.addMethod("satisfy", satisfy);
        Assertion.addMethod("satisfies", satisfy);
        function closeTo(expected, delta, msg) {
          if (msg)
            flag(this, "message", msg);
          var obj = flag(this, "object"), flagMsg = flag(this, "message"), ssfi = flag(this, "ssfi");
          new Assertion(obj, flagMsg, ssfi, true).is.a("number");
          if (typeof expected !== "number" || typeof delta !== "number") {
            flagMsg = flagMsg ? flagMsg + ": " : "";
            var deltaMessage = delta === void 0 ? ", and a delta is required" : "";
            throw new AssertionError(flagMsg + "the arguments to closeTo or approximately must be numbers" + deltaMessage, void 0, ssfi);
          }
          this.assert(Math.abs(obj - expected) <= delta, "expected #{this} to be close to " + expected + " +/- " + delta, "expected #{this} not to be close to " + expected + " +/- " + delta);
        }
        Assertion.addMethod("closeTo", closeTo);
        Assertion.addMethod("approximately", closeTo);
        function isSubsetOf(subset, superset, cmp, contains, ordered) {
          if (!contains) {
            if (subset.length !== superset.length)
              return false;
            superset = superset.slice();
          }
          return subset.every(function(elem, idx) {
            if (ordered)
              return cmp ? cmp(elem, superset[idx]) : elem === superset[idx];
            if (!cmp) {
              var matchIdx = superset.indexOf(elem);
              if (matchIdx === -1)
                return false;
              if (!contains)
                superset.splice(matchIdx, 1);
              return true;
            }
            return superset.some(function(elem2, matchIdx2) {
              if (!cmp(elem, elem2))
                return false;
              if (!contains)
                superset.splice(matchIdx2, 1);
              return true;
            });
          });
        }
        Assertion.addMethod("members", function(subset, msg) {
          if (msg)
            flag(this, "message", msg);
          var obj = flag(this, "object"), flagMsg = flag(this, "message"), ssfi = flag(this, "ssfi");
          new Assertion(obj, flagMsg, ssfi, true).to.be.an("array");
          new Assertion(subset, flagMsg, ssfi, true).to.be.an("array");
          var contains = flag(this, "contains");
          var ordered = flag(this, "ordered");
          var subject, failMsg, failNegateMsg;
          if (contains) {
            subject = ordered ? "an ordered superset" : "a superset";
            failMsg = "expected #{this} to be " + subject + " of #{exp}";
            failNegateMsg = "expected #{this} to not be " + subject + " of #{exp}";
          } else {
            subject = ordered ? "ordered members" : "members";
            failMsg = "expected #{this} to have the same " + subject + " as #{exp}";
            failNegateMsg = "expected #{this} to not have the same " + subject + " as #{exp}";
          }
          var cmp = flag(this, "deep") ? _.eql : void 0;
          this.assert(isSubsetOf(subset, obj, cmp, contains, ordered), failMsg, failNegateMsg, subset, obj, true);
        });
        function oneOf(list, msg) {
          if (msg)
            flag(this, "message", msg);
          var expected = flag(this, "object"), flagMsg = flag(this, "message"), ssfi = flag(this, "ssfi"), contains = flag(this, "contains"), isDeep = flag(this, "deep");
          new Assertion(list, flagMsg, ssfi, true).to.be.an("array");
          if (contains) {
            this.assert(list.some(function(possibility) {
              return expected.indexOf(possibility) > -1;
            }), "expected #{this} to contain one of #{exp}", "expected #{this} to not contain one of #{exp}", list, expected);
          } else {
            if (isDeep) {
              this.assert(list.some(function(possibility) {
                return _.eql(expected, possibility);
              }), "expected #{this} to deeply equal one of #{exp}", "expected #{this} to deeply equal one of #{exp}", list, expected);
            } else {
              this.assert(list.indexOf(expected) > -1, "expected #{this} to be one of #{exp}", "expected #{this} to not be one of #{exp}", list, expected);
            }
          }
        }
        Assertion.addMethod("oneOf", oneOf);
        function assertChanges(subject, prop, msg) {
          if (msg)
            flag(this, "message", msg);
          var fn = flag(this, "object"), flagMsg = flag(this, "message"), ssfi = flag(this, "ssfi");
          new Assertion(fn, flagMsg, ssfi, true).is.a("function");
          var initial;
          if (!prop) {
            new Assertion(subject, flagMsg, ssfi, true).is.a("function");
            initial = subject();
          } else {
            new Assertion(subject, flagMsg, ssfi, true).to.have.property(prop);
            initial = subject[prop];
          }
          fn();
          var final = prop === void 0 || prop === null ? subject() : subject[prop];
          var msgObj = prop === void 0 || prop === null ? initial : "." + prop;
          flag(this, "deltaMsgObj", msgObj);
          flag(this, "initialDeltaValue", initial);
          flag(this, "finalDeltaValue", final);
          flag(this, "deltaBehavior", "change");
          flag(this, "realDelta", final !== initial);
          this.assert(initial !== final, "expected " + msgObj + " to change", "expected " + msgObj + " to not change");
        }
        Assertion.addMethod("change", assertChanges);
        Assertion.addMethod("changes", assertChanges);
        function assertIncreases(subject, prop, msg) {
          if (msg)
            flag(this, "message", msg);
          var fn = flag(this, "object"), flagMsg = flag(this, "message"), ssfi = flag(this, "ssfi");
          new Assertion(fn, flagMsg, ssfi, true).is.a("function");
          var initial;
          if (!prop) {
            new Assertion(subject, flagMsg, ssfi, true).is.a("function");
            initial = subject();
          } else {
            new Assertion(subject, flagMsg, ssfi, true).to.have.property(prop);
            initial = subject[prop];
          }
          new Assertion(initial, flagMsg, ssfi, true).is.a("number");
          fn();
          var final = prop === void 0 || prop === null ? subject() : subject[prop];
          var msgObj = prop === void 0 || prop === null ? initial : "." + prop;
          flag(this, "deltaMsgObj", msgObj);
          flag(this, "initialDeltaValue", initial);
          flag(this, "finalDeltaValue", final);
          flag(this, "deltaBehavior", "increase");
          flag(this, "realDelta", final - initial);
          this.assert(final - initial > 0, "expected " + msgObj + " to increase", "expected " + msgObj + " to not increase");
        }
        Assertion.addMethod("increase", assertIncreases);
        Assertion.addMethod("increases", assertIncreases);
        function assertDecreases(subject, prop, msg) {
          if (msg)
            flag(this, "message", msg);
          var fn = flag(this, "object"), flagMsg = flag(this, "message"), ssfi = flag(this, "ssfi");
          new Assertion(fn, flagMsg, ssfi, true).is.a("function");
          var initial;
          if (!prop) {
            new Assertion(subject, flagMsg, ssfi, true).is.a("function");
            initial = subject();
          } else {
            new Assertion(subject, flagMsg, ssfi, true).to.have.property(prop);
            initial = subject[prop];
          }
          new Assertion(initial, flagMsg, ssfi, true).is.a("number");
          fn();
          var final = prop === void 0 || prop === null ? subject() : subject[prop];
          var msgObj = prop === void 0 || prop === null ? initial : "." + prop;
          flag(this, "deltaMsgObj", msgObj);
          flag(this, "initialDeltaValue", initial);
          flag(this, "finalDeltaValue", final);
          flag(this, "deltaBehavior", "decrease");
          flag(this, "realDelta", initial - final);
          this.assert(final - initial < 0, "expected " + msgObj + " to decrease", "expected " + msgObj + " to not decrease");
        }
        Assertion.addMethod("decrease", assertDecreases);
        Assertion.addMethod("decreases", assertDecreases);
        function assertDelta(delta, msg) {
          if (msg)
            flag(this, "message", msg);
          var msgObj = flag(this, "deltaMsgObj");
          var initial = flag(this, "initialDeltaValue");
          var final = flag(this, "finalDeltaValue");
          var behavior = flag(this, "deltaBehavior");
          var realDelta = flag(this, "realDelta");
          var expression;
          if (behavior === "change") {
            expression = Math.abs(final - initial) === Math.abs(delta);
          } else {
            expression = realDelta === Math.abs(delta);
          }
          this.assert(expression, "expected " + msgObj + " to " + behavior + " by " + delta, "expected " + msgObj + " to not " + behavior + " by " + delta);
        }
        Assertion.addMethod("by", assertDelta);
        Assertion.addProperty("extensible", function() {
          var obj = flag(this, "object");
          var isExtensible = obj === Object(obj) && Object.isExtensible(obj);
          this.assert(isExtensible, "expected #{this} to be extensible", "expected #{this} to not be extensible");
        });
        Assertion.addProperty("sealed", function() {
          var obj = flag(this, "object");
          var isSealed = obj === Object(obj) ? Object.isSealed(obj) : true;
          this.assert(isSealed, "expected #{this} to be sealed", "expected #{this} to not be sealed");
        });
        Assertion.addProperty("frozen", function() {
          var obj = flag(this, "object");
          var isFrozen = obj === Object(obj) ? Object.isFrozen(obj) : true;
          this.assert(isFrozen, "expected #{this} to be frozen", "expected #{this} to not be frozen");
        });
        Assertion.addProperty("finite", function(msg) {
          var obj = flag(this, "object");
          this.assert(typeof obj === "number" && isFinite(obj), "expected #{this} to be a finite number", "expected #{this} to not be a finite number");
        });
      };
    }
  });

  // node_modules/chai/lib/chai/interface/expect.js
  var require_expect = __commonJS({
    "node_modules/chai/lib/chai/interface/expect.js"(exports, module) {
      module.exports = function(chai, util) {
        chai.expect = function(val, message) {
          return new chai.Assertion(val, message);
        };
        chai.expect.fail = function(actual, expected, message, operator) {
          if (arguments.length < 2) {
            message = actual;
            actual = void 0;
          }
          message = message || "expect.fail()";
          throw new chai.AssertionError(message, {
            actual,
            expected,
            operator
          }, chai.expect.fail);
        };
      };
    }
  });

  // node_modules/chai/lib/chai/interface/should.js
  var require_should = __commonJS({
    "node_modules/chai/lib/chai/interface/should.js"(exports, module) {
      module.exports = function(chai, util) {
        var Assertion = chai.Assertion;
        function loadShould() {
          function shouldGetter() {
            if (this instanceof String || this instanceof Number || this instanceof Boolean || typeof Symbol === "function" && this instanceof Symbol || typeof BigInt === "function" && this instanceof BigInt) {
              return new Assertion(this.valueOf(), null, shouldGetter);
            }
            return new Assertion(this, null, shouldGetter);
          }
          function shouldSetter(value) {
            Object.defineProperty(this, "should", {
              value,
              enumerable: true,
              configurable: true,
              writable: true
            });
          }
          Object.defineProperty(Object.prototype, "should", {
            set: shouldSetter,
            get: shouldGetter,
            configurable: true
          });
          var should = {};
          should.fail = function(actual, expected, message, operator) {
            if (arguments.length < 2) {
              message = actual;
              actual = void 0;
            }
            message = message || "should.fail()";
            throw new chai.AssertionError(message, {
              actual,
              expected,
              operator
            }, should.fail);
          };
          should.equal = function(val1, val2, msg) {
            new Assertion(val1, msg).to.equal(val2);
          };
          should.Throw = function(fn, errt, errs, msg) {
            new Assertion(fn, msg).to.Throw(errt, errs);
          };
          should.exist = function(val, msg) {
            new Assertion(val, msg).to.exist;
          };
          should.not = {};
          should.not.equal = function(val1, val2, msg) {
            new Assertion(val1, msg).to.not.equal(val2);
          };
          should.not.Throw = function(fn, errt, errs, msg) {
            new Assertion(fn, msg).to.not.Throw(errt, errs);
          };
          should.not.exist = function(val, msg) {
            new Assertion(val, msg).to.not.exist;
          };
          should["throw"] = should["Throw"];
          should.not["throw"] = should.not["Throw"];
          return should;
        }
        ;
        chai.should = loadShould;
        chai.Should = loadShould;
      };
    }
  });

  // node_modules/chai/lib/chai/interface/assert.js
  var require_assert = __commonJS({
    "node_modules/chai/lib/chai/interface/assert.js"(exports, module) {
      module.exports = function(chai, util) {
        var Assertion = chai.Assertion, flag = util.flag;
        var assert = chai.assert = function(express, errmsg) {
          var test = new Assertion(null, null, chai.assert, true);
          test.assert(express, errmsg, "[ negation message unavailable ]");
        };
        assert.fail = function(actual, expected, message, operator) {
          if (arguments.length < 2) {
            message = actual;
            actual = void 0;
          }
          message = message || "assert.fail()";
          throw new chai.AssertionError(message, {
            actual,
            expected,
            operator
          }, assert.fail);
        };
        assert.isOk = function(val, msg) {
          new Assertion(val, msg, assert.isOk, true).is.ok;
        };
        assert.isNotOk = function(val, msg) {
          new Assertion(val, msg, assert.isNotOk, true).is.not.ok;
        };
        assert.equal = function(act, exp, msg) {
          var test = new Assertion(act, msg, assert.equal, true);
          test.assert(exp == flag(test, "object"), "expected #{this} to equal #{exp}", "expected #{this} to not equal #{act}", exp, act, true);
        };
        assert.notEqual = function(act, exp, msg) {
          var test = new Assertion(act, msg, assert.notEqual, true);
          test.assert(exp != flag(test, "object"), "expected #{this} to not equal #{exp}", "expected #{this} to equal #{act}", exp, act, true);
        };
        assert.strictEqual = function(act, exp, msg) {
          new Assertion(act, msg, assert.strictEqual, true).to.equal(exp);
        };
        assert.notStrictEqual = function(act, exp, msg) {
          new Assertion(act, msg, assert.notStrictEqual, true).to.not.equal(exp);
        };
        assert.deepEqual = assert.deepStrictEqual = function(act, exp, msg) {
          new Assertion(act, msg, assert.deepEqual, true).to.eql(exp);
        };
        assert.notDeepEqual = function(act, exp, msg) {
          new Assertion(act, msg, assert.notDeepEqual, true).to.not.eql(exp);
        };
        assert.isAbove = function(val, abv, msg) {
          new Assertion(val, msg, assert.isAbove, true).to.be.above(abv);
        };
        assert.isAtLeast = function(val, atlst, msg) {
          new Assertion(val, msg, assert.isAtLeast, true).to.be.least(atlst);
        };
        assert.isBelow = function(val, blw, msg) {
          new Assertion(val, msg, assert.isBelow, true).to.be.below(blw);
        };
        assert.isAtMost = function(val, atmst, msg) {
          new Assertion(val, msg, assert.isAtMost, true).to.be.most(atmst);
        };
        assert.isTrue = function(val, msg) {
          new Assertion(val, msg, assert.isTrue, true).is["true"];
        };
        assert.isNotTrue = function(val, msg) {
          new Assertion(val, msg, assert.isNotTrue, true).to.not.equal(true);
        };
        assert.isFalse = function(val, msg) {
          new Assertion(val, msg, assert.isFalse, true).is["false"];
        };
        assert.isNotFalse = function(val, msg) {
          new Assertion(val, msg, assert.isNotFalse, true).to.not.equal(false);
        };
        assert.isNull = function(val, msg) {
          new Assertion(val, msg, assert.isNull, true).to.equal(null);
        };
        assert.isNotNull = function(val, msg) {
          new Assertion(val, msg, assert.isNotNull, true).to.not.equal(null);
        };
        assert.isNaN = function(val, msg) {
          new Assertion(val, msg, assert.isNaN, true).to.be.NaN;
        };
        assert.isNotNaN = function(val, msg) {
          new Assertion(val, msg, assert.isNotNaN, true).not.to.be.NaN;
        };
        assert.exists = function(val, msg) {
          new Assertion(val, msg, assert.exists, true).to.exist;
        };
        assert.notExists = function(val, msg) {
          new Assertion(val, msg, assert.notExists, true).to.not.exist;
        };
        assert.isUndefined = function(val, msg) {
          new Assertion(val, msg, assert.isUndefined, true).to.equal(void 0);
        };
        assert.isDefined = function(val, msg) {
          new Assertion(val, msg, assert.isDefined, true).to.not.equal(void 0);
        };
        assert.isFunction = function(val, msg) {
          new Assertion(val, msg, assert.isFunction, true).to.be.a("function");
        };
        assert.isNotFunction = function(val, msg) {
          new Assertion(val, msg, assert.isNotFunction, true).to.not.be.a("function");
        };
        assert.isObject = function(val, msg) {
          new Assertion(val, msg, assert.isObject, true).to.be.a("object");
        };
        assert.isNotObject = function(val, msg) {
          new Assertion(val, msg, assert.isNotObject, true).to.not.be.a("object");
        };
        assert.isArray = function(val, msg) {
          new Assertion(val, msg, assert.isArray, true).to.be.an("array");
        };
        assert.isNotArray = function(val, msg) {
          new Assertion(val, msg, assert.isNotArray, true).to.not.be.an("array");
        };
        assert.isString = function(val, msg) {
          new Assertion(val, msg, assert.isString, true).to.be.a("string");
        };
        assert.isNotString = function(val, msg) {
          new Assertion(val, msg, assert.isNotString, true).to.not.be.a("string");
        };
        assert.isNumber = function(val, msg) {
          new Assertion(val, msg, assert.isNumber, true).to.be.a("number");
        };
        assert.isNotNumber = function(val, msg) {
          new Assertion(val, msg, assert.isNotNumber, true).to.not.be.a("number");
        };
        assert.isFinite = function(val, msg) {
          new Assertion(val, msg, assert.isFinite, true).to.be.finite;
        };
        assert.isBoolean = function(val, msg) {
          new Assertion(val, msg, assert.isBoolean, true).to.be.a("boolean");
        };
        assert.isNotBoolean = function(val, msg) {
          new Assertion(val, msg, assert.isNotBoolean, true).to.not.be.a("boolean");
        };
        assert.typeOf = function(val, type, msg) {
          new Assertion(val, msg, assert.typeOf, true).to.be.a(type);
        };
        assert.notTypeOf = function(val, type, msg) {
          new Assertion(val, msg, assert.notTypeOf, true).to.not.be.a(type);
        };
        assert.instanceOf = function(val, type, msg) {
          new Assertion(val, msg, assert.instanceOf, true).to.be.instanceOf(type);
        };
        assert.notInstanceOf = function(val, type, msg) {
          new Assertion(val, msg, assert.notInstanceOf, true).to.not.be.instanceOf(type);
        };
        assert.include = function(exp, inc, msg) {
          new Assertion(exp, msg, assert.include, true).include(inc);
        };
        assert.notInclude = function(exp, inc, msg) {
          new Assertion(exp, msg, assert.notInclude, true).not.include(inc);
        };
        assert.deepInclude = function(exp, inc, msg) {
          new Assertion(exp, msg, assert.deepInclude, true).deep.include(inc);
        };
        assert.notDeepInclude = function(exp, inc, msg) {
          new Assertion(exp, msg, assert.notDeepInclude, true).not.deep.include(inc);
        };
        assert.nestedInclude = function(exp, inc, msg) {
          new Assertion(exp, msg, assert.nestedInclude, true).nested.include(inc);
        };
        assert.notNestedInclude = function(exp, inc, msg) {
          new Assertion(exp, msg, assert.notNestedInclude, true).not.nested.include(inc);
        };
        assert.deepNestedInclude = function(exp, inc, msg) {
          new Assertion(exp, msg, assert.deepNestedInclude, true).deep.nested.include(inc);
        };
        assert.notDeepNestedInclude = function(exp, inc, msg) {
          new Assertion(exp, msg, assert.notDeepNestedInclude, true).not.deep.nested.include(inc);
        };
        assert.ownInclude = function(exp, inc, msg) {
          new Assertion(exp, msg, assert.ownInclude, true).own.include(inc);
        };
        assert.notOwnInclude = function(exp, inc, msg) {
          new Assertion(exp, msg, assert.notOwnInclude, true).not.own.include(inc);
        };
        assert.deepOwnInclude = function(exp, inc, msg) {
          new Assertion(exp, msg, assert.deepOwnInclude, true).deep.own.include(inc);
        };
        assert.notDeepOwnInclude = function(exp, inc, msg) {
          new Assertion(exp, msg, assert.notDeepOwnInclude, true).not.deep.own.include(inc);
        };
        assert.match = function(exp, re, msg) {
          new Assertion(exp, msg, assert.match, true).to.match(re);
        };
        assert.notMatch = function(exp, re, msg) {
          new Assertion(exp, msg, assert.notMatch, true).to.not.match(re);
        };
        assert.property = function(obj, prop, msg) {
          new Assertion(obj, msg, assert.property, true).to.have.property(prop);
        };
        assert.notProperty = function(obj, prop, msg) {
          new Assertion(obj, msg, assert.notProperty, true).to.not.have.property(prop);
        };
        assert.propertyVal = function(obj, prop, val, msg) {
          new Assertion(obj, msg, assert.propertyVal, true).to.have.property(prop, val);
        };
        assert.notPropertyVal = function(obj, prop, val, msg) {
          new Assertion(obj, msg, assert.notPropertyVal, true).to.not.have.property(prop, val);
        };
        assert.deepPropertyVal = function(obj, prop, val, msg) {
          new Assertion(obj, msg, assert.deepPropertyVal, true).to.have.deep.property(prop, val);
        };
        assert.notDeepPropertyVal = function(obj, prop, val, msg) {
          new Assertion(obj, msg, assert.notDeepPropertyVal, true).to.not.have.deep.property(prop, val);
        };
        assert.ownProperty = function(obj, prop, msg) {
          new Assertion(obj, msg, assert.ownProperty, true).to.have.own.property(prop);
        };
        assert.notOwnProperty = function(obj, prop, msg) {
          new Assertion(obj, msg, assert.notOwnProperty, true).to.not.have.own.property(prop);
        };
        assert.ownPropertyVal = function(obj, prop, value, msg) {
          new Assertion(obj, msg, assert.ownPropertyVal, true).to.have.own.property(prop, value);
        };
        assert.notOwnPropertyVal = function(obj, prop, value, msg) {
          new Assertion(obj, msg, assert.notOwnPropertyVal, true).to.not.have.own.property(prop, value);
        };
        assert.deepOwnPropertyVal = function(obj, prop, value, msg) {
          new Assertion(obj, msg, assert.deepOwnPropertyVal, true).to.have.deep.own.property(prop, value);
        };
        assert.notDeepOwnPropertyVal = function(obj, prop, value, msg) {
          new Assertion(obj, msg, assert.notDeepOwnPropertyVal, true).to.not.have.deep.own.property(prop, value);
        };
        assert.nestedProperty = function(obj, prop, msg) {
          new Assertion(obj, msg, assert.nestedProperty, true).to.have.nested.property(prop);
        };
        assert.notNestedProperty = function(obj, prop, msg) {
          new Assertion(obj, msg, assert.notNestedProperty, true).to.not.have.nested.property(prop);
        };
        assert.nestedPropertyVal = function(obj, prop, val, msg) {
          new Assertion(obj, msg, assert.nestedPropertyVal, true).to.have.nested.property(prop, val);
        };
        assert.notNestedPropertyVal = function(obj, prop, val, msg) {
          new Assertion(obj, msg, assert.notNestedPropertyVal, true).to.not.have.nested.property(prop, val);
        };
        assert.deepNestedPropertyVal = function(obj, prop, val, msg) {
          new Assertion(obj, msg, assert.deepNestedPropertyVal, true).to.have.deep.nested.property(prop, val);
        };
        assert.notDeepNestedPropertyVal = function(obj, prop, val, msg) {
          new Assertion(obj, msg, assert.notDeepNestedPropertyVal, true).to.not.have.deep.nested.property(prop, val);
        };
        assert.lengthOf = function(exp, len, msg) {
          new Assertion(exp, msg, assert.lengthOf, true).to.have.lengthOf(len);
        };
        assert.hasAnyKeys = function(obj, keys, msg) {
          new Assertion(obj, msg, assert.hasAnyKeys, true).to.have.any.keys(keys);
        };
        assert.hasAllKeys = function(obj, keys, msg) {
          new Assertion(obj, msg, assert.hasAllKeys, true).to.have.all.keys(keys);
        };
        assert.containsAllKeys = function(obj, keys, msg) {
          new Assertion(obj, msg, assert.containsAllKeys, true).to.contain.all.keys(keys);
        };
        assert.doesNotHaveAnyKeys = function(obj, keys, msg) {
          new Assertion(obj, msg, assert.doesNotHaveAnyKeys, true).to.not.have.any.keys(keys);
        };
        assert.doesNotHaveAllKeys = function(obj, keys, msg) {
          new Assertion(obj, msg, assert.doesNotHaveAllKeys, true).to.not.have.all.keys(keys);
        };
        assert.hasAnyDeepKeys = function(obj, keys, msg) {
          new Assertion(obj, msg, assert.hasAnyDeepKeys, true).to.have.any.deep.keys(keys);
        };
        assert.hasAllDeepKeys = function(obj, keys, msg) {
          new Assertion(obj, msg, assert.hasAllDeepKeys, true).to.have.all.deep.keys(keys);
        };
        assert.containsAllDeepKeys = function(obj, keys, msg) {
          new Assertion(obj, msg, assert.containsAllDeepKeys, true).to.contain.all.deep.keys(keys);
        };
        assert.doesNotHaveAnyDeepKeys = function(obj, keys, msg) {
          new Assertion(obj, msg, assert.doesNotHaveAnyDeepKeys, true).to.not.have.any.deep.keys(keys);
        };
        assert.doesNotHaveAllDeepKeys = function(obj, keys, msg) {
          new Assertion(obj, msg, assert.doesNotHaveAllDeepKeys, true).to.not.have.all.deep.keys(keys);
        };
        assert.throws = function(fn, errorLike, errMsgMatcher, msg) {
          if ("string" === typeof errorLike || errorLike instanceof RegExp) {
            errMsgMatcher = errorLike;
            errorLike = null;
          }
          var assertErr = new Assertion(fn, msg, assert.throws, true).to.throw(errorLike, errMsgMatcher);
          return flag(assertErr, "object");
        };
        assert.doesNotThrow = function(fn, errorLike, errMsgMatcher, msg) {
          if ("string" === typeof errorLike || errorLike instanceof RegExp) {
            errMsgMatcher = errorLike;
            errorLike = null;
          }
          new Assertion(fn, msg, assert.doesNotThrow, true).to.not.throw(errorLike, errMsgMatcher);
        };
        assert.operator = function(val, operator, val2, msg) {
          var ok;
          switch (operator) {
            case "==":
              ok = val == val2;
              break;
            case "===":
              ok = val === val2;
              break;
            case ">":
              ok = val > val2;
              break;
            case ">=":
              ok = val >= val2;
              break;
            case "<":
              ok = val < val2;
              break;
            case "<=":
              ok = val <= val2;
              break;
            case "!=":
              ok = val != val2;
              break;
            case "!==":
              ok = val !== val2;
              break;
            default:
              msg = msg ? msg + ": " : msg;
              throw new chai.AssertionError(msg + 'Invalid operator "' + operator + '"', void 0, assert.operator);
          }
          var test = new Assertion(ok, msg, assert.operator, true);
          test.assert(true === flag(test, "object"), "expected " + util.inspect(val) + " to be " + operator + " " + util.inspect(val2), "expected " + util.inspect(val) + " to not be " + operator + " " + util.inspect(val2));
        };
        assert.closeTo = function(act, exp, delta, msg) {
          new Assertion(act, msg, assert.closeTo, true).to.be.closeTo(exp, delta);
        };
        assert.approximately = function(act, exp, delta, msg) {
          new Assertion(act, msg, assert.approximately, true).to.be.approximately(exp, delta);
        };
        assert.sameMembers = function(set1, set2, msg) {
          new Assertion(set1, msg, assert.sameMembers, true).to.have.same.members(set2);
        };
        assert.notSameMembers = function(set1, set2, msg) {
          new Assertion(set1, msg, assert.notSameMembers, true).to.not.have.same.members(set2);
        };
        assert.sameDeepMembers = function(set1, set2, msg) {
          new Assertion(set1, msg, assert.sameDeepMembers, true).to.have.same.deep.members(set2);
        };
        assert.notSameDeepMembers = function(set1, set2, msg) {
          new Assertion(set1, msg, assert.notSameDeepMembers, true).to.not.have.same.deep.members(set2);
        };
        assert.sameOrderedMembers = function(set1, set2, msg) {
          new Assertion(set1, msg, assert.sameOrderedMembers, true).to.have.same.ordered.members(set2);
        };
        assert.notSameOrderedMembers = function(set1, set2, msg) {
          new Assertion(set1, msg, assert.notSameOrderedMembers, true).to.not.have.same.ordered.members(set2);
        };
        assert.sameDeepOrderedMembers = function(set1, set2, msg) {
          new Assertion(set1, msg, assert.sameDeepOrderedMembers, true).to.have.same.deep.ordered.members(set2);
        };
        assert.notSameDeepOrderedMembers = function(set1, set2, msg) {
          new Assertion(set1, msg, assert.notSameDeepOrderedMembers, true).to.not.have.same.deep.ordered.members(set2);
        };
        assert.includeMembers = function(superset, subset, msg) {
          new Assertion(superset, msg, assert.includeMembers, true).to.include.members(subset);
        };
        assert.notIncludeMembers = function(superset, subset, msg) {
          new Assertion(superset, msg, assert.notIncludeMembers, true).to.not.include.members(subset);
        };
        assert.includeDeepMembers = function(superset, subset, msg) {
          new Assertion(superset, msg, assert.includeDeepMembers, true).to.include.deep.members(subset);
        };
        assert.notIncludeDeepMembers = function(superset, subset, msg) {
          new Assertion(superset, msg, assert.notIncludeDeepMembers, true).to.not.include.deep.members(subset);
        };
        assert.includeOrderedMembers = function(superset, subset, msg) {
          new Assertion(superset, msg, assert.includeOrderedMembers, true).to.include.ordered.members(subset);
        };
        assert.notIncludeOrderedMembers = function(superset, subset, msg) {
          new Assertion(superset, msg, assert.notIncludeOrderedMembers, true).to.not.include.ordered.members(subset);
        };
        assert.includeDeepOrderedMembers = function(superset, subset, msg) {
          new Assertion(superset, msg, assert.includeDeepOrderedMembers, true).to.include.deep.ordered.members(subset);
        };
        assert.notIncludeDeepOrderedMembers = function(superset, subset, msg) {
          new Assertion(superset, msg, assert.notIncludeDeepOrderedMembers, true).to.not.include.deep.ordered.members(subset);
        };
        assert.oneOf = function(inList, list, msg) {
          new Assertion(inList, msg, assert.oneOf, true).to.be.oneOf(list);
        };
        assert.changes = function(fn, obj, prop, msg) {
          if (arguments.length === 3 && typeof obj === "function") {
            msg = prop;
            prop = null;
          }
          new Assertion(fn, msg, assert.changes, true).to.change(obj, prop);
        };
        assert.changesBy = function(fn, obj, prop, delta, msg) {
          if (arguments.length === 4 && typeof obj === "function") {
            var tmpMsg = delta;
            delta = prop;
            msg = tmpMsg;
          } else if (arguments.length === 3) {
            delta = prop;
            prop = null;
          }
          new Assertion(fn, msg, assert.changesBy, true).to.change(obj, prop).by(delta);
        };
        assert.doesNotChange = function(fn, obj, prop, msg) {
          if (arguments.length === 3 && typeof obj === "function") {
            msg = prop;
            prop = null;
          }
          return new Assertion(fn, msg, assert.doesNotChange, true).to.not.change(obj, prop);
        };
        assert.changesButNotBy = function(fn, obj, prop, delta, msg) {
          if (arguments.length === 4 && typeof obj === "function") {
            var tmpMsg = delta;
            delta = prop;
            msg = tmpMsg;
          } else if (arguments.length === 3) {
            delta = prop;
            prop = null;
          }
          new Assertion(fn, msg, assert.changesButNotBy, true).to.change(obj, prop).but.not.by(delta);
        };
        assert.increases = function(fn, obj, prop, msg) {
          if (arguments.length === 3 && typeof obj === "function") {
            msg = prop;
            prop = null;
          }
          return new Assertion(fn, msg, assert.increases, true).to.increase(obj, prop);
        };
        assert.increasesBy = function(fn, obj, prop, delta, msg) {
          if (arguments.length === 4 && typeof obj === "function") {
            var tmpMsg = delta;
            delta = prop;
            msg = tmpMsg;
          } else if (arguments.length === 3) {
            delta = prop;
            prop = null;
          }
          new Assertion(fn, msg, assert.increasesBy, true).to.increase(obj, prop).by(delta);
        };
        assert.doesNotIncrease = function(fn, obj, prop, msg) {
          if (arguments.length === 3 && typeof obj === "function") {
            msg = prop;
            prop = null;
          }
          return new Assertion(fn, msg, assert.doesNotIncrease, true).to.not.increase(obj, prop);
        };
        assert.increasesButNotBy = function(fn, obj, prop, delta, msg) {
          if (arguments.length === 4 && typeof obj === "function") {
            var tmpMsg = delta;
            delta = prop;
            msg = tmpMsg;
          } else if (arguments.length === 3) {
            delta = prop;
            prop = null;
          }
          new Assertion(fn, msg, assert.increasesButNotBy, true).to.increase(obj, prop).but.not.by(delta);
        };
        assert.decreases = function(fn, obj, prop, msg) {
          if (arguments.length === 3 && typeof obj === "function") {
            msg = prop;
            prop = null;
          }
          return new Assertion(fn, msg, assert.decreases, true).to.decrease(obj, prop);
        };
        assert.decreasesBy = function(fn, obj, prop, delta, msg) {
          if (arguments.length === 4 && typeof obj === "function") {
            var tmpMsg = delta;
            delta = prop;
            msg = tmpMsg;
          } else if (arguments.length === 3) {
            delta = prop;
            prop = null;
          }
          new Assertion(fn, msg, assert.decreasesBy, true).to.decrease(obj, prop).by(delta);
        };
        assert.doesNotDecrease = function(fn, obj, prop, msg) {
          if (arguments.length === 3 && typeof obj === "function") {
            msg = prop;
            prop = null;
          }
          return new Assertion(fn, msg, assert.doesNotDecrease, true).to.not.decrease(obj, prop);
        };
        assert.doesNotDecreaseBy = function(fn, obj, prop, delta, msg) {
          if (arguments.length === 4 && typeof obj === "function") {
            var tmpMsg = delta;
            delta = prop;
            msg = tmpMsg;
          } else if (arguments.length === 3) {
            delta = prop;
            prop = null;
          }
          return new Assertion(fn, msg, assert.doesNotDecreaseBy, true).to.not.decrease(obj, prop).by(delta);
        };
        assert.decreasesButNotBy = function(fn, obj, prop, delta, msg) {
          if (arguments.length === 4 && typeof obj === "function") {
            var tmpMsg = delta;
            delta = prop;
            msg = tmpMsg;
          } else if (arguments.length === 3) {
            delta = prop;
            prop = null;
          }
          new Assertion(fn, msg, assert.decreasesButNotBy, true).to.decrease(obj, prop).but.not.by(delta);
        };
        assert.ifError = function(val) {
          if (val) {
            throw val;
          }
        };
        assert.isExtensible = function(obj, msg) {
          new Assertion(obj, msg, assert.isExtensible, true).to.be.extensible;
        };
        assert.isNotExtensible = function(obj, msg) {
          new Assertion(obj, msg, assert.isNotExtensible, true).to.not.be.extensible;
        };
        assert.isSealed = function(obj, msg) {
          new Assertion(obj, msg, assert.isSealed, true).to.be.sealed;
        };
        assert.isNotSealed = function(obj, msg) {
          new Assertion(obj, msg, assert.isNotSealed, true).to.not.be.sealed;
        };
        assert.isFrozen = function(obj, msg) {
          new Assertion(obj, msg, assert.isFrozen, true).to.be.frozen;
        };
        assert.isNotFrozen = function(obj, msg) {
          new Assertion(obj, msg, assert.isNotFrozen, true).to.not.be.frozen;
        };
        assert.isEmpty = function(val, msg) {
          new Assertion(val, msg, assert.isEmpty, true).to.be.empty;
        };
        assert.isNotEmpty = function(val, msg) {
          new Assertion(val, msg, assert.isNotEmpty, true).to.not.be.empty;
        };
        (function alias(name, as) {
          assert[as] = assert[name];
          return alias;
        })("isOk", "ok")("isNotOk", "notOk")("throws", "throw")("throws", "Throw")("isExtensible", "extensible")("isNotExtensible", "notExtensible")("isSealed", "sealed")("isNotSealed", "notSealed")("isFrozen", "frozen")("isNotFrozen", "notFrozen")("isEmpty", "empty")("isNotEmpty", "notEmpty");
      };
    }
  });

  // node_modules/chai/lib/chai.js
  var require_chai = __commonJS({
    "node_modules/chai/lib/chai.js"(exports) {
      var used = [];
      exports.version = "4.3.3";
      exports.AssertionError = require_assertion_error();
      var util = require_utils();
      exports.use = function(fn) {
        if (!~used.indexOf(fn)) {
          fn(exports, util);
          used.push(fn);
        }
        return exports;
      };
      exports.util = util;
      var config = require_config();
      exports.config = config;
      var assertion = require_assertion();
      exports.use(assertion);
      var core = require_assertions();
      exports.use(core);
      var expect = require_expect();
      exports.use(expect);
      var should = require_should();
      exports.use(should);
      var assert = require_assert();
      exports.use(assert);
    }
  });

  // node_modules/chai/index.js
  var require_chai2 = __commonJS({
    "node_modules/chai/index.js"(exports, module) {
      module.exports = require_chai();
    }
  });

  // test/browser/src/base.test.cjs
  var require_base_test = __commonJS({
    "test/browser/src/base.test.cjs"() {
      var { getDirname, getFilename } = require_cjs();
      var { expect } = require_chai2();
      describe("Browser CJS", () => {
        it("getDirname() should be a string", function() {
          console.debug("	getDirname() 	->", getDirname());
          expect(getDirname()).to.be.a("string");
        });
        it("getFilename() should be a string", function() {
          console.debug("	getFilename() 	->", getFilename());
          expect(getFilename()).to.be.a("string");
        });
        it('getFilename() should end with "base.test.js"', function() {
          expect(getFilename().endsWith("base.test.js")).to.be.true;
        });
      });
    }
  });
  require_base_test();
})();
/*!
 * ### ._obj
 *
 * Quick reference to stored `actual` value for plugin developers.
 *
 * @api private
 */
/*!
 * ### .ifError(object)
 *
 * Asserts if value is not a false value, and throws if it is a true value.
 * This is added to allow for chai to be a drop-in replacement for Node's
 * assert class.
 *
 *     var err = new Error('I am a custom error');
 *     assert.ifError(err); // Rethrows err!
 *
 * @name ifError
 * @param {Object} object
 * @namespace Assert
 * @api public
 */
/*!
 * Add a chainable method
 */
/*!
 * Aliases.
 */
/*!
 * Assert interface
 */
/*!
 * Assertion Constructor
 *
 * Creates object for chaining.
 *
 * `Assertion` objects contain metadata in the form of flags. Three flags can
 * be assigned during instantiation by passing arguments to this constructor:
 *
 * - `object`: This flag contains the target of the assertion. For example, in
 *   the assertion `expect(numKittens).to.equal(7);`, the `object` flag will
 *   contain `numKittens` so that the `equal` assertion can reference it when
 *   needed.
 *
 * - `message`: This flag contains an optional custom error message to be
 *   prepended to the error message that's generated by the assertion when it
 *   fails.
 *
 * - `ssfi`: This flag stands for "start stack function indicator". It
 *   contains a function reference that serves as the starting point for
 *   removing frames from the stack trace of the error that's created by the
 *   assertion when it fails. The goal is to provide a cleaner stack trace to
 *   end users by removing Chai's internal functions. Note that it only works
 *   in environments that support `Error.captureStackTrace`, and only when
 *   `Chai.config.includeStack` hasn't been set to `false`.
 *
 * - `lockSsfi`: This flag controls whether or not the given `ssfi` flag
 *   should retain its current value, even as assertions are chained off of
 *   this object. This is usually set to `true` when creating a new assertion
 *   from within another assertion. It's also temporarily set to `true` before
 *   an overwritten assertion gets called by the overwriting assertion.
 *
 * @param {Mixed} obj target of the assertion
 * @param {String} msg (optional) custom error message
 * @param {Function} ssfi (optional) starting point for removing stack frames
 * @param {Boolean} lockSsfi (optional) whether or not the ssfi flag is locked
 * @api private
 */
/*!
 * Assertion Error
 */
/*!
 * Chai - addChainingMethod utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * Chai - addLengthGuard utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * Chai - addMethod utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * Chai - addProperty utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * Chai - compareByInspect utility
 * Copyright(c) 2011-2016 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * Chai - expectTypes utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * Chai - flag utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * Chai - getActual utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * Chai - getOwnEnumerableProperties utility
 * Copyright(c) 2011-2016 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * Chai - getOwnEnumerablePropertySymbols utility
 * Copyright(c) 2011-2016 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * Chai - getProperties utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * Chai - isNaN utility
 * Copyright(c) 2012-2015 Sakthipriyan Vairamani <thechargingvolcano@gmail.com>
 * MIT Licensed
 */
/*!
 * Chai - isProxyEnabled helper
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * Chai - message composition utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * Chai - overwriteChainableMethod utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * Chai - overwriteMethod utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * Chai - overwriteProperty utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * Chai - proxify utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * Chai - test utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * Chai - transferFlags utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * Chai dependencies.
 */
/*!
 * Chai version
 */
/*!
 * Check if a property exists
 */
/*!
 * Check to see if the MemoizeMap has recorded a result of the two operands
 *
 * @param {Mixed} leftHandOperand
 * @param {Mixed} rightHandOperand
 * @param {MemoizeMap} memoizeMap
 * @returns {Boolean|null} result
*/
/*!
 * Checks error against a given set of criteria
 */
/*!
 * Compare by inspect method
 */
/*!
 * Compare two Regular Expressions for equality.
 *
 * @param {RegExp} leftHandOperand
 * @param {RegExp} rightHandOperand
 * @return {Boolean} result
 */
/*!
 * Compare two Sets/Maps for equality. Faster than other equality functions.
 *
 * @param {Set} leftHandOperand
 * @param {Set} rightHandOperand
 * @param {Object} [options] (Optional)
 * @return {Boolean} result
 */
/*!
 * Configuration
 */
/*!
 * Core Assertions
 */
/*!
 * Deep equal utility
 */
/*!
 * Deep path info
 */
/*!
 * Dependencies that are used for multiple exports are required here only once
 */
/*!
 * Determine if the given object has an @@iterator function.
 *
 * @param {Object} target
 * @return {Boolean} `true` if the object has an @@iterator function.
 */
/*!
 * Determines if two objects have matching values, given a set of keys. Defers to deepEqual for the equality check of
 * each key. If any value of the given key is not equal, the function will return false (early).
 *
 * @param {Mixed} leftHandOperand
 * @param {Mixed} rightHandOperand
 * @param {Array} keys An array of keys to compare the values of leftHandOperand and rightHandOperand against
 * @param {Object} [options] (Optional)
 * @return {Boolean} result
 */
/*!
 * Ensure correct constructor
 */
/*!
 * Expect interface
 */
/*!
 * Flag transferring utility
 */
/*!
 * Flag utility
 */
/*!
 * Function name
 */
/*!
 * Get own enumerable properties method
 */
/*!
 * Get own enumerable property symbols method
 */
/*!
 * Gets all entries from a Generator. This will consume the generator - which could have side effects.
 *
 * @param {Generator} target
 * @returns {Array} an array of entries from the Generator.
 */
/*!
 * Gets all iterator entries from the given Object. If the Object has no @@iterator function, returns an empty array.
 * This will consume the iterator - which could have side effects depending on the @@iterator implementation.
 *
 * @param {Object} target
 * @returns {Array} an array of entries from the @@iterator function
 */
/*!
 * Gets all own and inherited enumerable keys from a target.
 *
 * @param {Object} target
 * @returns {Array} an array of own and inherited enumerable keys from the target.
 */
/*!
 * Inherit from Error.prototype
 */
/*!
 * Inspect util
 */
/*!
 * Module dependencies
 */
/*!
 * Module dependencies.
 */
/*!
 * Module export.
 */
/*!
 * Module variables
 */
/*!
 * Object Display util
 */
/*!
 * Overwrite chainable method
 */
/*!
 * Primary Export
 */
/*!
 * Primary Exports
 */
/*!
 * Primary `Assertion` prototype
 */
/*!
 * Proxify util
 */
/*!
 * Recursively check the equality of two Objects. Once basic sameness has been established it will defer to `deepEqual`
 * for each enumerable key in the object.
 *
 * @param {Mixed} leftHandOperand
 * @param {Mixed} rightHandOperand
 * @param {Object} [options] (Optional)
 * @return {Boolean} result
 */
/*!
 * Return a function that will copy properties from
 * one object to another excluding any originally
 * listed. Returned function will create a new `{}`.
 *
 * @param {String} excluded properties ...
 * @return {Function}
 */
/*!
 * Returns true if the argument is a primitive.
 *
 * This intentionally returns true for all objects that can be compared by reference,
 * including functions and symbols.
 *
 * @param {Mixed} value
 * @return {Boolean} result
 */
/*!
 * Set the result of the equality into the MemoizeMap
 *
 * @param {Mixed} leftHandOperand
 * @param {Mixed} rightHandOperand
 * @param {MemoizeMap} memoizeMap
 * @param {Boolean} result
*/
/*!
 * Should interface
 */
/*!
 * Simple equality for flat iterable objects such as Arrays, TypedArrays or Node.js buffers.
 *
 * @param {Iterable} leftHandOperand
 * @param {Iterable} rightHandOperand
 * @param {Object} [options] (Optional)
 * @return {Boolean} result
 */
/*!
 * Simple equality for generator objects such as those returned by generator functions.
 *
 * @param {Iterable} leftHandOperand
 * @param {Iterable} rightHandOperand
 * @param {Object} [options] (Optional)
 * @return {Boolean} result
 */
/*!
 * Statically set name
 */
/*!
 * The main logic of the `deepEqual` function.
 *
 * @param {Mixed} leftHandOperand
 * @param {Mixed} rightHandOperand
 * @param {Object} [options] (optional) Additional options
 * @param {Array} [options.comparator] (optional) Override default algorithm, determining custom equality.
 * @param {Array} [options.memoize] (optional) Provide a custom memoization object which will cache the results of
    complex objects for a speed boost. By passing `false` you can disable memoization, but this will cause circular
    references to blow the stack.
 * @return {Boolean} equal match
*/
/*!
 * Utility Functions
 */
/*!
 * Utils for plugins (not exported)
 */
/*!
 * actual utility
 */
/*!
 * add Method
 */
/*!
 * add Property
 */
/*!
 * addLengthGuard util
 */
/*!
 * assertion-error
 * Copyright(c) 2013 Jake Luer <jake@qualiancy.com>
 * MIT Licensed
 */
/*!
 * chai
 * Copyright(c) 2011 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * chai
 * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * chai
 * http://chaijs.com
 * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * deep-eql
 * Copyright(c) 2013 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
/*!
 * expectTypes utility
 */
/*!
 * getOperator method
 */
/*!
 * isNaN method
 */
/*!
 * isProxyEnabled helper
 */
/*!
 * message utility
 */
/*!
 * overwrite Method
 */
/*!
 * overwrite Property
 */
/*!
 * test utility
 */
/*!
 * type utility
 */
