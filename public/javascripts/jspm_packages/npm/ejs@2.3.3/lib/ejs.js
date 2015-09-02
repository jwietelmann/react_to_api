/* */ 
(function(process) {
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
})(require("process"));
