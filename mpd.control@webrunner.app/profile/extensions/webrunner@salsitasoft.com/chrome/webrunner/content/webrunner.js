//@line 2 "/home/hudson/workdir/mozilla/trunk_src/extensions/webrunner/chrome/content/webrunner.js"

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
 *   Mark Finkle, <mark.finkle@gmail.com>, <mfinkle@mozilla.com>
 *   Wladimir Palant <trev@adblockplus.org>
 *   Sylvain Pasche <sylvain.pasche@gmail.com>
 *   Matthew Gertner <matthew.gertner@gmail.com>
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://webrunner/modules/WebAppProperties.jsm", WebRunner);

window.addEventListener("load", function() { WebRunner.Overlay.startup(); }, false);


/**
 * Main application code.
 */
WebRunner.Overlay = {
  _ios : null,
  _tld : null,
  _uri : null,
  _xulWindow : null,
  _currentDomain : null,
  _windowCreator : null,
  _minimizedState : 0,
  _zoomLevel : 1,
  _loadError : false,
  _firstLoad : true,
  _clickHandler : null,
  _activateHandler : null,

  _delayedStartup : function() {
    this._prepareWebAppScript();

    // Give the user script the chance to do additional processing before
    // the page loads
    if (WebRunner.WebAppProperties.script.preload) {
      if (!WebRunner.WebAppProperties.script.preload())
        // Preload failed so don't load the web app URI
        return;
    }

    // Show tray icon, if any, and default behavior to hide on minimize
    if (WebRunner.WebAppProperties.trayicon && ("@mozilla.org/desktop-environment;1" in Cc)) {
      this.showTrayIcon();

      var desktop = Cc["@mozilla.org/desktop-environment;1"].getService(Ci.nsIDesktopEnvironment);
      var icon = desktop.applicationIcon;
      icon.behavior = Ci.nsIApplicationIcon.HIDE_ON_MINIMIZE;
    }

    // Setup the resource:// substitution for the app's root directory
    var resourceProtocol = this._ios.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler);
    var appRootURI = this._ios.newFileURI(WebRunner.WebAppProperties.getAppRoot());
    resourceProtocol.setSubstitution("webapp", appRootURI);

    // Call the script's load() function once the page has finished loading
    if (WebRunner.WebAppProperties.script.load) {
      var self = this;
      gBrowser.addEventListener("DOMContentLoaded", function(e) { self._contentLoaded(e); }, true);
    }

    gBrowser.loadURI(WebRunner.WebAppProperties.uri, null, null);

    if (WebRunner.WebAppProperties.refresh && WebRunner.WebAppProperties.refresh > 0) {
      this._autoRefresh(false);
    }
  },

  _contentLoaded : function(event) {
    // Don't fire for iframes
    if (event.target == gBrowser.contentDocument) {
      WebRunner.WebAppProperties.script["window"] = gBrowser.contentWindow.wrappedJSObject;

      if (this._firstLoad) {
        this._firstLoad = false;
        if (!this._loadError) {
          WebRunner.WebAppProperties.script.load();
        }
        else if (WebRunner.WebAppProperties.script.error) {
          WebRunner.WebAppProperties.script.error();
        }
      }
    }
  },

  _autoRefresh : function(refreshNow) {
    if (refreshNow) {
      gBrowser.reload();
    }
    var self = this;
    setTimeout(function() { self._autoRefresh(true); }, WebRunner.WebAppProperties.refresh * 1000);
  },

  _processConfig : function() {
    // Process commandline parameters

    // We can't hide the toolbar using the visible attribute since this breaks tab bar autohide
    // So we set a special attribute so that our own custom CSS style is used
    // Also it turns out the chromehidden attribute breaks opening new windows in a tab as well,
    // since Firefox thinks that we are a popup window. So we use our own attribute and CSS styles
    // for hiding all the relevant browser chrome.
    var chromehidden = "";
    if (!WebRunner.WebAppProperties.location) {
      chromehidden += "location toolbar ";
    }
    else {
      chromehidden += "directories ";
    }
    if (WebRunner.WebAppProperties.status) {
      chromehidden += "status ";
    }
    document.documentElement.setAttribute("webrunner-chromehidden", chromehidden);
  },

  _handleWindowClose : function(event) {
//@line 145 "/home/hudson/workdir/mozilla/trunk_src/extensions/webrunner/chrome/content/webrunner.js"

    // Handler for clicking on the 'x' to close the window
    if (!this.shutdownQuery()) {
      return false;
    }

    return true;
  },

  _domTitleChanged : function(aEvent) {
    if (aEvent.target != gBrowser.contentDocument)
      return;
    document.title = aEvent.target.title;
  },

  // Converts a pattern in this programs simple notation to a regular expression.
  // thanks Greasemonkey! http://www.mozdev.org/source/browse/greasemonkey/src/
  // thanks AdBlock (via Greasemonkey)! http://www.mozdev.org/source/browse/adblock/adblock/
  _convert2RegExp : function(pattern) {
    s = new String(pattern);
    res = new String("^");

    for (var i = 0 ; i < s.length ; i++) {
      switch(s[i]) {
        case '*' :
          res += ".*";
          break;

        case '.' :
        case '?' :
        case '^' :
        case '$' :
        case '+' :
        case '{' :
        case '[' :
        case '|' :
        case '(' :
        case ')' :
        case ']' :
          res += "\\" + s[i];
          break;

        case '\\' :
          res += "\\\\";
          break;

        case ' ' :
          // Remove spaces from URLs.
          break;

        default :
          res += s[i];
          break;
      }
    }

    var tldRegExp = new RegExp("^(\\^(?:[^/]*)(?://)?(?:[^/]*))(\\\\\\.tld)((?:/.*)?)$")
    var tldRes = res.match(tldRegExp);
    if (tldRes) {
      // build the mighty TLD RegExp
      var tldStr = "\.(?:demon\\.co\\.uk|esc\\.edu\\.ar|(?:c[oi]\\.)?[^\\.]\\.(?:vt|ne|ks|il|hi|sc|nh|ia|wy|or|ma|vi|tn|in|az|id|nc|co|dc|nd|me|al|ak|de|wv|nm|mo|pr|nj|sd|md|va|ri|ut|ct|pa|ok|ky|mt|ga|la|oh|ms|wi|wa|gu|mi|tx|fl|ca|ar|mn|ny|nv)\\.us|[^\\.]\\.(?:(?:pvt\\.)?k12|cc|tec|lib|state|gen)\\.(?:vt|ne|ks|il|hi|sc|nh|ia|wy|or|ma|vi|tn|in|az|id|nc|co|dc|nd|me|al|ak|de|wv|nm|mo|pr|nj|sd|md|va|ri|ut|ct|pa|ok|ky|mt|ga|la|oh|ms|wi|wa|gu|mi|tx|fl|ca|ar|mn|ny|nv)\\.us|[^\\.]\\.vt|ne|ks|il|hi|sc|nh|ia|wy|or|ma|vi|tn|in|az|id|nc|co|dc|nd|me|al|ak|de|wv|nm|mo|pr|nj|sd|md|va|ri|ut|ct|pa|ok|ky|mt|ga|la|oh|ms|wi|wa|gu|mi|tx|fl|ca|ar|mn|ny|nvus|ne|gg|tr|mm|ki|biz|sj|my|hn|gl|ro|tn|co|br|coop|cy|bo|ck|tc|bv|ke|aero|cs|dm|km|bf|af|mv|ls|tm|jm|pg|ky|ga|pn|sv|mq|hu|za|se|uy|iq|ai|com|ve|na|ba|ph|xxx|no|lv|tf|kz|ma|in|id|si|re|om|by|fi|gs|ir|li|tz|td|cg|pa|am|tv|jo|bi|ee|cd|pk|mn|gd|nz|as|lc|ae|cn|ag|mx|sy|cx|cr|vi|sg|bm|kh|nr|bz|vu|kw|gf|al|uz|eh|int|ht|mw|gm|bg|gu|info|aw|gy|ac|ca|museum|sk|ax|es|kp|bb|sa|et|ie|tl|org|tj|cf|im|mk|de|pro|md|fm|cl|jp|bn|vn|gp|sm|ar|dj|bd|mc|ug|nu|ci|dk|nc|rw|aq|name|st|hm|mo|gq|ps|ge|ao|gr|va|is|mt|gi|la|bh|ms|bt|gb|it|wf|sb|ly|ng|gt|lu|il|pt|mh|eg|kg|pf|um|fr|sr|vg|fj|py|pm|sn|sd|au|sl|gh|us|mr|dz|ye|kn|cm|arpa|bw|lk|mg|tk|su|sc|ru|travel|az|ec|mz|lb|ml|bj|edu|pr|fk|lr|nf|np|do|mp|bs|to|cu|ch|yu|eu|mu|ni|pw|pl|gov|pe|an|ua|uk|gw|tp|kr|je|tt|net|fo|jobs|yt|cc|sh|io|zm|hk|th|so|er|cz|lt|mil|hr|gn|be|qa|cv|vc|tw|ws|ad|sz|at|tg|zw|nl|info\\.tn|org\\.sd|med\\.sd|com\\.hk|org\\.ai|edu\\.sg|at\\.tt|mail\\.pl|net\\.ni|pol\\.dz|hiroshima\\.jp|org\\.bh|edu\\.vu|net\\.im|ernet\\.in|nic\\.tt|com\\.tn|go\\.cr|jersey\\.je|bc\\.ca|com\\.la|go\\.jp|com\\.uy|tourism\\.tn|com\\.ec|conf\\.au|dk\\.org|shizuoka\\.jp|ac\\.vn|matsuyama\\.jp|agro\\.pl|yamaguchi\\.jp|edu\\.vn|yamanashi\\.jp|mil\\.in|sos\\.pl|bj\\.cn|net\\.au|ac\\.ae|psi\\.br|sch\\.ng|org\\.mt|edu\\.ai|edu\\.ck|ac\\.yu|org\\.ws|org\\.ng|rel\\.pl|uk\\.tt|com\\.py|aomori\\.jp|co\\.ug|video\\.hu|net\\.gg|org\\.pk|id\\.au|gov\\.zw|mil\\.tr|net\\.tn|org\\.ly|re\\.kr|mil\\.ye|mil\\.do|com\\.bb|net\\.vi|edu\\.na|co\\.za|asso\\.re|nom\\.pe|edu\\.tw|name\\.et|jl\\.cn|gov\\.ye|ehime\\.jp|miyazaki\\.jp|kanagawa\\.jp|gov\\.au|nm\\.cn|he\\.cn|edu\\.sd|mod\\.om|web\\.ve|edu\\.hk|medecin\\.fr|org\\.cu|info\\.au|edu\\.ve|nx\\.cn|alderney\\.gg|net\\.cu|org\\.za|mb\\.ca|com\\.ye|edu\\.pa|fed\\.us|ac\\.pa|alt\\.na|mil\\.lv|fukuoka\\.jp|gen\\.in|gr\\.jp|gov\\.br|gov\\.ac|id\\.fj|fukui\\.jp|hu\\.com|org\\.gu|net\\.ae|mil\\.ph|ltd\\.je|alt\\.za|gov\\.np|edu\\.jo|net\\.gu|g12\\.br|org\\.tn|store\\.co|fin\\.tn|ac\\.nz|gouv\\.fr|gov\\.il|org\\.ua|org\\.do|org\\.fj|sci\\.eg|gov\\.tt|cci\\.fr|tokyo\\.jp|net\\.lv|gov\\.lc|ind\\.br|ca\\.tt|gos\\.pk|hi\\.cn|net\\.do|co\\.tv|web\\.co|com\\.pa|com\\.ng|ac\\.ma|gov\\.bh|org\\.zw|csiro\\.au|lakas\\.hu|gob\\.ni|gov\\.fk|org\\.sy|gov\\.lb|gov\\.je|ed\\.cr|nb\\.ca|net\\.uy|com\\.ua|media\\.hu|com\\.lb|nom\\.pl|org\\.br|hk\\.cn|co\\.hu|org\\.my|gov\\.dz|sld\\.pa|gob\\.pk|net\\.uk|guernsey\\.gg|nara\\.jp|telememo\\.au|k12\\.tr|org\\.nz|pub\\.sa|edu\\.ac|com\\.dz|edu\\.lv|edu\\.pk|com\\.ph|net\\.na|net\\.et|id\\.lv|au\\.com|ac\\.ng|com\\.my|net\\.cy|unam\\.na|nom\\.za|net\\.np|info\\.pl|priv\\.hu|rec\\.ve|ac\\.uk|edu\\.mm|go\\.ug|ac\\.ug|co\\.dk|net\\.tt|oita\\.jp|fi\\.cr|org\\.ac|aichi\\.jp|org\\.tt|edu\\.bh|us\\.com|ac\\.kr|js\\.cn|edu\\.ni|com\\.mt|fam\\.pk|experts-comptables\\.fr|or\\.kr|org\\.au|web\\.pk|mil\\.jo|biz\\.pl|org\\.np|city\\.hu|org\\.uy|auto\\.pl|aid\\.pl|bib\\.ve|mo\\.cn|br\\.com|dns\\.be|sh\\.cn|org\\.mo|com\\.sg|me\\.uk|gov\\.kw|eun\\.eg|kagoshima\\.jp|ln\\.cn|seoul\\.kr|school\\.fj|com\\.mk|e164\\.arpa|rnu\\.tn|pro\\.ae|org\\.om|gov\\.my|net\\.ye|gov\\.do|co\\.im|org\\.lb|plc\\.co\\.im|net\\.jp|go\\.id|net\\.tw|gov\\.ai|tlf\\.nr|ac\\.im|com\\.do|net\\.py|tozsde\\.hu|com\\.na|tottori\\.jp|net\\.ge|gov\\.cn|org\\.bb|net\\.bs|ac\\.za|rns\\.tn|biz\\.pk|gov\\.ge|org\\.uk|org\\.fk|nhs\\.uk|net\\.bh|tm\\.za|co\\.nz|gov\\.jp|jogasz\\.hu|shop\\.pl|media\\.pl|chiba\\.jp|city\\.za|org\\.ck|net\\.id|com\\.ar|gon\\.pk|gov\\.om|idf\\.il|net\\.cn|prd\\.fr|co\\.in|or\\.ug|red\\.sv|edu\\.lb|k12\\.ec|gx\\.cn|net\\.nz|info\\.hu|ac\\.zw|info\\.tt|com\\.ws|org\\.gg|com\\.et|ac\\.jp|ac\\.at|avocat\\.fr|org\\.ph|sark\\.gg|org\\.ve|tm\\.pl|net\\.pg|gov\\.co|com\\.lc|film\\.hu|ishikawa\\.jp|hotel\\.hu|hl\\.cn|edu\\.ge|com\\.bm|ac\\.om|tec\\.ve|edu\\.tr|cq\\.cn|com\\.pk|firm\\.in|inf\\.br|gunma\\.jp|gov\\.tn|oz\\.au|nf\\.ca|akita\\.jp|net\\.sd|tourism\\.pl|net\\.bb|or\\.at|idv\\.tw|dni\\.us|org\\.mx|conf\\.lv|net\\.jo|nic\\.in|info\\.vn|pe\\.kr|tw\\.cn|org\\.eg|ad\\.jp|hb\\.cn|kyonggi\\.kr|bourse\\.za|org\\.sb|gov\\.gg|net\\.br|mil\\.pe|kobe\\.jp|net\\.sa|edu\\.mt|org\\.vn|yokohama\\.jp|net\\.il|ac\\.cr|edu\\.sb|nagano\\.jp|travel\\.pl|gov\\.tr|com\\.sv|co\\.il|rec\\.br|biz\\.om|com\\.mm|com\\.az|org\\.vu|edu\\.ng|com\\.mx|info\\.co|realestate\\.pl|mil\\.sh|yamagata\\.jp|or\\.id|org\\.ae|greta\\.fr|k12\\.il|com\\.tw|gov\\.ve|arts\\.ve|cul\\.na|gov\\.kh|org\\.bm|etc\\.br|or\\.th|ch\\.vu|de\\.tt|ind\\.je|org\\.tw|nom\\.fr|co\\.tt|net\\.lc|intl\\.tn|shiga\\.jp|pvt\\.ge|gov\\.ua|org\\.pe|net\\.kh|co\\.vi|iwi\\.nz|biz\\.vn|gov\\.ck|edu\\.eg|zj\\.cn|press\\.ma|ac\\.in|eu\\.tt|art\\.do|med\\.ec|bbs\\.tr|gov\\.uk|edu\\.ua|eu\\.com|web\\.do|szex\\.hu|mil\\.kh|gen\\.nz|okinawa\\.jp|mob\\.nr|edu\\.ws|edu\\.sv|xj\\.cn|net\\.ru|dk\\.tt|erotika\\.hu|com\\.sh|cn\\.com|edu\\.pl|com\\.nc|org\\.il|arts\\.co|chirurgiens-dentistes\\.fr|net\\.pa|takamatsu\\.jp|net\\.ng|org\\.hu|net\\.in|net\\.vu|gen\\.tr|shop\\.hu|com\\.ae|tokushima\\.jp|za\\.com|gov\\.eg|co\\.jp|uba\\.ar|net\\.my|biz\\.et|art\\.br|ac\\.fk|gob\\.pe|com\\.bs|co\\.ae|de\\.net|net\\.eg|hyogo\\.jp|edunet\\.tn|museum\\.om|nom\\.ve|rnrt\\.tn|hn\\.cn|com\\.fk|edu\\.dz|ne\\.kr|co\\.je|sch\\.uk|priv\\.pl|sp\\.br|net\\.hk|name\\.vn|com\\.sa|edu\\.bm|qc\\.ca|bolt\\.hu|per\\.kh|sn\\.cn|mil\\.id|kagawa\\.jp|utsunomiya\\.jp|erotica\\.hu|gd\\.cn|net\\.tr|edu\\.np|asn\\.au|com\\.gu|ind\\.tn|mil\\.br|net\\.lb|nom\\.co|org\\.la|mil\\.pl|ac\\.il|gov\\.jo|com\\.kw|edu\\.sh|otc\\.au|gmina\\.pl|per\\.sg|gov\\.mo|int\\.ve|news\\.hu|sec\\.ps|ac\\.pg|health\\.vn|sex\\.pl|net\\.nc|qc\\.com|idv\\.hk|org\\.hk|gok\\.pk|com\\.ac|tochigi\\.jp|gsm\\.pl|law\\.za|pro\\.vn|edu\\.pe|info\\.et|sch\\.gg|com\\.vn|gov\\.bm|com\\.cn|mod\\.uk|gov\\.ps|toyama\\.jp|gv\\.at|yk\\.ca|org\\.et|suli\\.hu|edu\\.my|org\\.mm|co\\.yu|int\\.ar|pe\\.ca|tm\\.hu|net\\.sb|org\\.yu|com\\.ru|com\\.pe|edu\\.kh|edu\\.kw|org\\.qa|med\\.om|net\\.ws|org\\.in|turystyka\\.pl|store\\.ve|org\\.bs|mil\\.uy|net\\.ar|iwate\\.jp|org\\.nc|us\\.tt|gov\\.sh|nom\\.fk|go\\.th|gov\\.ec|com\\.br|edu\\.do|gov\\.ng|pro\\.tt|sapporo\\.jp|net\\.ua|tm\\.fr|com\\.lv|com\\.mo|edu\\.uk|fin\\.ec|edu\\.ps|ru\\.com|edu\\.ec|ac\\.fj|net\\.mm|veterinaire\\.fr|nom\\.re|ingatlan\\.hu|fr\\.vu|ne\\.jp|int\\.co|gov\\.cy|org\\.lv|de\\.com|nagasaki\\.jp|com\\.sb|gov\\.za|org\\.lc|com\\.fj|ind\\.in|or\\.cr|sc\\.cn|chambagri\\.fr|or\\.jp|forum\\.hu|tmp\\.br|reklam\\.hu|gob\\.sv|com\\.pl|saitama\\.jp|name\\.tt|niigata\\.jp|sklep\\.pl|nom\\.ni|co\\.ma|net\\.la|co\\.om|pharmacien\\.fr|port\\.fr|mil\\.gu|au\\.tt|edu\\.gu|ngo\\.ph|com\\.ve|ac\\.th|gov\\.fj|barreau\\.fr|net\\.ac|ac\\.je|org\\.kw|sport\\.hu|ac\\.cn|net\\.bm|ibaraki\\.jp|tel\\.no|org\\.cy|edu\\.mo|gb\\.net|kyoto\\.jp|sch\\.sa|com\\.au|edu\\.lc|fax\\.nr|gov\\.mm|it\\.tt|org\\.jo|nat\\.tn|mil\\.ve|be\\.tt|org\\.az|rec\\.co|co\\.ve|gifu\\.jp|net\\.th|hokkaido\\.jp|ac\\.gg|go\\.kr|edu\\.ye|qh\\.cn|ab\\.ca|org\\.cn|no\\.com|co\\.uk|gov\\.gu|de\\.vu|miasta\\.pl|kawasaki\\.jp|co\\.cr|miyagi\\.jp|org\\.jp|osaka\\.jp|web\\.za|net\\.za|gov\\.pk|gov\\.vn|agrar\\.hu|asn\\.lv|org\\.sv|net\\.sh|org\\.sa|org\\.dz|assedic\\.fr|com\\.sy|net\\.ph|mil\\.ge|es\\.tt|mobile\\.nr|co\\.kr|ltd\\.uk|ac\\.be|fgov\\.be|geek\\.nz|ind\\.gg|net\\.mt|maori\\.nz|ens\\.tn|edu\\.py|gov\\.sd|gov\\.qa|nt\\.ca|com\\.pg|org\\.kh|pc\\.pl|com\\.eg|net\\.ly|se\\.com|gb\\.com|edu\\.ar|sch\\.je|mil\\.ac|mil\\.ar|okayama\\.jp|gov\\.sg|ac\\.id|co\\.id|com\\.ly|huissier-justice\\.fr|nic\\.im|gov\\.lv|nu\\.ca|org\\.sg|com\\.kh|org\\.vi|sa\\.cr|lg\\.jp|ns\\.ca|edu\\.co|gov\\.im|edu\\.om|net\\.dz|org\\.pl|pp\\.ru|tm\\.mt|org\\.ar|co\\.gg|org\\.im|edu\\.qa|org\\.py|edu\\.uy|targi\\.pl|com\\.ge|gub\\.uy|gov\\.ar|ltd\\.gg|fr\\.tt|net\\.qa|com\\.np|ass\\.dz|se\\.tt|com\\.ai|org\\.ma|plo\\.ps|co\\.at|med\\.sa|net\\.sg|kanazawa\\.jp|com\\.fr|school\\.za|net\\.pl|ngo\\.za|net\\.sy|ed\\.jp|org\\.na|net\\.ma|asso\\.fr|police\\.uk|powiat\\.pl|govt\\.nz|sk\\.ca|tj\\.cn|mil\\.ec|com\\.jo|net\\.mo|notaires\\.fr|avoues\\.fr|aeroport\\.fr|yn\\.cn|gov\\.et|gov\\.sa|gov\\.ae|com\\.tt|art\\.dz|firm\\.ve|com\\.sd|school\\.nz|edu\\.et|gob\\.pa|telecom\\.na|ac\\.cy|gz\\.cn|net\\.kw|mobil\\.nr|nic\\.uk|co\\.th|com\\.vu|com\\.re|belgie\\.be|nl\\.ca|uk\\.com|com\\.om|utazas\\.hu|presse\\.fr|co\\.ck|xz\\.cn|org\\.tr|mil\\.co|edu\\.cn|net\\.ec|on\\.ca|konyvelo\\.hu|gop\\.pk|net\\.om|info\\.ve|com\\.ni|sa\\.com|com\\.tr|sch\\.sd|fukushima\\.jp|tel\\.nr|atm\\.pl|kitakyushu\\.jp|com\\.qa|firm\\.co|edu\\.tt|games\\.hu|mil\\.nz|cri\\.nz|net\\.az|org\\.ge|mie\\.jp|net\\.mx|sch\\.ae|nieruchomosci\\.pl|int\\.vn|edu\\.za|com\\.cy|wakayama\\.jp|gov\\.hk|org\\.pa|edu\\.au|gov\\.in|pro\\.om|2000\\.hu|szkola\\.pl|shimane\\.jp|co\\.zw|gove\\.tw|com\\.co|net\\.ck|net\\.pk|net\\.ve|org\\.ru|uk\\.net|org\\.co|uu\\.mt|com\\.cu|mil\\.za|plc\\.uk|lkd\\.co\\.im|gs\\.cn|sex\\.hu|net\\.je|kumamoto\\.jp|mil\\.lb|edu\\.yu|gov\\.ws|sendai\\.jp|eu\\.org|ah\\.cn|net\\.vn|gov\\.sb|net\\.pe|nagoya\\.jp|geometre-expert\\.fr|net\\.fk|biz\\.tt|org\\.sh|edu\\.sa|saga\\.jp|sx\\.cn|org\\.je|org\\.ye|muni\\.il|kochi\\.jp|com\\.bh|org\\.ec|priv\\.at|gov\\.sy|org\\.ni|casino\\.hu|res\\.in|uy\\.com)"

      // insert it
      res = tldRes[1] + tldStr + tldRes[3];
    }
    return new RegExp(res + '$', "i");
  },

  _getBaseDomain : function(aUri) {
    try {
      return this._tld.getBaseDomain(aUri.QueryInterface(Ci.nsIURL));
    }
    catch(e) {
      // Just use the host
      return aUri.host;
    }
  },

  _isLinkExternal : function(aLink) {
    var isExternal;
    if ((aLink instanceof HTMLAnchorElement) && (aLink.target == "_self" || aLink.target == "_top")) {
      isExternal = false;
    }
    else {
      isExternal = this._isURIExternal(this._ios.newURI(aLink.href, null, null));
    }
    return isExternal;
  },

  _isURIExternal : function(aURI) {
    // Links from our host are always internal
    if (aURI.host == this._uri.host)
      return false;

    // Check whether URI is explicitly included
    if (WebRunner.WebAppProperties.include) {
      var includes = WebRunner.WebAppProperties.include.split(",");
      if (includes.some(function(pattern) { return this._convert2RegExp(pattern).test(aURI.host); }, this)) {
        return false;
      }
    }

    // Check whether URI is explicitly excluded
    if (WebRunner.WebAppProperties.exclude) {
      var excludes = WebRunner.WebAppProperties.exclude.split(",");
      if (excludes.some(function(pattern) { return this._convert2RegExp(pattern).test(aURI.host); }, this)) {
        return true;
      }
    }

    var linkDomain = this._getBaseDomain(aURI);
    // Can't use browser.currentURI since it causes reentrancy into the docshell.
    if (linkDomain == this._currentDomain)
      return false;
    else
      return true;
  },

  _loadExternalURI : function(aURI) {
    var extps = Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(Ci.nsIExternalProtocolService);
    extps.loadURI(aURI, null);
  },

  _domClick : function(aEvent)
  {
    var link = aEvent.target;

    if ((link.href != undefined) && this._isLinkExternal(link)) {
      aEvent.stopPropagation();
    }
  },

  _domActivate : function(aEvent)
  {
    var link = aEvent.target;

    if ((link.href != undefined) && this._isLinkExternal(link)) {
      // We don't want to open external links in this process: do so in the
      // default browser.
      var resolvedURI = this._ios.newURI(link.href, null, null);

      this._loadExternalURI(resolvedURI);

      aEvent.preventDefault();
      aEvent.stopPropagation();
    }
  },

  _prepareWebAppScript : function()
  {
    WebRunner.WebAppProperties.script["XMLHttpRequest"] = Components.Constructor("@mozilla.org/xmlextras/xmlhttprequest;1");
    WebRunner.WebAppProperties.script["window"] = gBrowser.contentWindow.wrappedJSObject;
    WebRunner.WebAppProperties.script["properties"] = WebRunner.WebAppProperties;
  },

  _cleanupWebAppScript : function()
  {
    WebRunner.WebAppProperties.script["XMLHttpRequest"] = null;
    WebRunner.WebAppProperties.script["window"] = null;
    WebRunner.WebAppProperties.script["properties"] = null;
  },

  startup : function(event)
  {
    if (!WebRunner.WebAppProperties.isWebApp) {
      return;
    }

    this._ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    this._tld = Cc["@mozilla.org/network/effective-tld-service;1"].getService(Ci.nsIEffectiveTLDService);

    // Configure the window's chrome
    this._processConfig();

    var self = this;

    // Remember the base domain of the web app
    var uriFixup = Cc["@mozilla.org/docshell/urifixup;1"].getService(Ci.nsIURIFixup);
    this._uri = uriFixup.createFixupURI(WebRunner.WebAppProperties.uri, Ci.nsIURIFixup.FIXUP_FLAG_NONE);
    try {
      this._currentDomain = this._getBaseDomain(this._uri);
    }
    catch(e) {
      // Doesn't have a domain (e.g. IP address)
      this._currentDomain = "";
    }

    var browser = gBrowser;
    browser.addEventListener("DOMTitleChanged", function(aEvent) { self._domTitleChanged(aEvent); }, false);
    browser.webProgress.addProgressListener(this, Ci.nsIWebProgress.NOTIFY_STATE_ALL);

    if (WebRunner.WebAppProperties.initialized) {
      // Not the main window, so we're done
      return;
    }

    // Default the name of the window to the webapp name
    document.title = WebRunner.WebAppProperties.name;

    var prefs = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);

    // Add handlers for the main page
    window.addEventListener("unload", function() { self.shutdown(); }, false);
//@line 353 "/home/hudson/workdir/mozilla/trunk_src/extensions/webrunner/chrome/content/webrunner.js"

    // Hack to get the mime handler initialized correctly so the content handler dialog doesn't appear
    var hs = Cc["@mozilla.org/uriloader/handler-service;1"].getService(Ci.nsIHandlerService);
    var extps = Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(Ci.nsIExternalProtocolService);

    this._xulWindow = window.QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIWebNavigation)
        .QueryInterface(Ci.nsIDocShellTreeItem)
        .treeOwner
        .QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIXULWindow);

//@line 371 "/home/hudson/workdir/mozilla/trunk_src/extensions/webrunner/chrome/content/webrunner.js"

    window.addEventListener("close", function(event) {
      if (!self._handleWindowClose(event)) {
        event.preventDefault();
      }
    }, false);

    // Register ourselves as the default window creator so we can control handling of external links
    this._windowCreator = Cc["@mozilla.org/toolkit/app-startup;1"].getService(Ci.nsIWindowCreator);
    var windowWatcher = Cc["@mozilla.org/embedcomp/window-watcher;1"].getService(Ci.nsIWindowWatcher);
    windowWatcher.setWindowCreator(this);

    // Register observer for quit-application-requested so we can handle shutdown (needed for OS X
    // dock Quit menu item, for example).
    var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
    observerService.addObserver(this, "quit-application-requested", false);
    observerService.addObserver(this, "session-save", false);

    WebRunner.WebAppProperties.initialized = true;
    setTimeout(function() { self._delayedStartup(); }, 0);
  },

  showTrayIcon : function() {
    var appIcon = WebRunner.WebAppProperties.getAppRoot();
    appIcon.append("icons");
    appIcon.append("default");
    appIcon.append(WebRunner.WebAppProperties.icon + ".ico");

    var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    var iconUri = ioService.newFileURI(appIcon);

    var desktop = Cc["@mozilla.org/desktop-environment;1"].getService(Ci.nsIDesktopEnvironment);
    var icon = desktop.applicationIcon;
    icon.title = document.title;
    icon.imageSpec = iconUri.spec;
    icon.show();
  },

  showSplashScreen : function() {
    // Display the splash screen, if any
    if (WebRunner.WebAppProperties.splashscreen) {
      var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
      var splashFile = WebRunner.WebAppProperties.getAppRoot();
      splashFile.append(WebRunner.WebAppProperties.splashscreen);
      var splashUri = ioService.newFileURI(splashFile);
      gBrowser.selectedBrowser.setAttribute("src", splashUri.spec);
    }
  },

  shutdownQuery : function() {
    if (WebRunner.WebAppProperties.script.shutdown && !WebRunner.WebAppProperties.script.shutdown()) {
      return false;
    }
    this._cleanupWebAppScript();

    return true;
  },

  shutdown : function()
  {
    if (WebRunner.WebAppProperties.trayicon) {
      var desktop = Cc["@mozilla.org/desktop-environment;1"].getService(Ci.nsIDesktopEnvironment);
      var icon = desktop.applicationIcon;
      icon.hide();
    }
  },

  tryClose : function()
  {
    var contentViewer = this._xulWindow.docShell.contentViewer;
    if (contentViewer && !contentViewer.permitUnload()) {
      return false;
    }
  },

  onMinimizing : function(event)
  {
    var desktop = Cc["@mozilla.org/desktop-environment;1"].getService(Ci.nsIDesktopEnvironment);
    var icon = desktop.applicationIcon;
    if (icon.behavior & Ci.nsIApplicationIcon.HIDE_ON_MINIMIZE) {
      this._xulWindow.QueryInterface(Ci.nsIBaseWindow).visibility = false;
    }
    this._minimizedState = window.windowState;
  },

  onClosing : function(event)
  {
    var desktop = Cc["@mozilla.org/desktop-environment;1"].getService(Ci.nsIDesktopEnvironment);
    var icon = desktop.applicationIcon;
    if (icon.behavior & Ci.nsIApplicationIcon.HIDE_ON_CLOSE) {
      this._xulWindow.QueryInterface(Ci.nsIBaseWindow).visibility = false;
      event.preventDefault();
    }
  },

  onActivate : function(event)
  {
    this._xulWindow.QueryInterface(Ci.nsIBaseWindow).visibility = true;

    var chromeWindow = window.QueryInterface(Ci.nsIDOMChromeWindow);
    if (chromeWindow.windowState == chromeWindow.STATE_MINIMIZED) {
      if (this._minimizedState == chromeWindow.STATE_MAXIMIZED) {
        chromeWindow.maximize();
      }
      else {
        chromeWindow.restore();
      }

      this._minimizedState = 0;
    }

    var desktop = Cc["@mozilla.org/desktop-environment;1"].getService(Ci.nsIDesktopEnvironment);
    desktop.setZLevel(window, Ci.nsIDesktopEnvironment.zLevelTop);
  },

  doCommand : function(aCmd) {
    if (aCmd == "cmd_aboutConfig") {
      var prefs = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
      var confEnabled = prefs.getBoolPref("webrunner.shortcut.aboutConfig.enabled");
      if (confEnabled) {
        if (gBrowser.contentWindow.location.href != "about:config") {
          gBrowser.loadURI("about:config", null, null);
        }
        else {
          gBrowser.loadURI(WebRunner.WebAppProperties.uri, null, null);
        }
      }
    }
  },

  attachDocument : function(aDocument) {
    var self = this;

    if (!this._clickHandler) {
      this._clickHandler = { handleEvent: function(e) { self._domClick(e); }}
    }
    if (!this._activateHandler) {
      this._activateHandler = { handleEvent : function(e) { self._domActivate(e); }}
    }

    try {
      // Remove handlers in case we already added them to this document
      aDocument.removeEventListener("click", this._clickHandler, true);
      aDocument.removeEventListener("DOMActivate", this._activateHandler, true);
    }
    catch(e) {
      // Just ignore if we can't remove the event listeners since that probably means the document has just been created
    }

    aDocument.addEventListener("click", this._clickHandler, true);
    aDocument.addEventListener("DOMActivate", this._activateHandler, true);
  },

  // This method is called to indicate state changes.
  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
    if (aStateFlags & Ci.nsIWebProgressListener.STATE_IS_DOCUMENT) {
      if (aStateFlags & Ci.nsIWebProgressListener.STATE_START) {
        this._loadError = false;
      }
      else if (aStateFlags & Ci.nsIWebProgressListener.STATE_STOP) {
        var domDocument = aWebProgress.DOMWindow.document;
        this.attachDocument(domDocument);

        if (aWebProgress.DOMWindow == gBrowser.contentWindow) {
          if (aStatus != Components.results.NS_OK) {
            this._loadError = true;
          }
        }
      }
    }
  },

  createChromeWindow : function(parent, chromeFlags) {
    // Always use the app runner implementation
    return this._windowCreator.createChromeWindow(parent, chromeFlags);
  },

  createChromeWindow2 : function(parent, chromeFlags, contextFlags, uri, cancel) {
    if (uri && (uri.scheme != "chrome") && this._isURIExternal(uri)) {
      // Use default app to open external URIs
      this._loadExternalURI(uri);
      cancel.value = true;
    }
    else {
      return this._windowCreator.QueryInterface(Ci.nsIWindowCreator2).
        createChromeWindow2(parent, chromeFlags, contextFlags, uri, cancel);
    }
  },

  observe : function(aSubject, aTopic, aData) {
    if (aTopic == "quit-application-requested") {
      if (!this.shutdownQuery()) {
        aSubject.QueryInterface(Ci.nsISupportsPRBool).data = true;
        return;
      }

      var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
      observerService.removeObserver(this, "quit-application-requested");
    }
    else if (aTopic == "session-save") {
      aSubject.QueryInterface(Ci.nsISupportsPRBool).data = this.shutdownQuery();
    }
  },

  // We need to advertize that we support weak references.  This is done simply
  // by saying that we QI to nsISupportsWeakReference.  XPConnect will take
  // care of actually implementing that interface on our behalf.
  QueryInterface: function(aIID) {
    if (aIID.equals(Ci.nsIWebProgressListener) ||
        aIID.equals(Ci.nsISupportsWeakReference) ||
        //aIID.equals(Ci.nsIXULBrowserWindow) ||
        aIID.equals(Ci.nsIWindowCreator) ||
        aIID.equals(Ci.nsIWindowCreator2) ||
        aIID.equals(Ci.nsIObserver) ||
        aIID.equals(Ci.nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};

WebRunner.Overlay.showSplashScreen();
