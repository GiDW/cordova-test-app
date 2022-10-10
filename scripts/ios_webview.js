/*
 Problem: When restarting the app on devices with a notch,
  an empty space appears at the bottom of the app.
 Solution: setContentInsetAdjustmentBehavior to "never"
  before setting the UIDelegate on the WebView.
 Ref: https://github.com/apache/cordova-plugin-wkwebview-engine/issues/108
 */

"use strict";

var fs = require("fs");
var path = require("path");

var WEB_VIEW = "wkWebView.UIDelegate = self.uiDelegate;";
var WEB_VIEW_ADJUST_INSET =
  "[wkWebView.scrollView " +
  "setContentInsetAdjustmentBehavior:UIScrollViewContentInsetAdjustmentNever];";

module.exports = script;

function script(ctx) {
  var platforms, pathCdvRoot, pathCdvIos, pathWebViewEngine;

  platforms = ctx.opts.cordova.platforms;

  if (platforms.indexOf("ios") > -1) {
    pathCdvRoot = ctx.opts.projectRoot;

    return new Promise(promiseConstructor);
  }

  function promiseConstructor(resolve, reject) {
    var isFinished;

    isFinished = false;

    pathCdvIos = path.join(pathCdvRoot, "platforms", "ios");

    pathWebViewEngine = path.join(
      pathCdvIos,
      "CordovaLib",
      "Classes",
      "Private",
      "Plugins",
      "CDVWebViewEngine",
      "CDVWebViewEngine.m"
    );

    fs.readFile(pathWebViewEngine, onWebView);

    function onWebView(error, result) {
      if (error) {
        console.error(error);
        resolvePromise(error);
      } else {
        processWebview(result.toString());
      }
    }

    function processWebview(str) {
      var changed, idx, idxAdjust, newStr;

      changed = false;

      if (typeof str === "string") {
        idx = str.indexOf(WEB_VIEW);

        if (idx > -1) {
          idxAdjust = str.indexOf(WEB_VIEW_ADJUST_INSET);

          if (idxAdjust < 0) {
            changed = true;
            newStr =
              str.substring(0, idx) +
              WEB_VIEW_ADJUST_INSET +
              str.substring(idx);
          }
        } else {
          console.error("Could not find string", WEB_VIEW);
          resolvePromise(new Error("Could not find string"));
          return;
        }

        if (changed) {
          fs.writeFile(pathWebViewEngine, newStr, onWebViewWrite);
        } else {
          resolvePromise(null);
        }
      } else {
        console.error("Invalid string");
        resolvePromise(new Error("Invalid string"));
      }
    }

    function onWebViewWrite(error) {
      if (error) {
        console.error("ERROR writing webview");
        resolvePromise(error);
      } else {
        console.info("Modified CDVWebViewEngine.m");
        resolvePromise(null, true);
      }
    }

    function resolvePromise(error, result) {
      if (!isFinished) {
        isFinished = true;
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    }
  }
}
