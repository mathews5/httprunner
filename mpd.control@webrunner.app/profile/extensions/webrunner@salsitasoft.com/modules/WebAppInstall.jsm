/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is WebRunner.
 *
 * The Initial Developer of the Original Code is Mozilla Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Finkle <mark.finkle@gmail.com>, <mfinkle@mozilla.com>
 *   Cesar Oliveira <a.sacred.line@gmail.com>
 *   Matthew Gertner <matthew.gertner@gmail.com>
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://webrunner/modules/ShortcutCreatorFactory.jsm");
Components.utils.import("resource://webrunner/modules/ImageUtils.jsm");
Components.utils.import("resource://webrunner/modules/WebAppProperties.jsm");
Components.utils.import("resource://webrunner/modules/FileIO.jsm");
Components.utils.import("resource://webrunner/modules/consts.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

EXPORTED_SYMBOLS = ["WebAppInstall"];

function WebAppInstall() {
  this._shortcutCreator = ShortcutCreatorFactory.newShortcutCreator();
}

WebAppInstall.prototype =
{
  install : function(aFile) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    var reader = Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(Ci.nsIZipReader);
    reader.open(aFile);
    reader.test(null);

    // Extract the webapp.ini to a temp location so it can be parsed
    var tempINI = dirSvc.get("TmpD", Ci.nsIFile);
    tempINI.append("webapp.ini");
    tempINI.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, PR_PERMS_FILE);
    reader.extract("webapp.ini", tempINI);
    WebAppProperties.readINI(tempINI);
    tempINI.remove(false);

    // Creating a webapp install requires an ID
    if (WebAppProperties.id.length > 0) {
      var xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
      var iconExt = ImageUtils.getNativeIconExtension();

      // Now we will unpack the bundle into the webapp folder
      var webAppRoot = WebAppProperties.getAppRoot();
      if (webAppRoot.exists())
        webAppRoot.remove(true);

      // Make a copy so we can return it
      aFile = webAppRoot.clone();

      var appINI = webAppRoot.clone();
      appINI.append("webapp.ini");
      appINI.create(Ci.nsIFile.NORMAL_FILE_TYPE, PR_PERMS_FILE);
      reader.extract("webapp.ini", appINI);

      if (reader.hasEntry("webapp.js")) {
        var appScript = webAppRoot.clone();
        appScript.append("webapp.js");
        appScript.create(Ci.nsIFile.NORMAL_FILE_TYPE, PR_PERMS_FILE);
        reader.extract("webapp.js", appScript);
      }

      // We check for an OS specific and common stylesheet,
      // defaulting to the OS specific sheet
      var xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
      var os = xulRuntime.OS.toLowerCase();
      if (reader.hasEntry(os + "/webapp.css") || reader.hasEntry("webapp.css")) {
        var appStyle = webAppRoot.clone();
        appStyle.append("webapp.css");
        appStyle.create(Ci.nsIFile.NORMAL_FILE_TYPE, PR_PERMS_FILE);
        if (reader.hasEntry(os + "/webapp.css"))
          reader.extract(os + "/webapp.css", appStyle);
        else
          reader.extract("webapp.css", appStyle);
      }

      var iconName = WebAppProperties.icon + iconExt;
      var pngName = WebAppProperties.icon + ".png";
      var appIcon = webAppRoot.clone();
      appIcon.append("icons");
      appIcon.append("default");
      appIcon.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);

      if (reader.hasEntry(iconName)) {
        appIcon.append(iconName);
        appIcon.create(Ci.nsIFile.NORMAL_FILE_TYPE, PR_PERMS_FILE);
        reader.extract(iconName, appIcon);
      }
      else if (reader.hasEntry(pngName))
      {
        var targetPath = appIcon.clone();
        appIcon.append(pngName);
        appIcon.create(Ci.nsIFile.NORMAL_FILE_TYPE, PR_PERMS_FILE);
        reader.extract(pngName, appIcon);

        var storageStream = ImageUtils.createNativeIconFromFile(appIcon);
        var inputStream = storageStream.newInputStream(0);

        var nativeIcon = appIcon.parent.clone();
        var fileTitle = appIcon.leafName;
        var dot = fileTitle.lastIndexOf(".");
        if (dot != -1)
          fileTitle = fileTitle.substring(0, dot);
        nativeIcon.append(fileTitle + ImageUtils.getNativeIconExtension());

        var stream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
        stream.init(nativeIcon, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, PR_PERMS_FILE, 0);

        var bss = Cc["@mozilla.org/network/buffered-output-stream;1"].
                  createInstance(Ci.nsIBufferedOutputStream);
        bss.init(stream, 1024);

        bss.writeFrom(inputStream, inputStream.available());
        bss.close();
      }
      else {
        // webapp.ini doesn't have its own icon, so we substitute the
        // default icon instead
        var defaultIcon = dirSvc.get("resource:app", Ci.nsIFile);
        var defaultIconName = "app" + iconExt;

        defaultIcon.append("chrome");
        defaultIcon.append("icons");
        defaultIcon.append("default");
        defaultIcon.append(defaultIconName);

        defaultIcon.copyTo(appIcon, iconName);
      }
      WebAppProperties.appBundle = webAppRoot;
    }

    return aFile;
  },

  restart : function(id, shortcut) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);

    // Locate the runtime
    var target = dirSvc.get("XREExeF", Ci.nsIFile);

    var appOverride = WebAppProperties.getAppRoot();
    appOverride.append("override.ini");

    // Launch target with webapp
    process.init(target);
    var restartArgs = ["-override", appOverride.path, "-webapp", id];
    process.run(false, restartArgs, restartArgs.length);
  },

  createApplication : function(params, clean) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    // Creating a webapp install requires an ID
    if (params.hasOwnProperty("id") == true && params.id.length > 0) {
      // Now we will build the webapp folder in the profile
      var webAppRoot = WebAppProperties.getAppRoot();

      // Remove any existing webapp folder if we want a clean install
      if (webAppRoot.exists() && clean)
        webAppRoot.remove(true);

      // Make sure the folder exists
      if (!webAppRoot.exists())
        webAppRoot.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);

      var appINI = webAppRoot.clone();
      appINI.append("webapp.ini");

      // If webrunner was launched with '-webapp <path_to_webapp_bundle>'
      // parameter specified, the 'webapp.ini' file can already exists
      // at this point. If it is the case, make sure it is writable.
      if (appINI.exists() && !appINI.isWritable())
        appINI.QueryInterface(Ci.nsILocalFile).permissions = PR_PERMS_FILE;

      // Save the params to an INI file
      var cmd = "[Parameters]\n";
      cmd += "id=" + params.id + "\n";
      cmd += "name=" + params.name + "\n";
      cmd += "uri=" + params.uri + "\n";
      cmd += "icon=" + WebAppProperties.icon + "\n";
      cmd += "status=" + params.status + "\n";
      cmd += "location=" + params.location + "\n";
      cmd += "sidebar=" + params.sidebar + "\n";
      cmd += "trayicon=" + params.trayicon + "\n";
      FileIO.stringToFile(cmd, appINI);

      // Save the params to an override INI file
      var overINI = webAppRoot.clone();
      overINI.append("override.ini");

      cmd = "[App]\n";
      // cmd += "Vendor=WebRunner\n";
      cmd += "Name=" + params.group + "\n";
      FileIO.stringToFile(cmd, overINI);
      
      // Copy the icon
      var appIcon = webAppRoot.clone();
      appIcon.append("icons");
      appIcon.append("default");
      if (!appIcon.exists())
        appIcon.create(Ci.nsIFile.DIRECTORY_TYPE, PR_PERMS_DIRECTORY);
      appIcon.append(WebAppProperties.icon + ImageUtils.getNativeIconExtension());
      
      // See comments above about permissions.
      if (appIcon.exists() && !appIcon.isWritable())
        appIcon.QueryInterface(Ci.nsILocalFile).permissions = PR_PERMS_FILE;
      
      var stream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
      stream.init(appIcon, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, PR_PERMS_FILE, 0);
      var bufferedStream = Cc["@mozilla.org/network/buffered-output-stream;1"].
                           createInstance(Ci.nsIBufferedOutputStream);
      bufferedStream.init(stream, 1024);
      
      bufferedStream.writeFrom(params.icon.stream, params.icon.stream.available());
      bufferedStream.close();
      
      // we need png icon to display in about box, <image> will to display os
      // specific formats such as "ico"
      if (ImageUtils.getNativeIconExtension() != ".png") {
        var pngIcon = webAppRoot.clone();
        pngIcon.append("icons");
        pngIcon.append("default");
        pngIcon.append(WebAppProperties.icon + ".png");
        var stream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
        stream.init(pngIcon, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, PR_PERMS_FILE, 0);
        var buffStream = Cc["@mozilla.org/network/buffered-output-stream;1"].
                              createInstance(Ci.nsIBufferedOutputStream);
        buffStream.init(stream, 1024);
      
        try {
          ImageUtils.createPngIcon(params.origIcon.stream, params.origIcon.mimeType, buffStream);
        }
        catch (e) {
          //probably format is unsuported by imageUtils, do nothing
        }
        bufferedStream.close();
      }
      
      var extensionDir = this.getExtensionDirectory();
      this._shortcutCreator.createWebApp(extensionDir, webAppRoot, params.name);
    }
  },

  createShortcut : function(name, id, locations) {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

    // Locate the webapp folder in the profile
    var webAppRoot = WebAppProperties.getAppRoot();

    // Locate the runtime
    var target = dirSvc.get("XREExeF", Ci.nsIFile);
    
    /* Check to see if were pointing to a binary (eg. xulrunner-bin).
     * We always want to point to xulrunner rather than xulrunner-bin,
     * because xulrunner will set up the library paths
     */
    if (target.leafName.search("-bin") != -1) {
      let target_shell = target.parent;
      target_shell.append(target.leafName.replace("-bin", ""));
      if (target_shell.exists()) {
        target = target_shell;
      }
    }

    var extensionStubDir = this.getExtensionDirectory();
    extensionStubDir.append("stub");
    
    var arguments = "";
    arguments += "-webapp " + id;
    return this._shortcutCreator.createShortcut(target, name, arguments, extensionStubDir, webAppRoot, locations);
  },
  
  getExtensionDirectory : function()
  {
    var webrunnerApp = Cc["@mozilla.org/webrunner-app-startup;1"].getService(Ci.nsIWebRunnerApp);
    return webrunnerApp.extensionDir.clone();
  },
};
