#!/usr/bin/env node

const pkg = require('./package.json');
const log = require('yalm');
const config = require('yargs')
    .env('OWRTWIFIHELPER')
    .usage(pkg.name + ' ' + pkg.version + '\n' + pkg.description + '\n\nUsage: $0 [options]')
    .describe('verbosity', 'possible values: "error", "warn", "info", "debug"')
    .describe('name', 'instance name. used as mqtt client id and as prefix for connected topic')
    .describe('mqtt-url', 'mqtt broker url. See https://github.com/mqttjs/MQTT.js#connect-using-a-url')
    .describe('owrtwifi-prefix', 'mqtt prefix of owrtwifi')
    .describe('owrtwifi-timeout', 'timeout for lastseen detection')
    .alias({
        h: 'help',
        m: 'mqtt-url',
        v: 'verbosity'
    })
    .default({
        name: 'owrtwifihelper',
        'mqtt-url': 'mqtt://127.0.0.1',
        'owrtwifi-prefix': 'owrtwifi',
        'owrtwifi-timeout': 300
    })
    .version()
    .help('help')
    .argv;
const MqttSmarthome = require('mqtt-smarthome-connect');
const Timer = require('yetanothertimerlibrary');

log.setLevel(config.verbosity);
log.info(pkg.name + ' ' + pkg.version + ' starting');
log.debug("loaded config: ", config);

var wifiDevices = {};

log.info('mqtt trying to connect', config.mqttUrl);
const mqtt = new MqttSmarthome(config.mqttUrl, {
    logger: log,
    will: {topic: config.name + '/connected', payload: '0', retain: true}
});
mqtt.connect();

mqtt.on('connect', () => {
    log.info('mqtt connected', config.mqttUrl);
    mqtt.publish(config.name + '/connected', '1', {retain: true});
});

mqtt.subscribe(config.owrtwifiPrefix + '/status/+/lastseen/epoch', (topic, message, wildcard) => {
    let mac = wildcard[0];
    createTimeout(mac);
    
    wifiDevices[mac].timer.reset().timeout(config.owrtwifiTimeout * 1000);
    mqtt.publish(config.name + '/status/' + mac, true);
});
mqtt.subscribe(config.owrtwifiPrefix + '/status/+/event', (topic, message, wildcard) => {
    let mac = wildcard[0];

    if (message == 'new') {
        createTimeout(mac);
        mqtt.publish(config.name + '/status/' + mac, true);
    }
});

function createTimeout(mac) {
    if (!(mac in wifiDevices)) {
        wifiDevices[mac] = {};
        wifiDevices[mac].timer = new Timer(() => {
            mqtt.publish(config.name + '/status/' + mac, false);
        }).timeout(config.owrtwifiTimeout * 1000);
    }
}
