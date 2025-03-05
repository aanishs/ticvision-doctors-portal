const { getDataConnect, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'default',
  service: 'ticvision-doctor-portal',
  location: 'us-west1'
};
exports.connectorConfig = connectorConfig;

