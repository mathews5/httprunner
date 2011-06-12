EXPORTED_SYMBOLS = ["MacShortcutCreator"];

Components.utils.import("resource://webrunner/modules/ShortcutCreator.jsm");
Components.utils.import("resource://webrunner/modules/ImageUtils.jsm");
Components.utils.import("resource://webrunner/modules/WebAppProperties.jsm");
Components.utils.import("resource://webrunner/modules/FileIO.jsm");
Components.utils.import("resource://webrunner/modules/consts.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

function MacShortcutCreator() {
}

MacShortcutCreator.prototype = new ShortcutCreator;

MacShortcutCreator.prototype.createShortcut = function(target, name, arguments, extensionStubDir, webAppRoot, locations) {
  var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

  var bundle = null;
  if (locations.indexOf("desktop") > -1) {
    var desk = dirSvc.get("Desk", Ci.nsIFile);
    bundle = this._createBundle(target, name, "", arguments, extensionStubDir, desk);
  }
  if (locations.indexOf("applications") > -1) {
    var apps = dirSvc.get("LocApp", Ci.nsIFile);
    if (!apps.exists())
      apps.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);
    bundle = this._createBundle(target, name, "", arguments, extensionStubDir, apps);
  }

  // Return the exec script file so it can be spawned (for restart)
  var scriptFile = bundle.clone();
  scriptFile.append("Contents");
  scriptFile.append("MacOS");
  scriptFile.append("webrunner");

  return scriptFile;
}

MacShortcutCreator.prototype._createBundle = function(target, name, copyright, arguments, extensionStubDir, location) {
  var contents =
  "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
  "<!DOCTYPE plist PUBLIC \"-//Apple Computer//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n" +
  "<plist version=\"1.0\">\n" +
  "<dict>\n" +
  "<key>CFBundleIdentifier</key>\n" +
  "<string>com.salsitasoft.webrunner." + WebAppProperties.id.substring(0, WebAppProperties.id.indexOf("@")) + "</string>\n" +
  "<key>CFBundleExecutable</key>\n" +
  "<string>webrunner</string>\n" +
  "<key>CFBundleIconFile</key>\n" +
  "<string>" + WebAppProperties.icon + ImageUtils.getNativeIconExtension() + "</string>\n" +
  "</dict>\n" +
  "</plist>";

  location.append(name + ".app");
  if (location.exists())
    location.remove(true);
  location.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);

  var bundle = location.clone();

  location.append("Contents");
  location.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);

  var info = location.clone();
  info.append("Info.plist");
  FileIO.stringToFile(contents, info);

  var resources = location.clone();
  resources.append("Resources");
  resources.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);
  
  // On Mac, set the app root to the webapp subdirectory of the app bundle
  var appRoot = resources.clone();
  appRoot.append("webapp");
  appRoot.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);
  WebAppProperties.appRoot = appRoot;

  var macos = location.clone();
  macos.append("MacOS");
  macos.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);

  // Copy the webrunner stub into the bundle
  var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
  var stub = dirSvc.get("XREExeF", Ci.nsIFile);
  var greHome = stub.parent.parent.clone();
  
  // Create the locale file with the app name (for the menu bar)
  var infoPlistStrings = resources.clone();
  infoPlistStrings.append("en.lproj");
  infoPlistStrings.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);
  infoPlistStrings.append("InfoPlist.strings");
  FileIO.stringToFile("CFBundleName = \"" + name + "\";\n", infoPlistStrings, "UTF-16");

  greHome.append("MacOS");

  // Can't use the Firefox stub so we need to use the XR stub supplied with the extension
  stub = extensionStubDir.clone();
  if (Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).XPCOMABI.indexOf("64") != -1) {
    stub.append("webrunner");
  }
  else {
    // 32-bit Firefox so copy the 32-bit stub
    stub.append("webrunner32");
  }
  stub.copyTo(macos, "webrunner");
  macos.append("webrunner");
  macos.permissions = 0755;

  this._createWebAppFiles(extensionStubDir, resources, name);

  // Create the branding files and chrome overrides
  this._createBrandingFiles(resources, name, copyright);
  this._createChromeFiles(extensionStubDir, resources);

  return bundle;
}

MacShortcutCreator.prototype._createProfile = function(extensionDir, webAppDir, name) {
  // This is a hack since there doesn't appear to be any way to get the "Application Support"
  // directory directly from the directory service. A cleaner solution might be to implement a method
  // in nsIDesktopEnvironment.
  var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
  var applicationSupportDir = dirSvc.get("XREUSysExt", Ci.nsIFile).parent.parent;
  var profileDir = this._createDirectory(applicationSupportDir, "WebRunner");
  profileDir = this._createDirectory(profileDir, name);
  profileDir = this._createDirectory(profileDir, "Profile");
  return profileDir;
}

