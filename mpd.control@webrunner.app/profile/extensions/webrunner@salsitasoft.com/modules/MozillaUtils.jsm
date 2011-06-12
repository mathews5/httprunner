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

EXPORTED_SYMBOLS = ["MozillaUtils"];

var MozillaUtils =
{
  _extensionDirs : new Array(),

  getDirectoryForAddon : function(addon, callback) {
    var extensionDir = Services.io.getProtocolHandler("file").QueryInterface(Ci.nsIFileProtocolHandler).getFileFromURLSpec(addon.getResourceURI(null).spec);
    this._extensionDirs[addon.id] = extensionDir;
    callback(extensionDir);
  },

  getExtensionDirectory : function(extensionID,  callback) {
    try {
      if (extensionID in this._extensionDirs) {
        callback(this._extensionDirs[extensionID]);
        return;
      }
      Components.utils.import("resource://gre/modules/AddonManager.jsm");
      Components.utils.import("resource://gre/modules/Services.jsm");
      var self = this;
      try {
        AddonManager.getAddonByID(extensionID, function(addon) {
          self.getDirectoryForAddon(addon, callback);
        });
      }
      catch (e) {
        // Return null to signal that we couldn't get the addon or its location
        callback(null);
      }
    }
    catch (e) {
      // Pre-2.0 support
      var em = Cc["@mozilla.org/extensions/manager;1"].getService(Ci.nsIExtensionManager);
      callback(em.getInstallLocation(extensionID).getItemLocation(extensionID));
    }
  }
}
