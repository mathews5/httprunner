WebRunner.getMenuBundle = function() {
  var bundle = Cc["@mozilla.org/intl/stringbundle;1"]
               .getService(Ci.nsIStringBundleService);
  bundle = bundle.createBundle("chrome://webrunner/locale/baseMenuOverlay.properties");
  return bundle;
}

WebRunner.openAboutAppDialog = function()
{
//@line 25 "/home/hudson/workdir/mozilla/trunk_src/extensions/webrunner/chrome/content/baseMenuOverlay.js"
  window.openDialog("chrome://webrunner/content/aboutDialog.xul",
                    this.getMenuBundle().GetStringFromName("aboutDlg.about"),
                    "centerscreen,chrome,resizable=no");
//@line 29 "/home/hudson/workdir/mozilla/trunk_src/extensions/webrunner/chrome/content/baseMenuOverlay.js"
}
