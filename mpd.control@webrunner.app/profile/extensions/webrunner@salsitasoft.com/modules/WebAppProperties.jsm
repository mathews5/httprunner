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

const Cc = Components.classes;
const Ci = Components.interfaces;

EXPORTED_SYMBOLS = ["WebAppProperties"];

/**
 * Constructs an nsISimpleEnumerator for the given array of items.
 */
function ArrayEnumerator(aItems) {
  this._items = aItems;
  this._nextIndex = 0;
}

ArrayEnumerator.prototype = {
  hasMoreElements: function()
  {
    return this._nextIndex < this._items.length;
  },
  getNext: function()
  {
    if (!this.hasMoreElements())
      throw Components.results.NS_ERROR_NOT_AVAILABLE;

    return this._items[this._nextIndex++];
  },
  QueryInterface: function(aIID)
  {
    if (Ci.nsISimpleEnumerator.equals(aIID) ||
        Ci.nsISupports.equals(aIID))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};

/**
 * Directory provider for web app directory.
 */

function WebRunnerDirectoryProvider(aFolder) {
  this._folder = aFolder;
}

WebRunnerDirectoryProvider.prototype = {
  getFile: function(prop, persistent) {
    if (prop == "WebAppD") {
      return this._folder.clone();
    }
    else {
      return Components.results.NS_ERROR_FAILURE;
    }
  },

  getFiles: function(prop, persistent) {
    return Components.results.NS_ERROR_FAILURE;
  },

  QueryInterface: function(iid) {
    if (iid.equals(Ci.nsIDirectoryServiceProvider) ||
        iid.equals(Ci.nsIDirectoryServiceProvider2) ||
        iid.equals(Ci.nsISupports))
    {
      return this;
    }
    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};

/**
 * Directory provider that provides access to external chrome icons
 */
const NS_APP_CHROME_DIR_LIST = "AChromDL";

function IconProvider(aFolder) {
  this._folder = aFolder;
}

IconProvider.prototype = {
  getFile: function(prop, persistent) {
    return Components.results.NS_ERROR_FAILURE;
  },

  getFiles: function(prop, persistent) {
    if (prop == NS_APP_CHROME_DIR_LIST) {
      return new ArrayEnumerator([this._folder.clone()]);
    }
    else {
      return Components.results.NS_ERROR_FAILURE;
    }
  },

  QueryInterface: function(iid) {
    if (iid.equals(Ci.nsIDirectoryServiceProvider) ||
        iid.equals(Ci.nsIDirectoryServiceProvider2) ||
        iid.equals(Ci.nsISupports))
    {
      return this;
    }
    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};

var WebAppProperties =
{
  isWebApp : false,
  script : {},
  scriptLoaded : false,
  id : "",
  name : null,
  fileTypes : [],
  uri : null,
  icon : "main-window",
  status : false,
  location : false,
  sidebar : false,
  trayicon: false,
  credits : "",
  splashscreen : null,
  include : null,
  exclude : null,
  refresh : null,
  iconic : false,
  maximize: false,
  appBundle : null,
  appRoot : null,
  installRoot : null,
  initialized : false,
  flags : ["id", "name", "uri", "icon", "status", "location", "sidebar", "trayicon",
           "credits", "splashscreen", "include", "exclude", "refresh", "iconic", "maximize"],

  getInstallRoot : function() {
    if (!this.installRoot) {
      var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

      this.installRoot = dirSvc.get("Home", Ci.nsIFile);
      this.installRoot.append(".webapps");

      // Register the directory provider for the web apps directory
      var installRoot = this.getInstallRoot();

      var dirProvider = new WebRunnerDirectoryProvider(installRoot);
      dirSvc.QueryInterface(Ci.nsIDirectoryService).registerProvider(dirProvider);
    }

    return this.installRoot;
  },

  getAppRoot : function() {
    if (this.appRoot) {
      return this.appRoot.clone();
    }
    else {
      if (!this.installRoot) {
        this.getInstallRoot();
      }

      var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
      var appRoot = dirSvc.get("WebAppD", Ci.nsIFile);
      appRoot.append(this.id);
      return appRoot;
    }
  },

  setParameter: function(aName, aValue) {
    if (WebAppProperties.flags.indexOf(aName) == -1)
      return;

    if (typeof WebAppProperties[aName] == "boolean" && typeof aValue != "boolean")
      aValue = (aValue.toLowerCase() == "true" || aValue.toLowerCase() == "yes");

    WebAppProperties[aName] = aValue;
  },

  readINI : function(aFile) {
    var iniFactory = Components.manager.getClassObjectByContractID("@mozilla.org/xpcom/ini-parser-factory;1", Ci.nsIINIParserFactory);
    var iniParser = iniFactory.createINIParser(aFile);

    var keys = iniParser.getKeys("Parameters");
    while (keys.hasMore()) {
      var key = keys.getNext();
      var value = iniParser.getString("Parameters", key);
      this.setParameter(key.toLowerCase(), value);
    }

    keys = iniParser.getKeys("FileTypes");
    while (keys.hasMore()) {
      var key = keys.getNext();
      var value = iniParser.getString("Parameters", key);
      var values = value.split(";");
      if (values.length == 4) {
        var type = {};
        type.name = values[0];
        type.extension = values[1];
        type.description = values[2];
        type.contentType = values[3];
        WebAppProperties.fileTypes.push(type);
      }
    }
  },

  init : function(aFile) {
    this.appRoot = aFile.clone();

    var appSandbox = aFile.clone();

    // Read the INI settings
    var appINI = appSandbox.clone();
    appINI.append("webapp.ini");
    if (appINI.exists())
      this.readINI(appINI);

    // Set browser homepage as initial webapp page
    if (this.uri) {
      var prefs = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
      prefs.setCharPref("browser.startup.homepage", this.uri);
    }

    // Load the application script (if it isn't already loaded)
    if (!this.scriptLoaded) {
      var appScript = appSandbox.clone();
      appScript.append("webapp.js");
      if (appScript.exists()) {
        var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        var appScriptURI = ios.newFileURI(appScript);

        var scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
        scriptLoader.loadSubScript(appScriptURI.spec, WebAppProperties.script);
        this.scriptLoaded = true;
      }
    }

    // Load the application style
    var appStyle = appSandbox.clone();
    appStyle.append("webapp.css");
    if (appStyle.exists()) {
      var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
      var appStyleURI = ios.newFileURI(appStyle);

      var styleSheets = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
      styleSheets.loadAndRegisterSheet(appStyleURI, styleSheets.USER_SHEET);
    }

    // Initialize the icon provider
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIDirectoryService);
    var iconProvider = new IconProvider(aFile);
    dirSvc.registerProvider(iconProvider);
  }
};
