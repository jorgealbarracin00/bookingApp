const fs = require('fs');

const json = require('./firebase-service-account.json');
const oneLine = JSON.stringify(json);

console.log(oneLine);