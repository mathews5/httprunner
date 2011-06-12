EXPORTED_SYMBOLS = ["LinuxShortcutCreator"];

Components.utils.import("resource://webrunner/modules/ShortcutCreator.jsm");
Components.utils.import("resource://webrunner/modules/ImageUtils.jsm");
Components.utils.import("resource://webrunner/modules/WebAppProperties.jsm");
Components.utils.import("resource://webrunner/modules/FileIO.jsm");
Components.utils.import("resource://webrunner/modules/consts.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

function LinuxShortcutCreator() {
}

LinuxShortcutCreator.prototype = new ShortcutCreator;

LinuxShortcutCreator.prototype.createShortcut = function(target, name, arguments, extensionStubDir, webAppRoot, locations) {
  var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

  // Locate the webapp resources
  var appOverride = webAppRoot.clone();
  appOverride.append("override.ini");

  arguments = "-webapp " + webAppRoot.path;

  var appIcon = webAppRoot.clone();
  appIcon.append("icons");
  appIcon.append("default");
  appIcon.append(WebAppProperties.icon + ImageUtils.getNativeIconExtension());

  var file = dirSvc.get("Desk", Ci.nsIFile);
  file.append(name + ".desktop");
  if (file.exists())
    file.remove(false);
  file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0744);

  var stubDir = webAppRoot.clone();
  stubDir.append("stub");
    
  var stubTarget = stubDir.clone();
  stubTarget.append("webrunner");
  
  var greHome = dirSvc.get("GreD", Ci.nsIFile);
  
  var cmd = "[Desktop Entry]\n";
  cmd += "Name=" + name + "\n";
  cmd += "Type=Application\n";
  cmd += "Comment=Web Application\n";
  // Need to set LD_LIBRARY_PATH before launching the executable
  cmd += "Exec=sh -c \"LD_LIBRARY_PATH=" + greHome.path + " " + stubTarget.path + " " + arguments + "\"\n";
  cmd += "Icon=" + appIcon.path + "\n";

  FileIO.stringToFile(cmd, file);

  return file;
}
