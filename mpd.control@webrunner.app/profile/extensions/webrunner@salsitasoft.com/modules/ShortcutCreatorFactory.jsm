EXPORTED_SYMBOLS = ["ShortcutCreatorFactory"];

Components.utils.import("resource://webrunner/modules/MacOSShortcutCreator.jsm");
Components.utils.import("resource://webrunner/modules/LinuxShortcutCreator.jsm");
Components.utils.import("resource://webrunner/modules/WinShortcutCreator.jsm");

var ShortcutCreatorFactory =
{
  newShortcutCreator : function() {
    return new LinuxShortcutCreator();
  }
};
