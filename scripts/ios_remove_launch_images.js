"use strict";

var fs = require("fs");
var path = require("path");

var xml2js = require("xml2js");
var rimraf = require("rimraf");

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
      var appName, imagesAssetsPath, launchImagesPath;

      if (err) {
        console.error("ERROR getting config", err);
        resolvePromise(err);
      } else {
        appName = result["widget"]["name"][0];

        imagesAssetsPath = path.join(
          pathCdvRoot,
          "platforms",
          "ios",
          appName,
          "Images.xcassets"
        );

        launchImagesPath = path.join(
          imagesAssetsPath,
          "LaunchImage.launchimage"
        );

        rimraf(
          launchImagesPath,
          {
            glob: false,
          },
          _onLaunchImagesRemoved
        );
      }
    }

    function _onLaunchImagesRemoved(err) {
      if (err) {
        console.error("ERROR removing launch images", err);
        resolvePromise(err);
      } else {
        console.info("Removed launch images");
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
