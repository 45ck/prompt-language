const { ConfigV1 } = require('./config-v1');
const fs = require('fs');

const config = new ConfigV1();

// Initialize with default config
function initApp(configPath) {
  return new Promise((resolve, reject) => {
    config.load(configPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      config.get('appName', (err, name) => {
        if (err) {
          reject(err);
          return;
        }
        console.log(`Starting ${name}`);
        resolve(config);
      });
    });
  });
}

function getPort() {
  return new Promise((resolve, reject) => {
    config.get('port', (err, port) => {
      if (err) {
        resolve(3000); // default
      } else {
        resolve(port);
      }
    });
  });
}

function updateSetting(key, value) {
  return new Promise((resolve, reject) => {
    config.set(key, value, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function saveConfig(path) {
  return new Promise((resolve, reject) => {
    config.save(path, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function listSettings() {
  const all = config.getAll();
  return Object.entries(all).map(([k, v]) => `${k}=${v}`);
}

// Smoke test
const testConfig = { appName: 'TestApp', port: 8080, debug: false };
fs.writeFileSync('test-config.json', JSON.stringify(testConfig));

initApp('test-config.json')
  .then(() => getPort())
  .then((port) => {
    console.log(`Port: ${port}`);
    return updateSetting('debug', true);
  })
  .then(() => {
    const settings = listSettings();
    console.log(`Settings: ${settings.join(', ')}`);
    return saveConfig('test-config.json');
  })
  .then(() => {
    fs.unlinkSync('test-config.json');
    console.log('App initialized successfully');
  })
  .catch((err) => {
    try {
      fs.unlinkSync('test-config.json');
    } catch {}
    console.error('Failed:', err.message);
    process.exit(1);
  });

module.exports = { initApp, getPort, updateSetting, saveConfig, listSettings };
