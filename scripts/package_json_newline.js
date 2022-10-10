"use strict";

var fs = require("fs");
var path = require("path");

var NEWLINE_CHARACTER_VALUE = 10;

module.exports = script;

function script(ctx) {
  var pathCdvRoot, pathPackageJson;

  pathCdvRoot = ctx.opts.projectRoot;
  pathPackageJson = path.join(pathCdvRoot, "package.json");

  return new Promise(promiseConstructor);

  function promiseConstructor(resolve, reject) {
    var isFinished;

    isFinished = false;

    fs.readFile(pathPackageJson, _onPackageJson);

    function _onPackageJson(error, result) {
      var length;

      if (error) {
        resolvePromise(error);
      } else {
        length = result.length;

        if (result[length - 1] !== NEWLINE_CHARACTER_VALUE) {
          fs.writeFile(
            pathPackageJson,
            Buffer.concat(
              [result, Buffer.from([NEWLINE_CHARACTER_VALUE])],
              length + 1
            ),
            _onPackageJsonWritten
          );
        } else {
          resolvePromise(null);
        }
      }
    }

    function _onPackageJsonWritten(error) {
      if (error) {
        resolvePromise(error);
      } else {
        resolvePromise(null);
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
