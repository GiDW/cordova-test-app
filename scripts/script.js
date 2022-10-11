"use strict";

var path = require("path");
var fs = require("fs");

module.exports = script;

function script(ctx) {
  var pathCdvRoot, pathIos;

  pathCdvRoot = ctx.opts.projectRoot;
  pathIos = path.join(pathCdvRoot, "platforms", "ios");

  console.log("Cordova script");
  console.log(ctx);
  console.log("ctx.opts.options");
  console.log(ctx.opts.options);

  if (ctx.opts.cordova.platforms.indexOf("ios") > -1) {
    return new Promise(iosPromiseConstructor);
  }

  function iosPromiseConstructor(resolve, reject) {
    var cordovaCommon, xcode, ConfigParser, appConfig;
    var appName, cdvDeploymentTarget;
    var numOfTasks, pathXcodeProj, buildOpts, xcodeProj;

    cordovaCommon = ctx.requireCordovaModule("cordova-common");
    // Depedency of cordova-ios
    xcode = require("xcode");

    ConfigParser = cordovaCommon.ConfigParser;
    appConfig = new ConfigParser(path.join(pathCdvRoot, "config.xml"));

    appName = appConfig.name();
    cdvDeploymentTarget = appConfig.getPreference("deployment-target", "ios");

    console.info("App config");
    console.info("App name", appName);
    console.info("deployment target", cdvDeploymentTarget);

    numOfTasks = 0;

    numOfTasks++;
    getBuildOptions(ctx, "ios", onBuildOptions);

    numOfTasks++;
    pathXcodeProj = path.join(
      pathIos,
      appName + ".xcodeproj",
      "project.pbxproj"
    );
    xcodeProj = xcode.project(pathXcodeProj);
    xcodeProj.parse(onXcodeProjParse);

    function onBuildOptions(err, res) {
      if (err) {
        console.warn("ERROR getting build options", err);
      } else {
        console.log("Parsed build options");
        console.log(res);
        buildOpts = res;
      }
      numOfTasks--;
      postTasks();
    }

    function onXcodeProjParse(err) {
      if (err) {
        console.warn("ERROR parsing Xcode project", err);
        xcodeProj = null;
      }
      numOfTasks--;
      postTasks();
    }

    function postTasks() {
      if (numOfTasks > 0) return;

      if (xcodeProj) {
        processXcodeProj(xcodeProj, buildOpts, appName);
        fs.writeFile(
          pathXcodeProj,
          xcodeProj.writeSync(),
          {
            // Octal 755 rwxr-xr-x
            mode: 493,
          },
          onXcodeProjWrite
        );
      } else {
        resolve();
      }
    }

    function onXcodeProjWrite(err) {
      if (err) {
        console.error("ERROR writing xcode project", err);
        reject(err);
      } else {
        resolve();
      }
    }
  }
}

function processXcodeProj(xcodeProj, buildOpts, appName) {
  var keys, length, i, key, entry, type;
  var teamId, codeSignIdentity, provisioningProfile, automaticProvisioning;
  var pbxTarget, pbxXCConfigurations;
  var buildConfigurationList, buildConfigList;
  var buildConfigIds, buildConfigsAll;

  teamId = buildOpts.basParsed["developmentTeam"];
  codeSignIdentity = buildOpts.basParsed["codeSignIdentity"];
  provisioningProfile = buildOpts.basParsed["provisioningProfile"];

  pbxTarget = xcodeProj.pbxTargetByName(appName);
  buildConfigurationList = pbxTarget.buildConfigurationList;

  pbxXCConfigurations = xcodeProj.pbxXCConfigurationList();

  keys = Object.keys(pbxXCConfigurations);
  length = keys.length;
  for (i = 0; i < length; i++) {
    key = keys[i];
    entry = pbxXCConfigurations[key];
    if (key === buildConfigurationList) buildConfigList = entry;
  }

  buildConfigIds = [];
  length = buildConfigList.buildConfigurations.length;
  for (i = 0; i < length; i++) {
    entry = buildConfigList.buildConfigurations[i];

    if (entry && entry.value && buildConfigIds.indexOf(entry.value) < 0) {
      buildConfigIds.push(entry.value);
    }
  }

  buildConfigsAll = xcodeProj.pbxXCBuildConfigurationSection();

  keys = Object.keys(buildConfigsAll);
  length = keys.length;
  for (i = 0; i < length; i++) {
    key = keys[i];
    entry = buildConfigsAll[key];

    if (
      buildConfigIds.indexOf(key) > -1 &&
      entry &&
      entry.name &&
      entry.buildSettings
    ) {
      type = entry.name.toLowerCase();

      if (type === "debug" || type === "release") {
        automaticProvisioning = getOpt(
          buildOpts,
          "automaticProvisioning",
          type
        );

        if (automaticProvisioning) continue;

        teamId = getOpt(buildOpts, "developmentTeam", type);
        codeSignIdentity = getOpt(buildOpts, "codeSignIdentity", type);
        provisioningProfile = getOpt(buildOpts, "provisioningProfile", type);

        if (teamId) {
          entry.buildSettings["DEVELOPMENT_TEAM"] = teamId;
          entry.buildSettings['"DEVELOPMENT_TEAM[sdk=iphoneos*]"'] = teamId;
        }
        if (codeSignIdentity) {
          entry.buildSettings["CODE_SIGN_IDENTITY"] =
            '"' + codeSignIdentity + '"';
          entry.buildSettings['"CODE_SIGN_IDENTITY[sdk=iphoneos*]"'] =
            '"' + codeSignIdentity + '"';
        }
        if (provisioningProfile) {
          entry.buildSettings["PROVISIONING_PROFILE"] = provisioningProfile;
          entry.buildSettings['"PROVISIONING_PROFILE[sdk=iphoneos*]"'] =
            provisioningProfile;
        }
      }
    }
  }
}

function getOpt(opts, opt, type) {
  if (opts.basBuildType === type && opts.basParsed[opt]) {
    return opts.basParsed[opt];
  }
  if (
    opts.basBuildConfig &&
    opts.basBuildConfig["ios"] &&
    opts.basBuildConfig["ios"][type] &&
    opts.basBuildConfig["ios"][type][opt]
  ) {
    return opts.basBuildConfig["ios"][type][opt];
  }
  if (opts.basBuildType === type && opts[opt]) {
    return opts[opt];
  }
  return "";
}

function getBuildOptions(ctx, platform, callback) {
  var opts;

  opts = copyObject(ctx.opts.options);
  opts.basBuildType = opts.release ? "release" : "debug";
  opts.basParsed = parseArgv(opts.argv);

  readJson(
    opts.buildConfig
      ? opts.buildConfig
      : path.join(ctx.opts.projectRoot, "build.json"),
    onBuildJson
  );

  function onBuildJson(err, res) {
    var baseOpts, keys, length, i, k;

    if (err) {
      callback(null, opts);
    } else {
      opts.basBuildConfig = res;

      baseOpts =
        res && res[platform] && res[platform][opts.basBuildType]
          ? res[platform][opts.basBuildType]
          : {};

      keys = Object.keys(opts.basParsed);
      length = keys.length;
      for (i = 0; i < length; i++) {
        k = keys[i];
        baseOpts[k] = opts.basParsed[k];
      }
      opts.basParsed = baseOpts;

      callback(null, opts);
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

function copyObject(input) {
  var result, keys, length, i, key, value;

  if (input) {
    if (Array.isArray(input)) {
      length = input.length;
      result = new Array(length);
      for (i = 0; i < length; i++) {
        value = input[i];
        result[i] = typeof value === "object" ? copyObject(value) : value;
      }
      return result;
    } else if (typeof input === "object") {
      result = {};
      keys = Object.keys(input);
      length = keys.length;
      for (i = 0; i < length; i++) {
        key = keys[i];
        value = input[key];
        result[key] = typeof value === "object" ? copyObject(value) : value;
      }
      return result;
    }
  }
  return input;
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
