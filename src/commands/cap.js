var _ = require('lodash');

function Cap(str) {
  var cap = /^([-=~]*)?([^=]+)(=(.+))?$/.exec(str);

  return {name : cap[2].toLowerCase(), value : cap[3] ? cap[4] || '' : null};
}

Cap.Wanted = function(name, values, comparator) {
  return {
    name : name.toLowerCase(),
    values : values || [],
    comparator : comparator
  };
};

Cap.matches = function(cap, wanted) {
  if (cap.name !== wanted.name) {
    return false;
  }

  if (cap.value && wanted.values.length > 0) {
    return !!_.find(wanted.values, function(wanted_value) {
      if (wanted.comparator) {
        return wanted.comparator(cap.value, wanted_value);
      } else {
        return cap.value === wanted_value;
      }
    });
  }

  return true;
};

module.exports = Cap;
