/* */ 
(function(process) {
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
})(require("process"));