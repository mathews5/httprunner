EXPORTED_SYMBOLS = ["WinShortcutCreator"];

Components.utils.import("resource://webrunner/modules/ShortcutCreator.jsm");
Components.utils.import("resource://webrunner/modules/ImageUtils.jsm");
Components.utils.import("resource://webrunner/modules/WebAppProperties.jsm");
Components.utils.import("resource://webrunner/modules/consts.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

function WinShortcutCreator() {
}

WinShortcutCreator.prototype = new ShortcutCreator;

WinShortcutCreator.prototype.createShortcut = function(target, name, arguments, extensionStubDir, webAppRoot, locations) {
  var desktop = Cc["@mozilla.org/desktop-environment;1"].getService(Ci.nsIDesktopEnvironment);
  var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

  // Locate the webapp resources
  var appOverride = webAppRoot.clone();
  appOverride.append("override.ini");

  arguments = "-webapp " + "\"" + webAppRoot.path + "\"";

  var appIcon = webAppRoot.clone();
  appIcon.append("icons");
  appIcon.append("default");
  appIcon.append(WebAppProperties.icon + ImageUtils.getNativeIconExtension());

  var stubDir = webAppRoot.clone();
  stubDir.append("stub");

  var stubTarget = stubDir.clone();
  stubTarget.append("webrunner.exe");

  var shortcut = null;
  var directory = null;
  for (var i=0; i<locations.length; i++)
  {
    if (locations[i] == "desktop") {
      directory = dirSvc.get("Desk", Ci.nsIFile);
    }
    else if (locations[i] == "programs") {
      directory = dirSvc.get("Progs", Ci.nsIFile);
      directory.append("Web Apps");
    }
    else if (locations[i] == "quicklaunch") {
      directory = dirSvc.get("QuickLaunch", Ci.nsIFile);
    }
    else {
      continue;
    }

    shortcut = desktop.createShortcut(name, stubTarget, directory, stubDir.path, arguments, "", appIcon);
  }

  // Return one of the created shortcuts so that we can spawn the app when
  // everything's finished.
  return shortcut;
}

WinShortcutCreator.prototype._superCreateWebAppFiles = WinShortcutCreator.prototype._createWebAppFiles;

WinShortcutCreator.prototype._createWebAppFiles = function(extensionStubDir, webAppStubDir, name) {
  var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

  var firefoxDir = dirSvc.get("GreD", Ci.nsIFile);
  var pluginCont = firefoxDir.clone();
  pluginCont.append("plugin-container.exe");
  pluginCont.copyTo(webAppStubDir, "");

  var mozCrt = firefoxDir.clone();
  mozCrt.append("mozcrt19.dll");
  if (mozCrt.exists()) {
    mozCrt.copyTo(webAppStubDir, "");
  }

  this._superCreateWebAppFiles(extensionStubDir, webAppStubDir, name);
}
