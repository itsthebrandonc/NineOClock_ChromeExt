importScripts('timeSync.js');

const MessageType = Object.freeze({
  TEST: "TEST",
  OPEN: "OPEN",
  SYNC: "SYNC",
  REFRESH: "REFRESH",
  SYNCVID: "SYNCVID",
  APISYNC: "APISYNC",
  CHECKSTART: "CHECKSTART",
  CHECKEND: "CHECKEND",
  PORT: "PORT",
  HELLO: "HELLO",
  VIDEND: "VIDEND",
  UDPSETTINGS: "UPDSETTINGS",
  SETSETTINGS: "SETSETTINGS",
  GETSETTINGS: "GETSETTINGS",
  UPDURL: "UPDURL",
  BUFFERPAUSE: "BUFFERPAUSE",
  BUFFERPLAY: "BUFFERPLAY",
  BUFFERMUTE: "BUFFERMUTE",
  VIDLOAD: "VIDLOAD"
  });

var timeTilStart = undefined;
var videoAiring = false;
var videoLength = 0;
var vidURL;
var contentPort;
var portReady = false;
var dataReady1 = false;
var dataReady2 = false;
var clockTimer, portTimer, checkEndTimer, bufferTimer;
var settingAutoSync = true;
var settingEveryDay = true;
var settingAltEnd = false;
var settingSyncFreq = 0.5;
var loadingBuffer = 5;
var bufferAction = "";

function SendMessageToPopup(type,value)
{
    chrome.runtime.sendMessage({
        type: type,
        value: value
    });
}

function SendMessageToContent(type,value)
{
  if (portReady)
  {
    if (vidURL != undefined && contentPort.sender.tab.url != vidURL)
    {
      portReady = false;
      console.log("Disconnecting wrong URL port (1): "+ vidURL + "," + contentPort.sender.tab.url);
      contentPort.disconnect();
    }
    else
    {
      contentPort.postMessage({type: type, value: value});
    }
  }
}

//chrome.runtime.onStartup.addListener( () => {
//  console.log("Nine O' Clock - Startup");
//  setAPISync();
//});

function setAPISync() {
  syncWorldTime();
  chrome.alarms.create(MessageType.APISYNC,{periodInMinutes: 1});
}

function getSettings() {
  settingAutoSync = true;
  settingEveryDay = true;
  settingAltEnd = false;
  settingSyncFreq = 0.5;
  chrome.storage.local.get("NineOClock_Settings", function(result) {
    if (result.NineOClock_Settings != undefined)
    {
      if (result.NineOClock_Settings.autoSync != undefined)
      {
        settingAutoSync = result.NineOClock_Settings.autoSync;
        //console.log("Storage: AutoSync [GET] = " + settingAutoSync);
      }
      if (result.NineOClock_Settings.everyDay != undefined)
      {
        settingEveryDay = result.NineOClock_Settings.everyDay;
        //console.log("Storage: EveryDay [GET] = " + settingEveryDay);
      }
      if (result.NineOClock_Settings.altEnd != undefined)
      {
        settingAltEnd = result.NineOClock_Settings.altEnd;
        //console.log("Storage: AltEnd [GET] = " + settingAltEnd);
      }
      if (result.NineOClock_Settings.syncFreq != undefined)
      {
        settingSyncFreq = result.NineOClock_Settings.syncFreq;
        //console.log("Storage: SyncFreq [GET] = " + settingSyncFreq);
      }
    }
    dataReady1 = true;
  });
}

function setSettings(newAutoSync,newEveryDay,newAltEnd,newSyncFreq) {
  //console.log("Settings : " + newAutoSync + "," + newEveryDay + "," + newAltEnd + "," + newSyncFreq);
  if (newAutoSync == settingAutoSync && newEveryDay == settingEveryDay && newAltEnd == settingAltEnd && newSyncFreq == settingSyncFreq)
    return;

  if (!Number.isNaN(newSyncFreq))
    settingSyncFreq = newSyncFreq;

  settingAutoSync = newAutoSync;
  settingEveryDay = newEveryDay;
  settingAltEnd = newAltEnd;

  console.log("Sending New Auto Sync: " + settingAutoSync);

  if (portReady)
    contentPort.postMessage({type: MessageType.SETSETTINGS, value: settingAutoSync});

  chrome.storage.local.set({"NineOClock_Settings": {"autoSync":settingAutoSync,"everyDay":settingEveryDay,"altEnd":settingAltEnd,"syncFreq":settingSyncFreq}}, function(result) {
    //console.log("Storage: AutoSync [SET] = " + settingAutoSync);
    //console.log("Storage: EveryDay [SET] = " + settingEveryDay);
    //console.log("Storage: AltEnd [SET] = " + settingAltEnd);
    //console.log("Storage: SyncFreq [SET] = " + settingSyncFreq);
  });
}

function resetSettings() {
  chrome.storage.local.remove("NineOClock_Settings");
  getSettings();
  if (portReady)
    contentPort.postMessage({type: MessageType.SETSETTINGS, value: settingAutoSync});
}

chrome.runtime.onMessage.addListener((obj, sender, response) => {
    const {type, value} = obj;

    //console.log("Message Received Of Type: " + type);

    switch (type)
    {
        case MessageType.TEST:
          console.log("This is a test message: " + value);
          checkTime();
          break;
        case MessageType.OPEN:
          console.log("Opening URL: " + value);
          chrome.tabs.create({ url: value });
          break;
        case MessageType.SYNC:
          console.log("Syncing...");
          //syncWorldTime();
          //checkTime();
          syncContent(true);
          break;
          case MessageType.REFRESH:
            console.log("Refreshing...");
            //syncWorldTime();
            //checkTime();
            refreshExtension();
            break;
        case MessageType.GETSETTINGS:
          console.log("Sending");
          SendMessageToPopup(MessageType.SETSETTINGS,{"autoSync": settingAutoSync,"everyDay": settingEveryDay,"altEnd": settingAltEnd,"syncFreq": settingSyncFreq});
          break;
        case MessageType.UDPSETTINGS:
          console.log("Updating");
          setSettings(value.autoSync,value.everyDay,value.altEnd,value.syncFreq);
          break;
        //case MessageType.VIDEND:
          //if (videoAiring)
          //{
          //console.log("Received word that video has ended");
          //afterVidEnd(sender.tab.id);
          //}
          //break;
        case MessageType.VIDLOAD:
          unmuteTabs();
          break;
        //  {
        //    chrome.tabs.remove(sender.tab.id);
        //    videoAiring = false;
        //    console.log("Video has ended, enjoy the rest of your night!");
        //  }
        //  break;
    }
});

chrome.runtime.onConnect.addListener(function(port) {
  console.assert(port.name === MessageType.PORT);
  //console.log("Port URL: " + port.sender.tab.url);
  if (port.name != MessageType.PORT || (vidURL != undefined && port.sender.tab.url != vidURL))
  {
    port.disconnect();
    console.log("Disconnecting wrong URL port (2)");
  }
  else
  {
    console.log("Connection to port has been made");
    contentPort = port;
    contentPort.onDisconnect.addListener(() => {
      portReady = false;
      console.log("Connection to port has been lost");
    });
    contentPort.onMessage.addListener(function(obj) {
      const {type, value} = obj;

      switch (type)
      {
        case MessageType.HELLO:
          //if (contentPort.sender.tab.url != vidURL)
          //{
          //  portReady = false;
          //  contentPort.disconnect();
          //}
          //else
          //{
            portReady = true;
            //if (!settingAltEnd || videoLength <= 0)
            //  videoLength = value;

            //console.log("Video Length: " + videoLength);

            checkTime();
            //console.log("TimeTilStart Check: " + timeTilStart);
            if (timeTilStart != undefined && timeTilStart < -1 * videoLength)
              contentPort.postMessage({type: MessageType.HELLO, value: timeTilStart < -1 * videoLength});
          //}
            break;
        case MessageType.GETSETTINGS:
          //if (contentPort.sender.tab.url != vidURL)
          //{
          //  portReady = false;
          //  contentPort.disconnect();
          //}
          //else
          //{
            contentPort.postMessage({type: MessageType.SETSETTINGS, value: settingAutoSync});
            unmuteTabs(contentPort.sender.tab);
          //}
          break;
        //case MessageType.VIDEND:
        //  console.log("Video has ended, enjoy the rest of your night!");
        //  break;
      }
    });
  }
});

chrome.tabs.onUpdated.addListener(
  function(thisTabID, changeInfo, tab) {
    if (!changeInfo.status || !tab.url)
      return;
    
    //console.log("Tabs onUpdated : " + thisTabID + "," + changeInfo.status + "," + tab.url);
    if (changeInfo.status == "complete" && tab.url && tab.url == vidURL) {
      //console.log("Tabs onUpdated : " + (tab.url == vidURL));
      chrome.tabs.sendMessage( thisTabID, {
        type: MessageType.UPDURL,
        value: {"url":tab.url,"isMainTab":(tab.url == vidURL),"autoSync":settingAutoSync}
      });
    }
  }
);

chrome.alarms.onAlarm.addListener((alarm) => {
  switch (alarm)
  {
    case MessageType.CHECKSTART:
      stareAtClock();
      break;
    case MessageType.CHECKEND:
      afterVidEnd();
      break;
    case MessageType.APISYNC:
      syncWorldTime();
      break;
    case MessageType.BUFFERPLAY:
      endBuffer();
      break;
  }
});

function getVidData() {
  fetch('vidData.json')
  .then(response => {
      if (!response.ok) {
          //throw new Error("HTTP error " + response.status);
          console.log("HTTP error: " + response.status)
      }
      return response.json();
  })
  .catch(function () {
    //throw new Error("Exception catch");
    console.error("Failed to grab video data from JSON");
  })
  .then(json => {
      vidURL = json.url;
      if (settingEveryDay) {
        startDate = getStartDateFromString(json.airTime,json.offsetTime);
      } else {
        startDate = getStartDateFromString(json.airTime,json.offsetTime,json.dayOfWeek);
      }

      if (settingAltEnd) {
        if (new Date().getDay() == json.dayOfWeek)
        {
          videoLength = getSecondsFromString(json.altEndTime1);
        }
        else
        {
          videoLength = getSecondsFromString(json.altEndTime2);
        }
      }
      else
      {
        videoLength = getSecondsFromString(json.duration);
      }

      console.log("Video Length: " + videoLength);
      startTime = startDate.getTime();
      dataReady2 = true;
      console.log("Video data loaded from JSON");
      console.log("Start Date: " + startDate);
      stareAtClock();
      
  });
}

function syncContent(isForced = false) {
  clearTimeout(portTimer);

  if (!videoAiring)
  {
    return;
  }

  if (portReady && (settingAutoSync || isForced))
  {
    //console.log("Sync content");
    SendMessageToContent(MessageType.SYNCVID,{"time":getSyncTimeStamp(startTime),"url":vidURL,"bufferAction":bufferAction});
    //contentPort.postMessage({type: MessageType.SYNCVID, value: getSyncTimeStamp(startTime)});
  }

  //var correctTimeStamp = getSyncTimeStamp(startTime);

  portTimer = setTimeout(syncContent,(1.01 - settingSyncFreq) * 1000); //Sync video between ever 0.01 and 1 second
}
/*
function sendNotification() {

  chrome.notifications.create(
    //"Nine O' Clock",
    {
    type: "basic",
    iconUrl: "http://google.com/favicon.ico",
    title: "Now Playing:",
    message: "Piano Man - Billy Joel"
  }, () => { console.log("Notification sent")});
}
*/

function summonPianoMan() {
  //if (videoAiring || timeTilStart < -1 * videoLength)
  //{
  //  return;
  //}
  clearTimeout(checkEndTimer);
  clearTimeout(bufferTimer);
  //clearTimeout(muteTimer);
  console.log("Summoning Piano Man...");
  console.log("With Time Til Start = " + timeTilStart);

  videoAiring = true;

  //chrome.tabs.create({ url: vidURL }); //Sing us a song!
  chrome.tabs.query({'url': vidURL}, function(tabs) {
      
      if ( tabs.length > 0 ) {
          console.log("Tab already open, making active");
          chrome.tabs.update(tabs[0].id,{'active':true,'muted':true});
          chrome.tabs.sendMessage( tabs[0].id, {
            type: MessageType.UPDURL,
            value: {"url":tabs[0].url,"isMainTab":(tabs[0].url == vidURL),"autoSync":settingAutoSync}
          });
      } else {
          chrome.tabs.create({'url': vidURL,'active':true}, function(tab) {
            chrome.tabs.update(tab.id,{'muted':true});
            //chrome.tabs.sendMessage( tab.id, {
            //  type: MessageType.UPDURL,
            //  value: {"url":tab.url,"isMainTab":(tab.url == vidURL),"autoSync":settingAutoSync}
            //});
        });
      }

      //muteTimer = setTimeout(unmuteTabs,2000);
      
     //if (tabs.length > 0) {
     // chrome.tabs.remove(tabs[0].id);
     //}
     //chrome.tabs.create({'url': vidURL});
  });

  if (loadingBuffer > 0 && timeTilStart >= loadingBuffer)
  {
    bufferAction = MessageType.BUFFERPAUSE;
    chrome.alarms.clear(MessageType.BUFFERPLAY);
    if (loadingBuffer < 60)
    {
      console.log("Setting timeout for buffer for " + loadingBuffer + " seconds");
      bufferTimer = setTimeout(endBuffer,loadingBuffer * 1000);
    }
    else
    {
      console.log("Setting BUFFERPLAY alarm for " + loadingBuffer / 60 + " minutes");
      chrome.alarms.create(MessageType.BUFFERPLAY,{delayInMinutes: loadingBuffer / 60});
    }
  }
  else
  {
    endBuffer();
  }

  syncContent();

  //sendNotification();

  //setTimeout(341 * 1000,function() { //Video ended
  //  videoAiring = false;
  //  stareAtClock();
  //});
  chrome.alarms.clear(MessageType.CHECKSTART);
  chrome.alarms.clear(MessageType.CHECKEND);

  if (timeTilStart != undefined && videoLength > 0 && timeTilStart <= -1 * videoLength)
  {
    console.log("TimeTilStart: " + timeTilStart + ", Video Length: " + videoLength);
    afterVidEnd();
  }
  else
  {
    if ((videoLength + timeTilStart) < 60)
    {
      console.log("Setting timeout for " + (videoLength + timeTilStart) + " seconds");
      checkEndTimer = setTimeout(afterVidEnd,(videoLength + timeTilStart) * 1000);
    }
    else 
    {
      //setTimeout(stareAtClock,60 * 1000);
      console.log("Setting CHECKEND alarm for " + (videoLength + timeTilStart) / 60 + " minutes");
      chrome.alarms.create(MessageType.CHECKEND,{delayInMinutes: (videoLength + timeTilStart) / 60});
    }
  }
}
/*
function setStartTime() {
  var startDate = new Date();
  startDate.setHours(20);
  startDate.setMinutes(59);
  startDate.setSeconds(51);
  startTime = startDate.getTime();
  //chrome.alarms.create(MessageType.APISYNC,{when: Date.now(), periodInMinutes: 1}); //Sync with world API every minute
}

function setTESTStartTime() {
  var startDate = new Date();
  startDate.setHours(13);
  startDate.setMinutes(39);
  startDate.setSeconds(52);
  startTime = startDate.getTime();
  //chrome.alarms.create(MessageType.APISYNC,{when: Date.now(), periodInMinutes: 1}); //Sync with world API every minute
}
*/

function checkTime() {
  timeTilStart = undefined;
  getTime();

  if (!dataReady1 || !dataReady2)
  {
    return false;
  }

  var currDate = new Date(currentTime);
  if (currDate.getDay() != startDate.getDay()) //Not Saturday
  {
      //console.log("CheckTime: FALSE, It is not Saturday");
      //console.log("Start Date: " + startDate);
      //console.log("Start Time: " + startTime);
      return false;
  }

  //It's Saturday!

  //if (!startTime) {
  //    setTESTStartTime();
  //}

 timeTilStart = Math.floor((startTime - currentTime)/1000);
 console.log("Check Time: Time Til Start: " + timeTilStart);
 /*
  switch(true) {
      case (timeTilStart <= -1 * videoLength):
          console.log ("Check Time: FALSE, It's past 9. Enjoy your night!");
          //console.log("Start Date: " + startDate);
          //console.log("Start Time: " + startTime);
          return false;
          break;
      //case timeTilStart < -31:
      //    console.log("It's 9 o'clock on a Saturday!");
      //    return true;
      //    break;
      case (timeTilStart <= loadingBuffer): //Time to load
          console.log("Check Time: TRUE, Launching! Video Length: " + videoLength + ", Loading Buffer: " + loadingBuffer);
          return true;
          break;
      default:
          return true;
          break;
  }
  */
}

function stareAtClock() {
  clearTimeout(clockTimer);

  checkTime();

  if (!dataReady1 || !dataReady2 || videoAiring)
  {
    return;

  }

  console.log("Clock: Time/Load: " + timeTilStart + "/" + loadingBuffer + " " + (timeTilStart <= loadingBuffer) + 
    ", Time/Length: " + timeTilStart + "/-" + videoLength + " " + (timeTilStart > -1 * videoLength));

  if ((timeTilStart != undefined) && (timeTilStart <= loadingBuffer) && (timeTilStart > -1 * videoLength))
  {
    summonPianoMan();
  }

  if (timeTilStart > loadingBuffer || timeTilStart == undefined)
  {
    if (timeTilStart != undefined && timeTilStart - loadingBuffer < 60)
    {
      console.log("Setting timeout for " + (timeTilStart - loadingBuffer) + " seconds");
      clockTimer = setTimeout(stareAtClock,(timeTilStart - loadingBuffer) * 1000);
    }
    else 
    {
      if (timeTilStart == undefined)
      {
        //setTimeout(stareAtClock,60 * 1000);
        console.log("Setting CHECKSTART alarm for 1 minutes");
        chrome.alarms.create(MessageType.CHECKSTART,{delayInMinutes: 1});
      }
      else
      {
        console.log("Setting CHECKSTART alarm for " + (timeTilStart - loadingBuffer) / 60 + " minutes");
        chrome.alarms.create(MessageType.CHECKSTART,{delayInMinutes: (timeTilStart - loadingBuffer) / 60});
      }
    }
  }
  else if (timeTilStart < -1 * videoLength)
  {
    console.log("Setting CHECKSTART alarm for 12 hours");
    startTime = null;
    chrome.alarms.create(MessageType.CHECKSTART,{delayInMinutes: 720}); //Check again in 12 hours
  }
}

function afterVidEnd() {
  if (videoAiring)
  {
    chrome.tabs.query({'url': vidURL}, function(tabs) {
      tabs.forEach(function(tab) {
        chrome.tabs.remove(tab.id);
      });
    });
    //if (tabs.length > 0) {
    // chrome.tabs.remove(tabs[0].id);
    //}
    //chrome.tabs.create({'url': vidURL});
    videoAiring = false;
    //chrome.tabs.remove(rmvTab);
    console.log("Video has ended, enjoy the rest of your night!");
  }
  setTimeout(stareAtClock,5000);
}

function unmuteTabs()
{
  //console.log("Unmuting");
  /*
  if (tab != undefined)
  {
    if (tab.muted)
    {
      chrome.tab.update(tab.id,{'muted':false});
    }
  }
  else
  {
    */
    chrome.tabs.query({'url': vidURL}, function(tabs) {
      tabs.forEach(function(tab) {
          chrome.tabs.update(tab.id,{'muted':false});
    //if (tabs.length > 0) {
    // chrome.tabs.remove(tabs[0].id);
    //}
    //chrome.tabs.create({'url': vidURL});
      });
    });
}

function endBuffer()
{
  console.log("Ending Buffer");
  bufferAction = "";

  //setTimeout(unmuteTabs,5000);
  unmuteTabs();
}

chrome.windows.onCreated.addListener(function(windowid) {
  refreshExtension();
 })

function refreshExtension()
{
  console.log("[Nine O' Clock] - Reload Extension");

  clearTimeout(clockTimer);
  clearTimeout(portTimer);
  clearTimeout(checkEndTimer);
  clearTimeout(bufferTimer);

  chrome.alarms.clear(MessageType.BUFFERPLAY);
  chrome.alarms.clear(MessageType.CHECKSTART);
  chrome.alarms.clear(MessageType.CHECKEND);

  dataReady1 = false;
  dataReady2 = false;
  videoAiring = false;
  
  getSettings();
  getVidData();
  setAPISync();
  //stareAtClock();
}

refreshExtension();