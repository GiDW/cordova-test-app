"use strict";

var fs = require("fs");
var path = require("path");

var xml2js = require("xml2js");
var plist = require("plist");

var WRITE_644_OPTIONS = {
  mode: 420,
};

module.exports = script;

function script(ctx) {
  var platforms, pathCdvRoot;

  platforms = ctx.opts.cordova.platforms;

  if (platforms.indexOf("ios") > -1) {
    pathCdvRoot = ctx.opts.projectRoot;

    return new Promise(promiseConstructor);
  }

  function promiseConstructor(resolve, reject) {
    var isFinished;

    isFinished = false;

    readXml(path.join(pathCdvRoot, "config.xml"), onConfig);

    function onConfig(err, result) {
      var appName, infoPlistPath;

      if (err) {
        console.error("ERROR getting config", err);
        resolvePromise(err);
      } else {
        appName = result["widget"]["name"][0];

        infoPlistPath = path.join(
          pathCdvRoot,
          "platforms",
          "ios",
          appName,
          appName + "-Info.plist"
        );

        fs.readFile(infoPlistPath, onInfoPlist);
      }

      function onInfoPlist(infoPlistError, infoPlistResult) {
        var infoPlist;

        if (infoPlistError) {
          console.error("ERROR getting info plist");
          resolvePromise(infoPlistError);
        } else {
          infoPlist = plist.parse(infoPlistResult.toString());

          // No changes were made to encryption
          infoPlist["ITSAppUsesNonExemptEncryption"] = false;

          // Allow split screen
          infoPlist["UIRequiresFullScreen"] = false;

          // Only allow portrait for iPhone
          infoPlist["UISupportedInterfaceOrientations"] = [
            "UIInterfaceOrientationPortrait",
          ];

          // Bonjour usage description, required since iOS 14
          infoPlist["NSLocalNetworkUsageDescription"] =
            "Looking for local tcp Bonjour service";

          // Bonjour service, required since iOS 14
          infoPlist["NSBonjourServices"] = ["_http._tcp"];

          fs.writeFile(
            infoPlistPath,
            plist.build(infoPlist),
            WRITE_644_OPTIONS,
            _onPlistWritten
          );
        }
      }
    }

    function _onPlistWritten(err) {
      if (err) {
        console.error("ERROR writing new plist file", err);
        resolvePromise(err);
      } else {
        console.info("Modified info plist");
        resolvePromise();
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

function readXml(file, callback) {
  fs.readFile(file, onConfig);

  function onConfig(err, result) {
    if (err) {
      callback(err);
    } else {
      xml2js.parseString(result.toString(), callback);
    }
  }
}
