"use strict";

var fs = require("fs");
var path = require("path");

var xml2js = require("xml2js");

var ANDROID_MIN_SDK_VERSION = 22;
var ANDROID_NDK_VERSION = "21.4.7075529";
var ARG_ELLIE = "--ellie";
var ARG_LISA = "--lisa";
var ARG_LENA = "--lena";

var K_NDK_VERSION = "ndkVersion";
var K_ABI_FILTERS = "abiFilters";
var K_ANDROID = "android";
var K_ARCH_V8A = "arm64-v8a";
var K_DEFAULT_CONFIG = "defaultConfig";
var K_EXT_CDV_MIN_SDK_VERSION = "ext.cdvMinSdkVersion";
var K_NDK = "ndk";

var WRITE_644_OPTIONS = {
  mode: 420,
};

var K_ANDROID_NAME = "android:name";
var K_ANDROID_AUTHORITIES = "android:authorities";
var K_ANDROID_EXPORTED = "android:exported";
var K_ANDROID_GRANT_URI_PERMISSIONS = "android:grantUriPermissions";
var K_ANDROID_RESOURCE = "android:resource";

var PROVIDER_NAME = "androidx.core.content.FileProvider";
var PROVIDER_AUTHORITIES = "be.basalte.musicapp.provider";
var PROVIDER_EXPORTED = "false";
var PROVIDER_GRANT_URI_PERMISSIONS = "true";
var META_DATA_NAME = "android.support.FILE_PROVIDER_PATHS";
var META_DATA_RESOURCE = "@xml/camera_provider_paths";

module.exports = script;

function script(ctx) {
  var platforms, cmdLine, pathCdvRoot, pathCdvAndroid;
  var pathCdvAndroidBuildExtras;
  var manifest, pathAndroidManifest;

  platforms = ctx.opts.cordova.platforms;
  cmdLine = ctx.cmdLine;

  if (platforms.indexOf("android") > -1) {
    pathCdvRoot = ctx.opts.projectRoot;
    pathCdvAndroid = path.join(pathCdvRoot, "platforms", "android");
    pathCdvAndroidBuildExtras = path.join(
      pathCdvAndroid,
      "app",
      "build-extras.gradle"
    );
    pathAndroidManifest = path.join(
      pathCdvAndroid,
      "app",
      "src",
      "main",
      "AndroidManifest.xml"
    );

    return new Promise(promiseConstructor);
  }

  function promiseConstructor(resolve, reject) {
    var isFinished, buildExtraWritten, manifestWritten;

    buildExtraWritten = false;
    manifestWritten = false;

    isFinished = false;

    fs.readFile(pathCdvAndroidBuildExtras, onBuildExtras);

    // File provider is needed for camera plugin on android builds,
    // Ellie, Lisa, Lena does not use this plugin
    if (
      typeof cmdLine === "string" &&
      cmdLine.indexOf(ARG_ELLIE) < 0 &&
      cmdLine.indexOf(ARG_LISA) < 0 &&
      cmdLine.indexOf(ARG_LENA) < 0
    ) {
      readXml(pathAndroidManifest, onManifest);
    } else {
      manifestWritten = true;
    }

    function onBuildExtras(error, result) {
      if (error) {
        if (error.code === "ENOENT") {
          processBuildExtras("");
        } else {
          console.error("FILE ERROR", error);
          resolvePromise(error);
        }
      } else {
        processBuildExtras(result.toString());
      }
    }

    function onManifest(error, result) {
      if (error) {
        pathAndroidManifest = path.join(pathCdvAndroid, "AndroidManifest.xml");
        readXml(pathAndroidManifest, onLegacyManifest);
      } else {
        manifest = result;
        editManifest();
      }
    }

    function onLegacyManifest(error, result) {
      if (error) {
        console.error("ERROR reading manifest", error);
        resolvePromise(error);
      } else {
        manifest = result;
        editManifest();
      }
    }

    function processBuildExtras(str) {
      var _str, changed, idx, value;

      _str = typeof str === "string" ? str : "";

      changed = false;

      // Minimum SDK version

      idx = _str.indexOf(K_EXT_CDV_MIN_SDK_VERSION);

      if (idx < 0) {
        changed = true;

        _str +=
          "\n" +
          K_EXT_CDV_MIN_SDK_VERSION +
          " = " +
          ANDROID_MIN_SDK_VERSION +
          "\n";
      }

      // ABI filters

      idx = _str.indexOf(K_ABI_FILTERS);

      if (idx < 0) {
        changed = true;

        _str +=
          "\n" +
          K_ANDROID +
          " {\n" +
          tab() +
          K_NDK_VERSION +
          ' "' +
          ANDROID_NDK_VERSION +
          '"\n';

        value = getABIFilters();
        if (value) {
          _str +=
            "" +
            tab() +
            K_DEFAULT_CONFIG +
            " {\n" +
            tab(2) +
            K_NDK +
            " {\n" +
            tab(3) +
            K_ABI_FILTERS +
            " " +
            value +
            "\n" +
            tab(2) +
            "}\n" +
            tab() +
            "}\n";
        }

        _str += "}\n";
      }

      if (changed) {
        fs.writeFile(
          pathCdvAndroidBuildExtras,
          _str,
          WRITE_644_OPTIONS,
          onBuildExtrasWrite
        );
      } else {
        buildExtraWritten = true;
        onFilesWritten();
      }
    }

    function onBuildExtrasWrite(error) {
      if (error) {
        console.error("ERROR writing build-extras.gradle");
        resolvePromise(error);
      } else {
        buildExtraWritten = true;
        onFilesWritten();
      }
    }

    function needsCustomABIFilters() {
      return (
        typeof cmdLine === "string" &&
        (cmdLine.indexOf(ARG_ELLIE) > -1 ||
          cmdLine.indexOf(ARG_LISA) > -1 ||
          cmdLine.indexOf(ARG_LENA) > -1)
      );
    }

    function getABIFilters() {
      return needsCustomABIFilters() ? '"' + K_ARCH_V8A + '"' : "";
    }

    function editManifest() {
      var i, length;
      var xmlArray;
      var manifestChanged, xmlItemProvider, xmlItemNeeded;
      var builder, xml;

      manifestChanged = false;

      // Add file provider

      xmlItemProvider = getXmlProvider();

      xmlItemNeeded = true;

      xmlArray = manifest["manifest"]["application"][0]["provider"];

      if (Array.isArray(xmlArray)) {
        length = xmlArray.length;
        for (i = 0; i < length; i++) {
          if (
            xmlArray[i] &&
            xmlArray[i]["$"] &&
            xmlArray[i]["$"][K_ANDROID_NAME] === PROVIDER_NAME
          ) {
            xmlItemNeeded = false;
          }
        }

        if (xmlItemNeeded) {
          manifestChanged = true;
          xmlArray.push(xmlItemProvider);
        }
      } else {
        manifestChanged = true;
        manifest["manifest"]["application"][0]["provider"] = [xmlItemProvider];
      }

      // Write updated manifest

      if (manifestChanged) {
        builder = new xml2js.Builder();

        xml = builder.buildObject(manifest);

        fs.writeFile(
          pathAndroidManifest,
          xml,
          WRITE_644_OPTIONS,
          onManifestWrite
        );
      } else {
        manifestWritten = true;
        onFilesWritten();
      }
    }

    function onManifestWrite(error) {
      if (error) {
        console.error("ERROR writing manifest", error);
        resolvePromise(error);
      } else {
        manifestWritten = true;
        onFilesWritten();
      }
    }

    function onFilesWritten() {
      if (buildExtraWritten && manifestWritten) {
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

/**
 * @param {number} [numberOfTabs]
 * @returns {string}
 */
function tab(numberOfTabs) {
  var _tab, i, result;

  _tab = "    ";

  if (
    typeof numberOfTabs === "number" &&
    isFinite(numberOfTabs) &&
    numberOfTabs > -1
  ) {
    result = "";

    for (i = 0; i < numberOfTabs; i++) {
      result += _tab;
    }

    return result;
  }
  return _tab;
}

function getXmlProvider() {
  var result = {};
  result["$"] = {};
  result["$"][K_ANDROID_NAME] = PROVIDER_NAME;
  result["$"][K_ANDROID_AUTHORITIES] = PROVIDER_AUTHORITIES;
  result["$"][K_ANDROID_EXPORTED] = PROVIDER_EXPORTED;
  result["$"][K_ANDROID_GRANT_URI_PERMISSIONS] = PROVIDER_GRANT_URI_PERMISSIONS;
  result["meta-data"] = [{}];
  result["meta-data"] = [{}];
  result["meta-data"][0]["$"] = {};
  result["meta-data"][0]["$"][K_ANDROID_NAME] = META_DATA_NAME;
  result["meta-data"][0]["$"][K_ANDROID_RESOURCE] = META_DATA_RESOURCE;
  return result;
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
