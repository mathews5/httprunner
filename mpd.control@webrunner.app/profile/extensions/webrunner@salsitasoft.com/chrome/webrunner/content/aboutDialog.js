
const Cc = Components.classes;
const Ci = Components.interfaces;

var AboutDialog = {
  onLoad: function() {
    var bundle = Cc["@mozilla.org/intl/stringbundle;1"]
               .getService(Ci.nsIStringBundleService);
    bundle = bundle.createBundle("chrome://branding/locale/brand.properties");
  
    var dialog = document.getElementById("webrunner-about");
    dialog.setAttribute("title", bundle.GetStringFromName("brandShortName"));
    
    var nameLabel = document.getElementById("appNameLabel");
    nameLabel.setAttribute("value", bundle.GetStringFromName("brandFullName"));

    var logoImg = document.getElementById("logoImage");
//@line 21 "/home/hudson/workdir/mozilla/trunk_src/extensions/webrunner/chrome/content/aboutDialog.js"
    logoImg.setAttribute("src", "resource://appbundle/icons/default/main-window.png");
//@line 23 "/home/hudson/workdir/mozilla/trunk_src/extensions/webrunner/chrome/content/aboutDialog.js"
  }
};

window.addEventListener("load", AboutDialog.onLoad, false);

