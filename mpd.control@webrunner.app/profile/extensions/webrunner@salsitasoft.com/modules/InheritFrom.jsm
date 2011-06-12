
EXPORTED_SYMBOLS = ["InheritFrom"];

/* Makes inheritance easier. */
var InheritFrom = function(superClass, subClass) {
  function inheritance() { }
  inheritance.prototype = superClass.prototype;

  subClass.prototype = new inheritance();
  subClass.prototype.constructor = subClass;
  subClass.baseConstructor = superClass;
  subClass.prototype.superClass = superClass.prototype;
};

