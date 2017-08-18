/*
  MHTimer Bot
*/
// Import required modules
const Discord = require('discord.js');
var Timer = require('./timerClass.js');
var fs = require ('fs');
const client = new Discord.Client();

// Globals
// var guild_id = '245584660757872640';
var main_settings_filename = 'settings.json';
var timer_settings_filename = 'timer_settings.json';
var reminder_filename = 'reminders.json';

var timers_list = [];
var reminders = [];
var file_encoding = 'utf8';
var settings = {};

//Only support announcing in 1 channel
var announce_channel;

process.on('uncaughtException', function (exception) {
  console.log(exception); // to see your exception details in the console
  // if you are on production, maybe you can send the exception details to your
  // email as well ?
});

function Main() {
    // Load global settings
    var a = new Promise(loadSettings);

    // Bot log in
    a.then(() => { client.login(settings.token); });

    // Create timers list from timers settings file
    a.then( createTimersList );
    
    // Load any saved reminders
    a.then( loadReminders );

    // Bot start up tasks
    a.then(() => {
        client.on('ready', () => {
            console.log ('I am alive!');
//            announce_channel = client.guilds.get(guild_id).defaultChannel;
            
            //for each guild find its #timers channel (if it has one)
            for (var [guildkey, guildvalue] of client.guilds) {
                for (var [chankey, chanvalue] of guildvalue.channels) {
                    if (chanvalue.name === "timers") {
                        console.log("Found #timers as " + chankey + " on guild " + guildvalue.name);
                        createTimedAnnouncements(chanvalue);
//                        chanvalue.send("Is this thing on?");
                    }
                }
            }
        });
    });
    
    // Message event router
    a.then(() => {
        client.on('message', message => {
            if (message.content.startsWith('-mh ')) {
                messageParse(message);
            }
        });
    });
}
Main();

// Load settings
function loadSettings(resolve, reject) {
    fs.readFile(main_settings_filename, file_encoding, (err, data) => {
        if (err) {
            console.log(err);
            reject();
            return;
        }
        settings = JSON.parse(data);
        resolve();
    });
}

// Read individual timer settings from a file and Create
//function createTimersList(resolve, reject) {
function createTimersList(resolve, reject) {
    fs.readFile(timer_settings_filename, file_encoding, (err, data) => {
        if (err) {
            reject();
            return console.log(err);
        }

        var obj = JSON.parse(data);
        for (var i = 0; i < obj.length; i++ ) {
            timers_list.push(new Timer(obj[i]));
//            console.log('Added ' + i + ' ' + obj[i].area);
        }
    });
}

function createTimedAnnouncements(channel) {
    console.log('Creating timeouts');
    var startDate = new Date();
    var temp_timeout;
    
    for (var i = 0; i < timers_list.length; i++) {
        temp_timeout = setTimeout( 
            (timer, channel) => {
                doAnnounce(timer, channel);
                timer.stopTimeout();
                var temp_timer = setInterval((timer, channel) => {
                    doAnnounce(timer, channel);
                }, timer.getRepeat(), timer, channel);
                timer.setInterval(temp_timer);
//                console.log ("created a repeating timer for every " + repeat_time + " for " + announce);
            },
              (timers_list[i].getNext().valueOf() - timers_list[i].getAnnounceOffset() - startDate.valueOf()),
              timers_list[i],
              channel
        );
        timers_list[i].setTimeout(temp_timeout);
//        console.log(timers_list[i].getAnnounce() + " next happens in " + (timers_list[i].getNext().valueOf() - startDate.valueOf() ) + " ms");
    }
    console.log ("Let's say that " +timers_list.length + " timeouts got created");
}

//The meat of user interaction. Receives the message that starts with the magic character and decides if it knows what to do next
function messageParse(message) {
    var tokens = [];
    tokens = splitString(message.content);
    tokens.shift();
    var command = tokens.shift();
    var timerName; // This has area and sub_area possibly defined
    if (typeof command === 'undefined') {
        message.channel.send("I didn't understand. I know 'next' and 'remind'");
        return;
    } else {
        if (tokens.length >= 1) {
            timerName = timerAliases(tokens);
        } else {
            timerName = {};
        }
    }
    var usage_string;
    switch (command) {
        case 'next':
            //TODO - This should be a PM, probably?
            if ((tokens.length === 0) || (typeof timerName.area === 'undefined')) { 
                message.channel.send("Did you want to know about sg, fg, reset, spill, or cove?"); 
            } else {
                var retStr = nextTimer(timerName);
                if (typeof retStr === "string") {
                    message.channel.send(retStr);
                } else {
                    message.channel.send("", {embed: retStr} );
                }
            }
            // console.log(typeof retStr);
            break;
        case 'remind':
            usage_string = "Usage: `-mh remind <sg|fg|reset|spill|cove> [once|stop|always|<num>]` where once/stop/num/always are optional"; // save this for a help
            if ((tokens.length === 0) || (typeof timerName.area === 'undefined')) {
                listRemind(message);
                // message.channel.send("Did you want me to remind you for sg, fg, reset, spill, or cove?\n" + usage_string);
            } else {
                message.channel.send(addRemind(timerName, message));
            }
            break;
        case 'help':
        case 'arrg':
        default:
            if (tokens.length > 0) {
                if (tokens[0] === 'next') {
                    usage_str = "Usage: `-mh next [area/sub-area]` will provide a message about the next related occurrence.\n";
                    usage_str += "Areas are Seasonal Garden (**sg**), Forbidden Grove (**fg**), Toxic Spill (**ts**), Balack's Cove (**cove**), and the daily **reset**.\n"; 
                    usage_str += "Sub areas are the seasons, open/close, spill ranks, and tide levels\n";
                    usage_str += "Example: `-mh next fall` will tell when it is Autumn in the Seasonal Garden."
                }
                else if (tokens[0] === 'remind') {
                    usage_str = "Usage: `-mh remind [area/sub-area] [<number>/always/stop]` will control my reminder function relating to you specifically.\n";
                    usage_str += "Using the word `stop` will turn off a reminder if it exists.\n";
                    usage_str += "Using a number means I will remind you that many times for that timer.\n";
                    usage_str += "Use the word `always` to have me remind you for every occurrence.\n";
                    usage_str += "Just using `-mh remind` will list all your existing reminders and how to turn off each\n";
                    usage_str += "Areas are Seasonal Garden (**sg**), Forbidden Grove (**fg**), Toxic Spill (**ts**), Balack's Cove (**cove**), and the daily **reset**.\n"; 
                    usage_str += "Sub areas are the seasons, open/close, spill ranks, and tide levels\n";
                    usage_str += "Example: `-mh remind close always` will always PM you 15 minutes before the Forbidden Grove closes.\n";
                }
                else {
                    usage_str = "I can only provide help for `remind` and `next`";
                }
            } else {
                usage_str = "I know the keywords `next` and `remind`. You can use `-mh help [next|remind]` to get specific information.\n";
                usage_str += "Example: `-mh help next` provides help about the 'next' keyword, `-mh help remind` provides help about the 'remind' keyword.";
            }
            message.author.send(usage_str);
    }
}

//Simple utility function to tokenize a string, preserving double quotes
function splitString(inString) {
    var returnArray = [];
    var splitRegexp = /[^\s"]+|"([^"]*)"/gi;
    
    do {
        var match = splitRegexp.exec(inString);
        if (match != null ) {
            returnArray.push(match[1] ? match[1] : match[0]);
        }
    } while (match != null);
    return returnArray;
}

function timerAliases(tokens) {
    var timerQuery = {};
    var timerName;
    for (var i = 0; i < tokens.length; i++) {
        timerName = tokens[i].toLowerCase();
        switch (timerName.toLowerCase()) {
            case 'sg':
            case 'seasonal':
            case 'season':
            case 'garden':
                timerQuery.area = 'sg';
                break;
            case 'fall':
            case 'autumn':
                timerQuery.area = 'sg';
                timerQuery.sub_area = 'autumn';
                break;
            case 'spring':
                timerQuery.area = 'sg';
                timerQuery.sub_area = 'spring';
                break;
            case 'summer':
                timerQuery.area = 'sg';
                timerQuery.sub_area = 'summer';
                break;
            case 'winter':
                timerQuery.area = 'sg';
                timerQuery.sub_area = 'winter';
                break;
            case 'fg':
            case 'grove':
            case 'gate':
            case 'realm':
                timerQuery.area = 'fg';
                break;
            case 'open':
                timerQuery.area = 'fg';
                timerQuery.sub_area = 'open';
                break;
            case 'close':
            case 'closed':
            case 'shut':
                timerQuery.area = 'fg';
                timerQuery.sub_area = 'close';
                break;
            case 'reset':
            case 'game':
            case 'rh':
            case 'midnight':
                timerQuery.area = 'reset';
                break;
            case 'cove':
            case 'balack':
            case 'tide':
                timerQuery.area = 'cove';
                break;
            case 'lowtide':
            case 'low':
                timerQuery.area = 'cove';
                timerQuery.sub_area = 'low';
                break;
            case 'midtide':
            case 'mid':
                timerQuery.area = 'cove';
                timerQuery.sub_area = 'mid';
                break;
            case 'hightide':
            case 'high':
                timerQuery.area = 'cove';
                timerQuery.sub_area = 'high';
                break;
            case 'spill':
            case 'toxic':
            case 'ts':
                timerQuery.area = 'spill';
                break;
            case 'archduke':
            case 'ad':
            case 'archduchess':
            case 'aardwolf':
            case 'arch':
                timerQuery.area = 'spill';
                timerQuery.sub_area = 'arch';
                break;
            case 'grandduke':
            case 'gd':
            case 'grandduchess':
            case 'grand':
                timerQuery.area = 'spill';
                timerQuery.sub_area = 'grand';
                break;
            case 'duchess':
            case 'duke':
                timerQuery.area = 'spill';
                timerQuery.sub_area = 'duke';
                break;
            case 'countess':
            case 'count':
                timerQuery.area = 'spill';
                timerQuery.sub_area = 'count';
                break;
            case 'baronness':
            case 'baron':
                timerQuery.area = 'spill';
                timerQuery.sub_area = 'baron';
                break;
            case 'lady':
            case 'lord':
                timerQuery.area = 'spill';
                timerQuery.sub_area = 'lord';
                break;
            case 'heroine':
            case 'hero':
                timerQuery.area = 'spill';
                timerQuery.sub_area = 'hero';
                break;
            case 'once':
            case '1':
            case 1:
                timerQuery.count = 1;
                break;
            case 'always':
            case 'forever':
            case 'unlimited':
            case '-1':
            case -1:
                timerQuery.count = -1;
                break;
            case 'stop':
            case '0':
            case 0:
                timerQuery.count = 0;
                break;
            default:
                if (!isNaN(parseInt(timerName))) {
                    timerQuery.count = parseInt(timerName);
                }
                break;
        }
    }
    return timerQuery;
}

//Returns the next occurrence of the class of timers
//TODO - this should take an array as an argument and process the words passed in
function nextTimer(timerName) {
    var retStr = "I do not know that timer but I do know: sg, fg, reset, spill, cove and their sub-areas";
    var youngTimer;

    for (var timer of timers_list) {
        if (timer.getArea() === timerName.area) {
            if ((typeof timerName.sub_area === 'undefined') || (timerName.sub_area === timer.getSubArea())) {
                if ((typeof youngTimer === 'undefined') || (timer.getNext() <= youngTimer.getNext())) {
                    youngTimer = timer;
                }
            }
        }
    }

    if (typeof youngTimer == 'undefined') {
        return retStr;
    } else {
        retStr = new Discord.RichEmbed()
//            .setTitle("next " + timerName) // removing this cleaned up the embed a lot
            .setDescription(youngTimer.getDemand() + "\n" + timeLeft(youngTimer.getNext())) // Putting here makes it look nicer and fit in portrait mode
            .setTimestamp(new Date(youngTimer.getNext().valueOf()))
//            .addField(retStr)
            .setFooter("at"); // There has to be something in here or there is no footer
    }
    return retStr;
}

function timeLeft (in_date) {
    var now_date = new Date();
    var retStr = "real soon";
    var ms_left = in_date.valueOf() - now_date.valueOf() ;
    if (ms_left > 1000) {
        retStr = "in ";
        if (ms_left > 1000 * 60 * 60 * 24) {
            //days left
            retStr += Math.floor(ms_left / (1000 * 60 * 60 * 24)) + " days ";
            ms_left = ms_left % (1000 * 60 * 60 * 24);
        }
        if (ms_left > 1000 * 60 * 60) {
            //hours left
            retStr += Math.floor(ms_left / (1000 * 60 * 60)) + " hours ";
            ms_left = ms_left % (1000 * 60 * 60);
        }
        if (ms_left > 1000 * 60) {
            //minutes left
            retStr += Math.floor(ms_left / (1000 * 60)) + " minutes ";
            ms_left = ms_left % (1000 * 60);
        }
        if (ms_left > 1000) {
            //seconds left
            retStr += Math.floor(ms_left / 1000) + " seconds";
        }
    }
    return retStr;
}

function loadReminders() {
    //Read the JSON into the reminders array
    console.log("loading reminders");
    fs.readFile(reminder_filename, file_encoding, (err, data) => {
        if (err) {
            console.log(err);
            return undefined;
        }

        reminders = JSON.parse(data);
        console.log (reminders.length + " reminders loaded");
    });
}

function saveReminders () {
    //Write out the JSON of the reminders array
    var i = reminders.length;
    while (i--) {
        if (reminders[i].count === 0) {
            reminders.splice(i, 1);
        }
    }
    fs.writeFile(reminder_filename, JSON.stringify(reminders, null, 1), file_encoding, (err) => {
        if (err) { 
            reject();
            return console.log(err);
        }
    });
//    console.log("Reminders saved: " + reminders.length);
}

function doAnnounce (timer, channel) {
    //Announce into a channel, then process any reminders
    channel.send(timer.getAnnounce());
    
    doRemind(timer);
}

function doRemind (timer) {
    //Go through the reminder requests and process each
    var usage_str = "";
    for (key in reminders) {
        remind = reminders[key];
//        console.log(JSON.stringify(remind, null, 1));
        if ((timer.getArea() === remind.area) && 
            (remind.count !== 0) &&
            (   (typeof remind.sub_area === 'undefined') ||
                (typeof timer.getSubArea() !== 'undefined') &&
                (timer.getSubArea() === remind.sub_area))
           )
        {
            var user = client.users.get(remind.user);
//            console.log("Got a user of " + typeof user + " when I tried with " + remind.user + " for " + remind.area);
            if (typeof user !== 'object') {
                remind.count = 0;
                continue;
            }
            if (user.presence !== 'dnd') {
                //user.send(timer.getAnnounce());
                usage_str = "You have ";
                if (remind.count < 0) {
                    usage_str += "unlimited";
                } else {
                    usage_str += remind.count;
                }
                usage_str += " reminders left for this timer. Use `-mh remind " + remind.area;
                if (typeof remind.sub_area !== 'undefined') {
                    usage_str += " " + remind.sub_area;
                }
                usage_str += " stop` to end them sooner";
                user.send(timer.getAnnounce() + "\n" + usage_str );
            }
            if (remind.count > 0) {
                remind.count -= 1;
            }
        }
    }
    saveReminders();
}

function addRemind(timerRequest, message) {
    //Add (or remove) a reminder
    var area = timerRequest.area;
    var response_str = "Tell aardwolf what you did. This used to break the bot";
    var sub_area = timerRequest.sub_area;
    var num = timerRequest.count;
    var timer_found = -1;
    var has_sub_area = 0;
    var turned_off = 0;
    
    if (typeof num === 'undefined') {
        num = 1; //new default is once
    }
    
    if (typeof area === 'undefined') {
        return "I do not know the area you asked for";
    }
    
    for (var i = 0; i < timers_list.length; i++) {
        if (timers_list[i].getArea() === area) {
            if (typeof sub_area === 'undefined') {
                timer_found = i;
                has_sub_area = 0;
                break;
            }
            else if (sub_area === timers_list[i].getSubArea()) {
                timer_found = i;
                has_sub_area = 1;
                break;
            }
        }
    }
   
    //confirm it is a valid area
    if (timer_found < 0) {
        for (var i = 0; i < timers_list.length; i++) {
            if (timers_list[i].getArea() === area) {
                timer_found = i;
                has_sub_area = 0;
                console.log ("Apparently this is still needed for '" + area + "'");
                console.log(timerRequest);
                break;
            }
        }
    }
    if (timer_found < 0) {
        return "I do not know the area requested, only sg, fg, reset, spill, or cove";
    } 
    
    if (has_sub_area == 0) {
        sub_area = undefined;
    }
    
    if (num === 0) {
        //This is the stop case
        var i = reminders.length;
        while (i--) {
//        for (var i = 0; i < reminders.length; i++) {
            if ((reminders[i].user === message.author.id) &&
                (reminders[i].area === area))
            {
                if (has_sub_area && 
                    (typeof reminders[i].sub_area !== 'undefined') && 
                    (reminders[i].sub_area === sub_area))
                {
                    reminders[i].count = 0;
                    response_str = "Reminder for " + reminders[i].area + " (" + reminders[i].sub_area + ") turned off ";
                    reminders.splice(i,1);
                    turned_off++;
                }
                else if ((!has_sub_area) && (typeof reminders[i].sub_area === 'undefined')) {
                    reminders[i].count = 0;
                    response_str = "Reminder for " + reminders[i].area + " turned off ";
                    reminders.splice(i,1);
                    turned_off++;
                }
            }
        }
        if (turned_off === 0) {
            response_str = "I couldn't find a reminder for you in " + area;
            if (typeof sub_area !== 'undefined') {
                response_str += " (" + sub_area + ")";
            }
            console.log(timerRequest);
            console.log(has_sub_area);
        } else {
            saveReminders();
        }
        if (typeof response_str === 'undefined') {
            console.log("response_str got undefined");
            console.log(tokens);
            response_str = "That was a close one, I almost crashed!";
        }
        return response_str;
    }// end stop case
                    
    response_str = "";
    var remind = {  "count" : num,
                    "area" : area,
                    "user" : message.author.id
    }
    if (has_sub_area === 1) {
        remind.sub_area = sub_area;
    }
    //Make sure the reminder doesn't already exist
    found = 0;
    for (var i = 0; i < reminders.length; i++) {
        if ((reminders[i].user === message.author.id) &&
            (reminders[i].area === area))
        {
            if ((typeof remind.sub_area === 'undefined') &&
                (typeof reminders[i].sub_area === 'undefined'))
            {
                response_str = "I already have a reminder for " + area + " for you";
                found = 1;
                break;
            }
            else if ((typeof remind.sub_area !== 'undefined') &&
                     (typeof reminders[i].sub_area !== 'undefined') &&
                     (reminders[i].sub_area === remind.sub_area))
            {
                response_str = "I already have a remind for " + area + " (" + remind.sub_area + ") for you";
                found = 1;
                break;
            }
        }
    }
    if (found === 0) {
        reminders.push(remind);
        response_str = "Reminder for " + area
        if (typeof remind.sub_area !== 'undefined') {
            response_str += " (" + remind.sub_area + ")";
        }
        response_str += " set to PM you ";
        if (remind.count === 1) {
            response_str += "once (stop this one and use the word 'always' if you wanted a repeating reminder) ";
        }
        else if (remind.count === -1) {
            response_str += "until you stop it";
        }
        else {
            response_str += remind.count + " times";
        }
    }
    if (typeof response_str === 'undefined') {
        console.log("response_str got undefined");
        console.log(tokens);
        response_str = "That was a close one, I almost crashed!";
    }
    saveReminders();
    return response_str;
}

function listRemind(message) {
    // List the reminders for the user, PM them the result
    var user = message.author.id;
    var pm_channel = message.author;
    var timer_str = "";
    var usage_str;
    var found = 0;
    
    for (var i = 0; i < reminders.length; i++) {
        //console.log ("Checking " + reminders[i].user );
        if (reminders[i].user === user) {
            timer_str += "Timer:    " + reminders[i].area;
            usage_str = "`-mh remind " + reminders[i].area;
            if (typeof reminders[i].sub_area !== 'undefined') {
                timer_str += " (" + reminders[i].sub_area + ")";
                usage_str += " " + reminders[i].sub_area;
            }
            if (reminders[i].count === 1) {
                timer_str += " one more time";
            } 
            else if (reminders[i].count === -1) {
                timer_str += " until you stop it";
            }
            else {
                timer_str += " " + reminders[i].count + " times";
            }
            timer_str += ". " + usage_str + " stop` to turn off\n";
            found++;
        }
    }

    if (found > 0) {
        pm_channel.send(timer_str);
    } else {
        pm_channel.send("I found no reminders for you, sorry");
    }
}

//Resources:
//Timezones in Discord: https://www.reddit.com/r/discordapp/comments/68zkfs/timezone_tag_bot/


