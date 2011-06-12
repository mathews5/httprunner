EXPORTED_SYMBOLS = ["ShortcutCreator"];

Components.utils.import("resource://webrunner/modules/FileIO.jsm");
Components.utils.import("resource://webrunner/modules/consts.jsm");
Components.utils.import("resource://webrunner/modules/MozillaUtils.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

function ShortcutCreator() {
}

ShortcutCreator.prototype = {
  _createDirectory : function(parent, leafName) {
    var newDir = parent.clone();
    newDir.append(leafName);
    if (!newDir.exists()) {
      newDir.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);
    }
    return newDir;
  },

  createWebApp : function(extensionDir, webAppDir, name, copyright) {
    // Create dirs inside webapp directory
    var webAppStubDir = this._createDirectory(webAppDir, "stub");

    // Copy files inside dirs
    var extensionStubDir = extensionDir.clone();
    extensionStubDir.append("stub");
    var webrunnerStub = extensionStubDir.clone();
    webrunnerStub.append("webrunner");
    webrunnerStub.copyTo(webAppStubDir, "");

    this._createWebAppFiles(extensionStubDir,webAppStubDir, name);
    this._createBrandingFiles(webAppDir, name, copyright);
    this._createChromeFiles(extensionStubDir, webAppDir);
  },

  _createWebAppFiles: function(extensionStubDir, webAppStubDir, name) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    var greHome = dirSvc.get("GreD", Ci.nsIFile);

    var applicationIni = extensionStubDir.clone();
    applicationIni.append("application.ini");
    var iniString = FileIO.fileToString(applicationIni);

    var profileDir = this._createProfile(extensionStubDir.parent, webAppStubDir.parent, name);
    this._copyProfile(extensionStubDir.parent, profileDir);

    applicationIni = webAppStubDir.clone();
    applicationIni.append("application.ini");
    iniString += "\n";
    iniString += "[Environment]\nGRE_HOME=" + greHome.path + "\n";
    iniString += "XRE_PROFILE_PATH=" + profileDir.path;
    iniString += "\n";
    FileIO.stringToFile(iniString, applicationIni);
  },

  _createProfile : function(extensionDir, webAppDir, name) {
    return this._createDirectory(webAppDir, "profile");
  },

  _copyProfile : function(extensionDir, profileDir) {
    var extensionsDir = this._createDirectory(profileDir, "extensions");

    function copyExtension(sourceDir) {
      var targetDir = extensionsDir.clone();
      targetDir.append(sourceDir.leafName);
      if (targetDir.exists()) {
        targetDir.remove(true);
      }
      sourceDir.copyTo(targetDir.parent, null);
    }

    copyExtension(extensionDir);

    // Copy over any WebRunner enhancement extensions
    // We recognize them since their ID must start with "webrunner-"
    var isGecko2 = true;
    try {
      Components.utils.import("resource://gre/modules/AddonManager.jsm");
    }
    catch(e) {
      // Probably running on Firefox 3.6 so we don't support WebRunner enhancements
      isGecko2 = false;
    }

    function copyAddonsToProfile(addons) {
      for (var i=0; i<addons.length; i++) {
        var addon = addons[i];
        if (addon.id.indexOf("webrunner-") == 0) {
          MozillaUtils.getDirectoryForAddon(addon, copyExtension);
        }
      }
    }

    if (isGecko2) {
      AddonManager.getAllAddons(copyAddonsToProfile);
    }

    // Copy web app preferences
    var preferencesFile = extensionDir.clone();
    preferencesFile.append("preferences");
    preferencesFile.append("preferences.js");
    var targetDir = extensionsDir.clone();
    targetDir.append(extensionDir.leafName);
    targetDir = this._createDirectory(targetDir, "defaults");
    targetDir = this._createDirectory(targetDir, "preferences");
    try {
      preferencesFile.copyTo(targetDir, "");
    }
    catch(e) {
      // The prefs file is presumably there already
    }
  },

  _createBrandingFiles : function(webAppDir, name, copyright) {
    var branding = this._createDirectory(webAppDir, "branding");

    // Create DTD
    var dtd = "<!ENTITY brandShortName \"" + name + "\">\n" +
              "<!ENTITY brandFullName \"" + name + "\">\n" +
              "<!ENTITY  logoCopyright \"" + copyright + "\">\n";
    var dtdFile = branding.clone();
    dtdFile.append("brand.dtd");
    FileIO.stringToFile(dtd, dtdFile);

    // Create properties
    var properties =  "brandShortName=" + name + "\n" +
                      "brandFullName=" + name + "\n" +
                      "vendorShortName=" + name + "\n";
    var propertiesFile = branding.clone();
    propertiesFile.append("brand.properties");
    FileIO.stringToFile(properties, propertiesFile);
  },

  _createChromeFiles : function(extensionStubDir, webAppDir) {
    var chromeDir = this._createDirectory(webAppDir, "chrome");
    var menuHide = extensionStubDir.clone();
    menuHide.append("baseMenuOverlay.xul");
    menuHide.copyTo(chromeDir, null);
  }
};
