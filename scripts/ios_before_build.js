"use strict";

// Xcode 14 fix
// https://stackoverflow.com/questions/72561696

// Xcode integration with third party pods
// Firebasex issue with pods
// https://github.com/dpa99c/cordova-plugin-firebasex/issues/735
// Xcode Deployment target warning/error
// https://stackoverflow.com/a/51416359
// Variation
// https://mzeeshanid.medium.com/cocoapods-post-install-script-for-updating-deployment-target-3d2c61634253

var fs = require("fs");
var path = require("path");
var childProcess = require("child_process");

var xml2js = require("xml2js");

var ARG_BUILDCONFIG = "--buildConfig=";

module.exports = script;

function script(ctx) {
  var cmdLine, pathCdvRoot, platforms, pathIos;

  cmdLine = ctx.cmdLine;
  pathCdvRoot = ctx.opts.projectRoot;
  platforms = ctx.opts.cordova.platforms;
  pathIos = path.join(pathCdvRoot, "platforms", "ios");

  if (platforms.indexOf("ios") > -1) {
    return new Promise(iosPromiseConstructor);
  }

  function iosPromiseConstructor(resolve, reject) {
    var tasks, pathBuildConfig, pathPodfile;
    var cdvDeploymentTarget, podfile, buildConfig;

    tasks = [];

    pathPodfile = path.join(pathIos, "Podfile");
    pathBuildConfig = getBuildConfigPath(cmdLine, pathCdvRoot);

    tasks.push(false);
    readXml(path.join(pathCdvRoot, "config.xml"), onConfig);

    tasks.push(false);
    fs.readFile(pathPodfile, onPodfile);

    if (pathBuildConfig) {
      tasks.push(false);
      fs.readFile(pathBuildConfig, onBuildConfig);
    }

    function onConfig(err, res) {
      if (err) {
        console.error("ERROR read config", err);
      } else {
        cdvDeploymentTarget = getCordovaPreference(
          res,
          "deployment-target",
          "ios"
        );
      }
      tasks.pop();
      postTask();
    }

    function onPodfile(err, res) {
      if (err) {
        console.error("ERROR readfile Podfile", err);
      } else {
        podfile = res.toString();
        console.info(podfile);
      }
      tasks.pop();
      postTask();
    }

    function onBuildConfig(err, res) {
      if (err) {
        console.warn("Unable to read buildConfig (" + pathBuildConfig + ")");
      } else {
        try {
          buildConfig = JSON.parse(res.toString());
        } catch (e) {
          console.error(
            "ERROR parsing buildConfig (" + pathBuildConfig + ")",
            e
          );
        }
      }
      tasks.pop();
      postTask();
    }

    function postTask() {
      var newPodfile, teamId;

      if (tasks.length !== 0) return;

      // TODO Select release <-> debug based on cmdLine or other property
      teamId = getTeamIdFromBuildConfig(buildConfig, "release");

      newPodfile = processPodfile(podfile, cdvDeploymentTarget, teamId);

      if (podfile !== newPodfile) {
        console.info("NEW Podfile\n\n" + newPodfile);
        fs.writeFile(pathPodfile, newPodfile, onWritePodfile);
      } else {
        // Nothing to do
        resolve();
      }
    }

    function onWritePodfile(err) {
      if (err) {
        console.error("ERROR writing podfile", err);
        reject(err);
      } else {
        simpleSpawn(
          "pod",
          ["install", "--verbose"],
          {
            cwd: pathIos,
          },
          onPodInstall
        );
      }
    }

    function onPodInstall(err) {
      if (err) {
        console.error("Error during pod install command", err);
        reject(err);
      } else {
        resolve();
      }
    }
  }
}

/**
 * @param {string} podfileContent
 * @param {string} deploymentTarget
 * @param {string} [teamId]
 * @returns {string}
 */
function processPodfile(podfileContent, deploymentTarget, teamId) {
  var result, deploymentTargetMajor;

  // TODO Better detection
  if (
    podfileContent.indexOf("post_install") > -1 ||
    !deploymentTarget ||
    !teamId
  ) {
    return podfileContent;
  }

  result = podfileContent;

  result += "\n" + "post_install do |installer|\n";

  if (deploymentTarget) {
    deploymentTargetMajor = deploymentTarget.split(".")[0];
    result +=
      "" +
      "\n" +
      "  installer.pods_project.targets.each do |target|\n" +
      "    target.build_configurations.each do |config|\n" +
      // eslint-disable-next-line max-len
      "      deployment_target = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']\n" +
      "      target_components = deployment_target.split\n" +
      "      if target_components.length > 0\n" +
      "        target_initial = target_components[0].to_i\n" +
      "        if target_initial < " +
      deploymentTargetMajor +
      "\n" +
      // eslint-disable-next-line max-len
      "          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '" +
      deploymentTarget +
      "'\n" +
      "        end\n" +
      "      end\n" +
      "    end\n" +
      "  end\n" +
      "\n";
  }

  if (teamId) {
    result +=
      "" +
      "\n" +
      "  installer.generated_projects.each do |project|\n" +
      "    project.targets.each do |target|\n" +
      "      target.build_configurations.each do |config|\n" +
      // eslint-disable-next-line max-len
      "        config.build_settings['DEVELOPMENT_TEAM'] = '" +
      teamId +
      "'\n" +
      "      end\n" +
      "    end\n" +
      "  end\n" +
      "\n";
  }

  result += "" + "end\n";

  return result;
}

/**
 * @param {Object} xmlObj
 * @param {string} name
 * @param {string} [platform]
 * @returns {*}
 */
function getCordovaPreference(xmlObj, name, platform) {
  var widget, platforms, _platform, result, length, i;

  widget = xmlObj["widget"];

  if (widget) {
    if (platform) {
      platforms = widget["platform"];
      if (platforms) {
        length = platforms.length;
        for (i = 0; i < length; i++) {
          _platform = platforms[i];
          if (_platform && _platform["$"] && _platform["$"].name === platform) {
            result = getValueByName(_platform["preference"], name);
            if (result !== null) return result;
          }
        }
      }
    }
    return getValueByName(widget["preference"], name);
  }
  return null;
}

function getValueByName(xmlObj, name) {
  var length, i, item;

  length = xmlObj.length;
  for (i = 0; i < length; i++) {
    item = xmlObj[i];
    if (item && item["$"] && item["$"].name === name) {
      return item["$"].value;
    }
  }
  return null;
}

/**
 * @param {Object} buildConfig
 * @param {string} mode
 * @returns {string}
 */
function getTeamIdFromBuildConfig(buildConfig, mode) {
  return buildConfig && buildConfig.ios && buildConfig.ios[mode]
    ? buildConfig.ios[mode].developmentTeam
    : "";
}

/**
 * TODO
 * Improve detection: handle spaces, /\, ...
 *
 * @param {string} cmdLine
 * @param {string} cwd
 * @returns {string}
 */
function getBuildConfigPath(cmdLine, cwd) {
  var arg;

  arg = getBuildConfigArg(cmdLine);
  return arg ? path.resolve(cwd, arg) : "";
}

/**
 * @param {string} cmdLine
 * @returns {string}
 */
function getBuildConfigArg(cmdLine) {
  var argIdx, endIdx;

  argIdx = cmdLine.indexOf(ARG_BUILDCONFIG);
  if (argIdx > -1) {
    endIdx = cmdLine.indexOf(" ", argIdx);
    return cmdLine.substring(
      argIdx + ARG_BUILDCONFIG.length,
      endIdx > -1 ? endIdx : undefined
    );
  }
  return "";
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

function simpleSpawn(cmd, args, options, callback) {
  var _cbCalled, cmdProcess;

  _cbCalled = false;

  cmdProcess = childProcess.spawn(cmd, args, options);
  cmdProcess.on("error", onError);
  cmdProcess.on("close", onClose);
  cmdProcess.stdout.on("data", onData);

  function onError(error) {
    _cb(error);
  }
  function onClose(code) {
    if (code) {
      _cb(code);
    } else {
      _cb(null, "");
    }
  }

  function onData(data) {
    _cb(null, data.toString().trim());
  }

  function _cb(err, result) {
    if (!_cbCalled) {
      _cbCalled = true;
      callback(err, result);
    }
  }
}
