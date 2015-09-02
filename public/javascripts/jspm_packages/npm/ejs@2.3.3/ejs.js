/* */ 
(function(process) {
  (function e(t, n, r) {
    function s(o, u) {
      if (!n[o]) {
        if (!t[o]) {
          var a = typeof require == "function" && require;
          if (!u && a)
            return a(o, !0);
          if (i)
            return i(o, !0);
          var f = new Error("Cannot find module '" + o + "'");
          throw f.code = "MODULE_NOT_FOUND", f;
        }
        var l = n[o] = {exports: {}};
        t[o][0].call(l.exports, function(e) {
          var n = t[o][1][e];
          return s(n ? n : e);
        }, l, l.exports, e, t, n, r);
      }
      return n[o].exports;
    }
    var i = typeof require == "function" && require;
    for (var o = 0; o < r.length; o++)
      s(r[o]);
    return s;
  })({
    1: [function(require, module, exports) {
      'use strict';
      var fs = require("fs"),
          utils = require("./utils"),
          scopeOptionWarned = false,
          _VERSION_STRING = require("../package.json!systemjs-json").version,
          _DEFAULT_DELIMITER = '%',
          _DEFAULT_LOCALS_NAME = 'locals',
          _REGEX_STRING = '(<%%|<%=|<%-|<%#|<%|%>|-%>)',
          _OPTS = ['cache', 'filename', 'delimiter', 'scope', 'context', 'debug', 'compileDebug', 'client', '_with'],
          _TRAILING_SEMCOL = /;\s*$/,
          _BOM = /^\uFEFF/;
      exports.cache = utils.cache;
      exports.localsName = _DEFAULT_LOCALS_NAME;
      exports.resolveInclude = function(name, filename) {
        var path = require("path"),
            dirname = path.dirname,
            extname = path.extname,
            resolve = path.resolve,
            includePath = resolve(dirname(filename), name),
            ext = extname(name);
        if (!ext) {
          includePath += '.ejs';
        }
        return includePath;
      };
      function handleCache(options, template) {
        var fn,
            path = options.filename,
            hasTemplate = arguments.length > 1;
        if (options.cache) {
          if (!path) {
            throw new Error('cache option requires a filename');
          }
          fn = exports.cache.get(path);
          if (fn) {
            return fn;
          }
          if (!hasTemplate) {
            template = fs.readFileSync(path).toString().replace(_BOM, '');
          }
        } else if (!hasTemplate) {
          if (!path) {
            throw new Error('Internal EJS error: no file name or template ' + 'provided');
          }
          template = fs.readFileSync(path).toString().replace(_BOM, '');
        }
        fn = exports.compile(template, options);
        if (options.cache) {
          exports.cache.set(path, fn);
        }
        return fn;
      }
      function includeFile(path, options) {
        var opts = utils.shallowCopy({}, options);
        if (!opts.filename) {
          throw new Error('`include` requires the \'filename\' option.');
        }
        opts.filename = exports.resolveInclude(path, opts.filename);
        return handleCache(opts);
      }
      function includeSource(path, options) {
        var opts = utils.shallowCopy({}, options),
            includePath,
            template;
        if (!opts.filename) {
          throw new Error('`include` requires the \'filename\' option.');
        }
        includePath = exports.resolveInclude(path, opts.filename);
        template = fs.readFileSync(includePath).toString().replace(_BOM, '');
        opts.filename = includePath;
        var templ = new Template(template, opts);
        templ.generateSource();
        return templ.source;
      }
      function rethrow(err, str, filename, lineno) {
        var lines = str.split('\n'),
            start = Math.max(lineno - 3, 0),
            end = Math.min(lines.length, lineno + 3);
        var context = lines.slice(start, end).map(function(line, i) {
          var curr = i + start + 1;
          return (curr == lineno ? ' >> ' : '    ') + curr + '| ' + line;
        }).join('\n');
        err.path = filename;
        err.message = (filename || 'ejs') + ':' + lineno + '\n' + context + '\n\n' + err.message;
        throw err;
      }
      function cpOptsInData(data, opts) {
        _OPTS.forEach(function(p) {
          if (typeof data[p] != 'undefined') {
            opts[p] = data[p];
          }
        });
      }
      exports.compile = function compile(template, opts) {
        var templ;
        if (opts && opts.scope) {
          if (!scopeOptionWarned) {
            console.warn('`scope` option is deprecated and will be removed in EJS 3');
            scopeOptionWarned = true;
          }
          if (!opts.context) {
            opts.context = opts.scope;
          }
          delete opts.scope;
        }
        templ = new Template(template, opts);
        return templ.compile();
      };
      exports.render = function(template, data, opts) {
        data = data || {};
        opts = opts || {};
        var fn;
        if (arguments.length == 2) {
          cpOptsInData(data, opts);
        }
        return handleCache(opts, template)(data);
      };
      exports.renderFile = function() {
        var args = Array.prototype.slice.call(arguments),
            path = args.shift(),
            cb = args.pop(),
            data = args.shift() || {},
            opts = args.pop() || {},
            result;
        opts = utils.shallowCopy({}, opts);
        if (arguments.length == 3) {
          cpOptsInData(data, opts);
        }
        opts.filename = path;
        try {
          result = handleCache(opts)(data);
        } catch (err) {
          return cb(err);
        }
        return cb(null, result);
      };
      exports.clearCache = function() {
        exports.cache.reset();
      };
      function Template(text, opts) {
        opts = opts || {};
        var options = {};
        this.templateText = text;
        this.mode = null;
        this.truncate = false;
        this.currentLine = 1;
        this.source = '';
        this.dependencies = [];
        options.client = opts.client || false;
        options.escapeFunction = opts.escape || utils.escapeXML;
        options.compileDebug = opts.compileDebug !== false;
        options.debug = !!opts.debug;
        options.filename = opts.filename;
        options.delimiter = opts.delimiter || exports.delimiter || _DEFAULT_DELIMITER;
        options._with = typeof opts._with != 'undefined' ? opts._with : true;
        options.context = opts.context;
        options.cache = opts.cache || false;
        options.rmWhitespace = opts.rmWhitespace;
        this.opts = options;
        this.regex = this.createRegex();
      }
      Template.modes = {
        EVAL: 'eval',
        ESCAPED: 'escaped',
        RAW: 'raw',
        COMMENT: 'comment',
        LITERAL: 'literal'
      };
      Template.prototype = {
        createRegex: function() {
          var str = _REGEX_STRING,
              delim = utils.escapeRegExpChars(this.opts.delimiter);
          str = str.replace(/%/g, delim);
          return new RegExp(str);
        },
        compile: function() {
          var src,
              fn,
              opts = this.opts,
              prepended = '',
              appended = '',
              escape = opts.escapeFunction;
          if (opts.rmWhitespace) {
            this.templateText = this.templateText.replace(/\r/g, '').replace(/^\s+|\s+$/gm, '');
          }
          if (!this.source) {
            this.generateSource();
            prepended += '  var __output = [], __append = __output.push.bind(__output);' + '\n';
            if (opts._with !== false) {
              prepended += '  with (' + exports.localsName + ' || {}) {' + '\n';
              appended += '  }' + '\n';
            }
            appended += '  return __output.join("");' + '\n';
            this.source = prepended + this.source + appended;
          }
          if (opts.compileDebug) {
            src = 'var __line = 1' + '\n' + '  , __lines = ' + JSON.stringify(this.templateText) + '\n' + '  , __filename = ' + (opts.filename ? JSON.stringify(opts.filename) : 'undefined') + ';' + '\n' + 'try {' + '\n' + this.source + '} catch (e) {' + '\n' + '  rethrow(e, __lines, __filename, __line);' + '\n' + '}' + '\n';
          } else {
            src = this.source;
          }
          if (opts.debug) {
            console.log(src);
          }
          if (opts.client) {
            src = 'escape = escape || ' + escape.toString() + ';' + '\n' + src;
            if (opts.compileDebug) {
              src = 'rethrow = rethrow || ' + rethrow.toString() + ';' + '\n' + src;
            }
          }
          try {
            fn = new Function(exports.localsName + ', escape, include, rethrow', src);
          } catch (e) {
            if (e instanceof SyntaxError) {
              if (opts.filename) {
                e.message += ' in ' + opts.filename;
              }
              e.message += ' while compiling ejs';
            }
            throw e;
          }
          if (opts.client) {
            fn.dependencies = this.dependencies;
            return fn;
          }
          var returnedFn = function(data) {
            var include = function(path, includeData) {
              var d = utils.shallowCopy({}, data);
              if (includeData) {
                d = utils.shallowCopy(d, includeData);
              }
              return includeFile(path, opts)(d);
            };
            return fn.apply(opts.context, [data || {}, escape, include, rethrow]);
          };
          returnedFn.dependencies = this.dependencies;
          return returnedFn;
        },
        generateSource: function() {
          var self = this,
              matches = this.parseTemplateText(),
              d = this.opts.delimiter;
          if (matches && matches.length) {
            matches.forEach(function(line, index) {
              var opening,
                  closing,
                  include,
                  includeOpts,
                  includeSrc;
              if (line.indexOf('<' + d) === 0 && line.indexOf('<' + d + d) !== 0) {
                closing = matches[index + 2];
                if (!(closing == d + '>' || closing == '-' + d + '>')) {
                  throw new Error('Could not find matching close tag for "' + line + '".');
                }
              }
              if ((include = line.match(/^\s*include\s+(\S+)/))) {
                opening = matches[index - 1];
                if (opening && (opening == '<' + d || opening == '<' + d + '-')) {
                  includeOpts = utils.shallowCopy({}, self.opts);
                  includeSrc = includeSource(include[1], includeOpts);
                  includeSrc = '    ; (function(){' + '\n' + includeSrc + '    ; })()' + '\n';
                  self.source += includeSrc;
                  self.dependencies.push(exports.resolveInclude(include[1], includeOpts.filename));
                  return ;
                }
              }
              self.scanLine(line);
            });
          }
        },
        parseTemplateText: function() {
          var str = this.templateText,
              pat = this.regex,
              result = pat.exec(str),
              arr = [],
              firstPos,
              lastPos;
          while (result) {
            firstPos = result.index;
            lastPos = pat.lastIndex;
            if (firstPos !== 0) {
              arr.push(str.substring(0, firstPos));
              str = str.slice(firstPos);
            }
            arr.push(result[0]);
            str = str.slice(result[0].length);
            result = pat.exec(str);
          }
          if (str) {
            arr.push(str);
          }
          return arr;
        },
        scanLine: function(line) {
          var self = this,
              d = this.opts.delimiter,
              newLineCount = 0;
          function _addOutput() {
            if (self.truncate) {
              line = line.replace('\n', '');
              self.truncate = false;
            } else if (self.opts.rmWhitespace) {
              line = line.replace(/^\n/, '');
            }
            if (!line) {
              return ;
            }
            line = line.replace(/\\/g, '\\\\');
            line = line.replace(/\n/g, '\\n');
            line = line.replace(/\r/g, '\\r');
            line = line.replace(/"/g, '\\"');
            self.source += '    ; __append("' + line + '")' + '\n';
          }
          newLineCount = (line.split('\n').length - 1);
          switch (line) {
            case '<' + d:
              this.mode = Template.modes.EVAL;
              break;
            case '<' + d + '=':
              this.mode = Template.modes.ESCAPED;
              break;
            case '<' + d + '-':
              this.mode = Template.modes.RAW;
              break;
            case '<' + d + '#':
              this.mode = Template.modes.COMMENT;
              break;
            case '<' + d + d:
              this.mode = Template.modes.LITERAL;
              this.source += '    ; __append("' + line.replace('<' + d + d, '<' + d) + '")' + '\n';
              break;
            case d + '>':
            case '-' + d + '>':
              if (this.mode == Template.modes.LITERAL) {
                _addOutput();
              }
              this.mode = null;
              this.truncate = line.indexOf('-') === 0;
              break;
            default:
              if (this.mode) {
                switch (this.mode) {
                  case Template.modes.EVAL:
                  case Template.modes.ESCAPED:
                  case Template.modes.RAW:
                    if (line.lastIndexOf('//') > line.lastIndexOf('\n')) {
                      line += '\n';
                    }
                }
                switch (this.mode) {
                  case Template.modes.EVAL:
                    this.source += '    ; ' + line + '\n';
                    break;
                  case Template.modes.ESCAPED:
                    this.source += '    ; __append(escape(' + line.replace(_TRAILING_SEMCOL, '').trim() + '))' + '\n';
                    break;
                  case Template.modes.RAW:
                    this.source += '    ; __append(' + line.replace(_TRAILING_SEMCOL, '').trim() + ')' + '\n';
                    break;
                  case Template.modes.COMMENT:
                    break;
                  case Template.modes.LITERAL:
                    _addOutput();
                    break;
                }
              } else {
                _addOutput();
              }
          }
          if (self.opts.compileDebug && newLineCount) {
            this.currentLine += newLineCount;
            this.source += '    ; __line = ' + this.currentLine + '\n';
          }
        }
      };
      exports.__express = exports.renderFile;
      if (require.extensions) {
        require.extensions['.ejs'] = function(module, filename) {
          filename = filename || module.filename;
          var options = {
            filename: filename,
            client: true
          },
              template = fs.readFileSync(filename).toString(),
              fn = exports.compile(template, options);
          module._compile('module.exports = ' + fn.toString() + ';', filename);
        };
      }
      exports.VERSION = _VERSION_STRING;
      if (typeof window != 'undefined') {
        window.ejs = exports;
      }
    }, {
      "../package.json": 6,
      "./utils": 2,
      "fs": 3,
      "path": 4
    }],
    2: [function(require, module, exports) {
      'use strict';
      var regExpChars = /[|\\{}()[\]^$+*?.]/g;
      exports.escapeRegExpChars = function(string) {
        if (!string) {
          return '';
        }
        return String(string).replace(regExpChars, '\\$&');
      };
      var _ENCODE_HTML_RULES = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&#34;',
        "'": '&#39;'
      },
          _MATCH_HTML = /[&<>\'"]/g;
      function encode_char(c) {
        return _ENCODE_HTML_RULES[c] || c;
      }
      ;
      var escapeFuncStr = 'var _ENCODE_HTML_RULES = {\n' + '      "&": "&amp;"\n' + '    , "<": "&lt;"\n' + '    , ">": "&gt;"\n' + '    , \'"\': "&#34;"\n' + '    , "\'": "&#39;"\n' + '    }\n' + '  , _MATCH_HTML = /[&<>\'"]/g;\n' + 'function encode_char(c) {\n' + '  return _ENCODE_HTML_RULES[c] || c;\n' + '};\n';
      exports.escapeXML = function(markup) {
        return markup == undefined ? '' : String(markup).replace(_MATCH_HTML, encode_char);
      };
      exports.escapeXML.toString = function() {
        return Function.prototype.toString.call(this) + ';\n' + escapeFuncStr;
      };
      exports.shallowCopy = function(to, from) {
        from = from || {};
        for (var p in from) {
          to[p] = from[p];
        }
        return to;
      };
      exports.cache = {
        _data: {},
        set: function(key, val) {
          this._data[key] = val;
        },
        get: function(key) {
          return this._data[key];
        },
        reset: function() {
          this._data = {};
        }
      };
    }, {}],
    3: [function(require, module, exports) {}, {}],
    4: [function(require, module, exports) {
      (function(process) {
        function normalizeArray(parts, allowAboveRoot) {
          var up = 0;
          for (var i = parts.length - 1; i >= 0; i--) {
            var last = parts[i];
            if (last === '.') {
              parts.splice(i, 1);
            } else if (last === '..') {
              parts.splice(i, 1);
              up++;
            } else if (up) {
              parts.splice(i, 1);
              up--;
            }
          }
          if (allowAboveRoot) {
            for (; up--; up) {
              parts.unshift('..');
            }
          }
          return parts;
        }
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        var splitPath = function(filename) {
          return splitPathRe.exec(filename).slice(1);
        };
        exports.resolve = function() {
          var resolvedPath = '',
              resolvedAbsolute = false;
          for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
            var path = (i >= 0) ? arguments[i] : process.cwd();
            if (typeof path !== 'string') {
              throw new TypeError('Arguments to path.resolve must be strings');
            } else if (!path) {
              continue;
            }
            resolvedPath = path + '/' + resolvedPath;
            resolvedAbsolute = path.charAt(0) === '/';
          }
          resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
            return !!p;
          }), !resolvedAbsolute).join('/');
          return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
        };
        exports.normalize = function(path) {
          var isAbsolute = exports.isAbsolute(path),
              trailingSlash = substr(path, -1) === '/';
          path = normalizeArray(filter(path.split('/'), function(p) {
            return !!p;
          }), !isAbsolute).join('/');
          if (!path && !isAbsolute) {
            path = '.';
          }
          if (path && trailingSlash) {
            path += '/';
          }
          return (isAbsolute ? '/' : '') + path;
        };
        exports.isAbsolute = function(path) {
          return path.charAt(0) === '/';
        };
        exports.join = function() {
          var paths = Array.prototype.slice.call(arguments, 0);
          return exports.normalize(filter(paths, function(p, index) {
            if (typeof p !== 'string') {
              throw new TypeError('Arguments to path.join must be strings');
            }
            return p;
          }).join('/'));
        };
        exports.relative = function(from, to) {
          from = exports.resolve(from).substr(1);
          to = exports.resolve(to).substr(1);
          function trim(arr) {
            var start = 0;
            for (; start < arr.length; start++) {
              if (arr[start] !== '')
                break;
            }
            var end = arr.length - 1;
            for (; end >= 0; end--) {
              if (arr[end] !== '')
                break;
            }
            if (start > end)
              return [];
            return arr.slice(start, end - start + 1);
          }
          var fromParts = trim(from.split('/'));
          var toParts = trim(to.split('/'));
          var length = Math.min(fromParts.length, toParts.length);
          var samePartsLength = length;
          for (var i = 0; i < length; i++) {
            if (fromParts[i] !== toParts[i]) {
              samePartsLength = i;
              break;
            }
          }
          var outputParts = [];
          for (var i = samePartsLength; i < fromParts.length; i++) {
            outputParts.push('..');
          }
          outputParts = outputParts.concat(toParts.slice(samePartsLength));
          return outputParts.join('/');
        };
        exports.sep = '/';
        exports.delimiter = ':';
        exports.dirname = function(path) {
          var result = splitPath(path),
              root = result[0],
              dir = result[1];
          if (!root && !dir) {
            return '.';
          }
          if (dir) {
            dir = dir.substr(0, dir.length - 1);
          }
          return root + dir;
        };
        exports.basename = function(path, ext) {
          var f = splitPath(path)[2];
          if (ext && f.substr(-1 * ext.length) === ext) {
            f = f.substr(0, f.length - ext.length);
          }
          return f;
        };
        exports.extname = function(path) {
          return splitPath(path)[3];
        };
        function filter(xs, f) {
          if (xs.filter)
            return xs.filter(f);
          var res = [];
          for (var i = 0; i < xs.length; i++) {
            if (f(xs[i], i, xs))
              res.push(xs[i]);
          }
          return res;
        }
        var substr = 'ab'.substr(-1) === 'b' ? function(str, start, len) {
          return str.substr(start, len);
        } : function(str, start, len) {
          if (start < 0)
            start = str.length + start;
          return str.substr(start, len);
        };
        ;
      }).call(this, require("_process"));
    }, {"_process": 5}],
    5: [function(require, module, exports) {
      var process = module.exports = {};
      process.nextTick = (function() {
        var canSetImmediate = typeof window !== 'undefined' && window.setImmediate;
        var canMutationObserver = typeof window !== 'undefined' && window.MutationObserver;
        var canPost = typeof window !== 'undefined' && window.postMessage && window.addEventListener;
        ;
        if (canSetImmediate) {
          return function(f) {
            return window.setImmediate(f);
          };
        }
        var queue = [];
        if (canMutationObserver) {
          var hiddenDiv = document.createElement("div");
          var observer = new MutationObserver(function() {
            var queueList = queue.slice();
            queue.length = 0;
            queueList.forEach(function(fn) {
              fn();
            });
          });
          observer.observe(hiddenDiv, {attributes: true});
          return function nextTick(fn) {
            if (!queue.length) {
              hiddenDiv.setAttribute('yes', 'no');
            }
            queue.push(fn);
          };
        }
        if (canPost) {
          window.addEventListener('message', function(ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
              ev.stopPropagation();
              if (queue.length > 0) {
                var fn = queue.shift();
                fn();
              }
            }
          }, true);
          return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
          };
        }
        return function nextTick(fn) {
          setTimeout(fn, 0);
        };
      })();
      process.title = 'browser';
      process.browser = true;
      process.env = {};
      process.argv = [];
      function noop() {}
      process.on = noop;
      process.addListener = noop;
      process.once = noop;
      process.off = noop;
      process.removeListener = noop;
      process.removeAllListeners = noop;
      process.emit = noop;
      process.binding = function(name) {
        throw new Error('process.binding is not supported');
      };
      process.cwd = function() {
        return '/';
      };
      process.chdir = function(dir) {
        throw new Error('process.chdir is not supported');
      };
    }, {}],
    6: [function(require, module, exports) {
      module.exports = {
        "name": "ejs",
        "description": "Embedded JavaScript templates",
        "keywords": ["template", "engine", "ejs"],
        "version": "2.3.2",
        "author": "Matthew Eernisse <mde@fleegix.org> (http://fleegix.org)",
        "contributors": ["Timothy Gu <timothygu99@gmail.com> (https://timothygu.github.io)"],
        "license": "Apache-2.0",
        "main": "./lib/ejs.js",
        "repository": {
          "type": "git",
          "url": "git://github.com/mde/ejs.git"
        },
        "bugs": "https://github.com/mde/ejs/issues",
        "homepage": "https://github.com/mde/ejs",
        "dependencies": {},
        "devDependencies": {
          "browserify": "^8.0.3",
          "istanbul": "~0.3.5",
          "jake": "^8.0.0",
          "jsdoc": "^3.3.0-beta1",
          "lru-cache": "^2.5.0",
          "mocha": "^2.1.0",
          "rimraf": "^2.2.8",
          "uglify-js": "^2.4.16"
        },
        "engines": {"node": ">=0.10.0"},
        "scripts": {
          "test": "mocha",
          "coverage": "istanbul cover node_modules/mocha/bin/_mocha",
          "doc": "rimraf out && jsdoc -c jsdoc.json lib/* docs/jsdoc/*",
          "devdoc": "rimraf out && jsdoc -p -c jsdoc.json lib/* docs/jsdoc/*"
        }
      };
    }, {}]
  }, {}, [1]);
})(require("process"));
