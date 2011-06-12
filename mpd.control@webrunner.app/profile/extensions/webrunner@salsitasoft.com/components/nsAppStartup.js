//@line 2 "/home/hudson/workdir/mozilla/trunk_src/extensions/webrunner/components/src/nsAppStartup.js"
/*
//@line 40 "/home/hudson/workdir/mozilla/trunk_src/extensions/webrunner/components/src/nsAppStartup.js"
*/

/* Development of this Contribution was supported by Yahoo! Inc. */
/* Development of this Contribution was supported by VMware. */

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

function AppStartup() {

}

AppStartup.prototype = {
  classDescription: "Application initialization",
  classID:          Components.ID("{54683c67-7e7c-444e-a9f7-bb47fe42d828}"),
  contractID:       "@mozilla.org/webrunner-app-startup;1",

  extensionDir: null,

  QueryInterface: XPCOMUtils.generateQI(
    [Ci.nsIObserver,
     Ci.nsIClassInfo,
     Ci.nsIWebRunnerApp]),

  // nsIClassInfo
  implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
  flags: Ci.nsIClassInfo.DOM_OBJECT,

  getInterfaces: function getInterfaces(aCount) {
    var interfaces = [Ci.nsIObserver,
                      Ci.nsIClassInfo];
    aCount.value = interfaces.length;
    return interfaces;
  },

  getHelperForLanguage: function getHelperForLanguage(aLanguage) {
    return null;
  },

  //nsIObserver
  observe: function (aSubject, aTopic, aData) {
    if (aTopic == "profile-after-change") {
      Services.obs.addObserver(this, "command-line-startup", false);
    }
    else if (aTopic == "command-line-startup") {

      // Initialize extension directory property since we may need it later (easier to do it once now since it is
      // retrieved asynchronously).
      Components.utils.import("resource://webrunner/modules/WebAppProperties.jsm");
      Components.utils.import("resource://webrunner/modules/MozillaUtils.jsm");
      var self = this;
      MozillaUtils.getExtensionDirectory("webrunner@salsitasoft.com", function(extensionDir) { self.extensionDir = extensionDir; });

      var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
      var resourceProtocol = ios.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler);
      var environment = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);

      var resourcesRoot = null;
      var browserResRoot = null;

      var rootPath = environment.get("WEBRUNNER_APP_BUNDLE");

      // Make sure that the -webrunner flag is set so we know that we should use WebRunner branding
      if (aSubject.findFlag("webrunner", false) == -1) {
        // Not running from the stub so we want to use standard branding
        rootPath = "";
      }

      if (rootPath != "") {
        var substPath = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
        substPath.initWithPath(rootPath);
        resourcesRoot = ios.newFileURI(substPath);

        substPath.append("chrome");
        browserResRoot = ios.newFileURI(substPath);
      }
      else {
        var prefs = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
        var dirs = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
        var fileProtocolHandler = ios.getProtocolHandler("file").QueryInterface(Ci.nsIFileProtocolHandler);

        var locale = prefs.getCharPref("general.useragent.locale");
        // Firefox on Ubuntu does not return locale name, but some chrome:// link
        if (locale.indexOf("chrome://") >= 0) {
          var channel = ios.newChannel(locale, null, null);
          var istream = channel.open();
          var sistream = Cc["@mozilla.org/scriptableinputstream;1"]
                          .createInstance(Ci.nsIScriptableInputStream);
          sistream.init(istream);
          var str = sistream.read(sistream.available());
          var searchStr = "general.useragent.locale=";
          var ind = str.indexOf(searchStr);
          if (ind >= 0) {
            var offset = ind + searchStr.length;
            locale = str.substring(offset, offset + 5);
          }
          else {
            locale = "en-US";
          }
        }

        var jarFile = dirs.get("CurProcD", Ci.nsIFile);
        var browserFile = null;
        var jarLocalePrefix = "";
        var jarContentPrefix = "";
        jarFile.append("omni.jar");
        if (jarFile.exists()) {
          jarLocalePrefix = "/chrome/" + locale;
          jarContentPrefix = "/chrome/browser";
        }
        else {
          jarFile = jarFile.parent;

          jarFile.append("chrome");
          // Ubuntu uses different name for that file
          jarFile.append("browser-branding-" + locale + ".jar");
          if (!jarFile.exists()) {
            jarFile = jarFile.parent;
            jarFile.append(locale + ".jar");
          }

          browserFile = dirs.get("CurProcD", Ci.nsIFile);
          browserFile.append("chrome");
          browserFile.append("browser.jar");
        }

        if (jarFile.exists()) {
          var jarFileURI = fileProtocolHandler.newFileURI(jarFile);
          var spec = "jar:" + jarFileURI.spec + "!" + jarLocalePrefix + "/locale/";
          resourcesRoot = ios.newURI(spec, null, null);

          if (browserFile) {
            jarFileURI = fileProtocolHandler.newFileURI(browserFile);
          }
          spec = "jar:" + jarFileURI.spec + "!" + jarContentPrefix + "/content/browser/";
          browserResRoot = ios.newURI(spec, null, null);
        }
        else {
          // Assume flat chrome
          var chromeDir = jarFile.parent;
          chromeDir.append(locale);
          chromeDir.append("locale");
          resourcesRoot = fileProtocolHandler.newFileURI(chromeDir);

          chromeDir = browserFile.parent;
          chromeDir.append("browser");
          chromeDir.append("content");
          chromeDir.append("browser");
          browserResRoot = fileProtocolHandler.newFileURI(chromeDir);
        }
      }

      resourceProtocol.setSubstitution("appbundle", resourcesRoot);
      resourceProtocol.setSubstitution("menures", browserResRoot);
    }
  },
}

var NSGetFactory = XPCOMUtils.generateNSGetFactory([AppStartup]);
