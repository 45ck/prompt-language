const { ConfigV1 } = require('./config-v1');

// Settings page handler — also uses v1 API
function renderSettings(config) {
  const all = config.getAll();
  const lines = [];
  for (const [key, value] of Object.entries(all)) {
    lines.push(`${key}: ${JSON.stringify(value)}`);
  }
  return lines.join('\n');
}

function updateBulkSettings(config, updates, callback) {
  const keys = Object.keys(updates);
  let index = 0;

  function next() {
    if (index >= keys.length) {
      callback(null);
      return;
    }
    const key = keys[index++];
    config.set(key, updates[key], (err) => {
      if (err) {
        callback(err);
        return;
      }
      next();
    });
  }

  next();
}

function readSetting(config, key, callback) {
  config.get(key, (err, value) => {
    if (err) {
      callback(null, `(default for ${key})`);
    } else {
      callback(null, value);
    }
  });
}

module.exports = { renderSettings, updateBulkSettings, readSetting };
