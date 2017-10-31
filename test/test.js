
var assert = require('assert');
var fs = require('fs');

const Discord = require('discord.js');
const client = new Discord.Client();

var main_settings_filename = 'test/settings.json';
var settings = {} ;

process.on('uncaughtException', function (exception) {
  console.log(exception); // to see your exception details in the console
  // if you are on production, maybe you can send the exception details to your
  // email as well ?
});

describe("bot tests", () => {

    before(startup);

    describe('Timerbot tester loaded', function() {
        it ('should be connected to discord', async() => {
            assert.ifError(client.readyTimestamp);
        });
    });

    describe('Array', function() {
        describe('#indexOf()', function() {
            it('should return -1 when the value is not present', function() {
                assert.equal(-1, [1,2,3].indexOf(4));
            });
        });
    });


});




function startup() {
    var a = new Promise( loadSettings);
    a.then(() => { client.login(settings.token); });
    a.then(() => {
            client.on('ready', () => {
                console.log("I am alive!");
                console.log(client.readyAt);
            })
    });
}

// Load settings
function loadSettings(resolve, reject) {
    fs.readFile(main_settings_filename, 'utf8', (err, data) => {
        if (err) {
            console.log(err);
            reject();
            return;
        }
        settings = JSON.parse(data);
        resolve();
    });
}
