"use strict";

var path = require("path");
var fs = require("fs");

module.exports = script;

function script(ctx) {
  console.log("Cordova script");
  console.log(ctx);
  console.log("ctx.opts.options");
  console.log(ctx.opts.options);

  getBuildOptions(ctx, "ios", onBuildOptions);

  function onBuildOptions(err, res) {
    if (err) {
      console.warn("ERROR getting build options", err);
    } else {
      console.log("Parsed build options");
      console.log(res);
    }
  }
}

function getBuildOptions(ctx, platform, callback) {
  var pathCdvRoot, opts, buildType, parsedOpts;

  pathCdvRoot = ctx.opts.projectRoot;
  opts = ctx.opts.options;

  buildType = opts.release ? "release" : "debug";
  parsedOpts = parseArgv(opts.argv);

  readJson(
    opts.buildConfig ? opts.buildConfig : path.join(pathCdvRoot, "build.json"),
    onBuildJson
  );

  function onBuildJson(err, res) {
    var baseOpts, keys, length, i, k;

    if (err) {
      callback(null, parsedOpts);
    } else {
      baseOpts =
        res && res[platform] && res[platform][buildType]
          ? res[platform][buildType]
          : {};

      keys = Object.keys(parsedOpts);
      length = keys.length;
      for (i = 0; i < length; i++) {
        k = keys[i];
        baseOpts[k] = parsedOpts[k];
      }

      callback(null, baseOpts);
    }
  }
}

function parseArgv(argv) {
  var result, length, i, arg, _arg, name, value;
  var idx1, idxEq, idxFirstQuote, idxLastQuote;

  result = {};

  length = argv.length;
  for (i = 0; i < length; i++) {
    arg = argv[i];

    if (arg) {
      _arg = arg.trim();

      idx1 = _arg.indexOf("--");

      if (idx1 === 0) {
        idxEq = _arg.indexOf("=");
        idxFirstQuote = _arg.indexOf('"');

        if (idxEq > -1) {
          if (idxFirstQuote > -1) {
            if (idxEq < idxFirstQuote) {
              idxLastQuote = _arg.lastIndexOf('"');

              if (idxLastQuote > idxFirstQuote) {
                name = _arg.substring(2, idxEq);
                value = _arg.substring(idxFirstQuote + 1, idxLastQuote);

                result[name] = value;
              }
            }
          } else {
            name = _arg.substring(2, idxEq);
            value = _arg.substring(idxEq + 1);

            result[name] = value;
          }
        } else {
          // Strip "--"
          name = _arg.substring(2);

          result[name] = true;
        }
      }
    }
  }

  return result;
}

function readJson(filePath, callback) {
  fs.readFile(filePath, onFile);

  function onFile(err, res) {
    if (err) {
      callback(err);
    } else {
      try {
        callback(null, JSON.parse(res.toString()));
      } catch (e) {
        callback(e);
      }
    }
  }
}
