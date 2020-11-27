exports.getObjectValue = function (o, s) {
  try {
    s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
    s = s.replace(/^\./, '');           // strip a leading dot
    let a = s.split('.');
    for (let i = 0, n = a.length; i < n; ++i) {
      let k = a[i];
      if (k in o) {
        o = o[k];
      } else {
        return;
      }
    }
    return o;
  } catch (e) {
  }
}

exports.isValidNumber = function (number, strict = true) {
  if (typeof number !== 'number' && typeof number !== 'string') {
    return false;
  }

  if (strict) {
    return typeof number === 'number' && isFinite(number);
  } else {
    number = parseFloat(number);
    return !isNaN(number) && isFinite(number);
  }
}