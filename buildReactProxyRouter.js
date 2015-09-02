var jspm = require('jspm');
var proxy = require('express-http-proxy');
var express = require('express');

function isHTML(req) {
  return req.url.match(/^[^\.]*(\.html)?$/);
}

function isOther(req) {
  return !isHTML(req);
}

function reactProxy(target, component) {
  return proxy(target, {

    filter: isHTML,

    decorateRequest: function(req) {
      req.headers['Accept'] = 'application/json';
      req.headers['Content-Type'] = req.headers['Accept'];
      return req;
    },

    intercept: function(proxyRes, proxyData, req, res, callback) {
      // Sometimes you request JSON from a server.
      // Sometimes it sends HTML anyway.
      // That's usually a Rails server 404ing in development.
      // We're just going to punt and let nature take its course.
      if(proxyRes.headers['content-type'].indexOf('text/html') === 0) {
        return callback(null, proxyData);
      }

      res.set('Content-Type', 'text/html');

      var props = JSON.parse(proxyData);
      props.url = req.url;

      var data = {
        containerId: 'ReactMainContainer',
        containerPropsJson: JSON.stringify(props),
        containerMarkup: component.renderOnServer(props)
      };

      res.render('index', data, callback);
    }
  });
}

function allProxy(target) {
  return proxy(target, {
    filter: isOther
  });
}

function buildReactProxyRouter(target, component) {
  var router = new express.Router();
  router.use(reactProxy(target, component));
  router.use(allProxy(target));
  return router;
}

module.exports = buildReactProxyRouter;
