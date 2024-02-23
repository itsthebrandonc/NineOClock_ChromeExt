importScripts('timeSync.js');

const MessageType = Object.freeze({
  SYNC: "SYNC",
  REFRESH: "REFRESH",
  SYNCVID: "SYNCVID",
  CHECKSTART: "CHECKSTART",
  CHECKEND: "CHECKEND",
  PORT: "PORT",
  HELLO: "HELLO",
  UPDSETTINGS: "UPDSETTINGS",
  SETSETTINGS: "SETSETTINGS",
  GETSETTINGS: "GETSETTINGS",
  UPDURL: "UPDURL",
  BUFFERPAUSE: "BUFFERPAUSE",
  BUFFERPLAY: "BUFFERPLAY",
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
      console.log("Disconnecting wrong URL port");
      contentPort.disconnect();
    }
    else
    {
      contentPort.postMessage({type: type, value: value});
    }
  }
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
      }
      if (result.NineOClock_Settings.everyDay != undefined)
      {
        settingEveryDay = result.NineOClock_Settings.everyDay;
      }
      if (result.NineOClock_Settings.altEnd != undefined)
      {
        settingAltEnd = result.NineOClock_Settings.altEnd;
      }
      if (result.NineOClock_Settings.syncFreq != undefined)
      {
        settingSyncFreq = result.NineOClock_Settings.syncFreq;
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

  if (portReady)
    contentPort.postMessage({type: MessageType.SETSETTINGS, value: settingAutoSync});

  chrome.storage.local.set({"NineOClock_Settings": {"autoSync":settingAutoSync,"everyDay":settingEveryDay,"altEnd":settingAltEnd,"syncFreq":settingSyncFreq}}, function(result) {
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

    switch (type)
    {
        case MessageType.SYNC:
          syncContent(true);
          break;
          case MessageType.REFRESH:
            refreshExtension();
            break;
        case MessageType.GETSETTINGS:
          SendMessageToPopup(MessageType.SETSETTINGS,{"autoSync": settingAutoSync,"everyDay": settingEveryDay,"altEnd": settingAltEnd,"syncFreq": settingSyncFreq});
          break;
        case MessageType.UPDSETTINGS:
          setSettings(value.autoSync,value.everyDay,value.altEnd,value.syncFreq);
          break;
        case MessageType.VIDLOAD:
          unmuteTabs();
          break;
    }
});

chrome.runtime.onConnect.addListener(function(port) {
  if (port.name != MessageType.PORT || (vidURL != undefined && port.sender.tab.url != vidURL))
  {
    port.disconnect();
    console.log("Disconnecting wrong URL port");
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
            portReady = true;
            checkTime();
            if (timeTilStart != undefined && timeTilStart < -1 * videoLength)
              contentPort.postMessage({type: MessageType.HELLO, value: timeTilStart < -1 * videoLength});
            break;
        case MessageType.GETSETTINGS:
            contentPort.postMessage({type: MessageType.SETSETTINGS, value: settingAutoSync});
            unmuteTabs(contentPort.sender.tab);
          break;
      }
    });
  }
});

chrome.tabs.onUpdated.addListener(
  function(thisTabID, changeInfo, tab) {
    if (!changeInfo.status || !tab.url)
      return;
    
    if (changeInfo.status == "complete" && tab.url && tab.url == vidURL) {
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
    case MessageType.BUFFERPLAY:
      endBuffer();
      break;
  }
});

function getVidData() {
  fetch('vidData.json')
  .then(response => {
      if (!response.ok) {
          console.log("HTTP error: " + response.status)
      }
      return response.json();
  })
  .catch(function () {
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
    SendMessageToContent(MessageType.SYNCVID,{"time":getSyncTimeStamp(startTime),"url":vidURL,"bufferAction":bufferAction});
  }


  portTimer = setTimeout(syncContent,(1.01 - settingSyncFreq) * 1000); //Sync video between every 0.01 and 1 second
}

function summonPianoMan() {

  clearTimeout(checkEndTimer);
  clearTimeout(bufferTimer);

  console.log("Summoning Piano Man...");
  console.log("With Time Til Start = " + timeTilStart);

  videoAiring = true;

  chrome.tabs.query({'url': vidURL}, function(tabs) { //Sing us a song!
      
      if ( tabs.length > 0 ) {
          console.log("Tab already open, making active");
          chrome.tabs.update(tabs[0].id,{'active':true,'muted':true});
          chrome.tabs.sendMessage( tabs[0].id, {
            type: MessageType.UPDURL,
            value: {"url":tabs[0].url,"isMainTab":(tabs[0].url == vidURL),"autoSync":settingAutoSync}
          });
      } else {
        console.log("Sing us a song!");
          chrome.tabs.create({'url': vidURL,'active':true}, function(tab) {
            chrome.tabs.update(tab.id,{'muted':true});
        });
      }
  });

  if (loadingBuffer > 0 && timeTilStart >= loadingBuffer)
  {
    bufferAction = MessageType.BUFFERPAUSE;
    chrome.alarms.clear(MessageType.BUFFERPLAY);
    if (loadingBuffer < 60)
    {
      //console.log("Setting timeout for buffer for " + loadingBuffer + " seconds");
      bufferTimer = setTimeout(endBuffer,loadingBuffer * 1000);
    }
    else
    {
      //console.log("Setting BUFFERPLAY alarm for " + loadingBuffer / 60 + " minutes");
      chrome.alarms.create(MessageType.BUFFERPLAY,{delayInMinutes: loadingBuffer / 60});
    }
  }
  else
  {
    endBuffer();
  }

  syncContent();

  chrome.alarms.clear(MessageType.CHECKSTART);
  chrome.alarms.clear(MessageType.CHECKEND);

  if (timeTilStart != undefined && videoLength > 0 && timeTilStart <= -1 * videoLength)
  {
    //console.log("TimeTilStart: " + timeTilStart + ", Video Length: " + videoLength);
    afterVidEnd();
  }
  else
  {
    if ((videoLength + timeTilStart) < 60)
    {
      //console.log("Setting timeout for " + (videoLength + timeTilStart) + " seconds");
      checkEndTimer = setTimeout(afterVidEnd,(videoLength + timeTilStart) * 1000);
    }
    else 
    {
      //console.log("Setting CHECKEND alarm for " + (videoLength + timeTilStart) / 60 + " minutes");
      chrome.alarms.create(MessageType.CHECKEND,{delayInMinutes: (videoLength + timeTilStart) / 60});
    }
  }
}

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
      return false;
  }

 timeTilStart = Math.floor((startTime - currentTime)/1000);
 console.log("Check Time: Time Til Start: " + timeTilStart);
}

function stareAtClock() {
  clearTimeout(clockTimer);

  checkTime();

  if (!dataReady1 || !dataReady2 || videoAiring)
  {
    return;

  }

  //console.log("Clock: Time/Load: " + timeTilStart + "/" + loadingBuffer + " " + (timeTilStart <= loadingBuffer) + 
  //  ", Time/Length: " + timeTilStart + "/-" + videoLength + " " + (timeTilStart > -1 * videoLength));

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
        //console.log("Setting CHECKSTART alarm for 1 minutes");
        chrome.alarms.create(MessageType.CHECKSTART,{delayInMinutes: 1});
      }
      else
      {
        //console.log("Setting CHECKSTART alarm for " + (timeTilStart - loadingBuffer) / 60 + " minutes");
        chrome.alarms.create(MessageType.CHECKSTART,{delayInMinutes: (timeTilStart - loadingBuffer) / 60});
      }
    }
  }
  else if (timeTilStart < -1 * videoLength)
  {
    //console.log("Setting CHECKSTART alarm for 12 hours");
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

    videoAiring = false;

    console.log("Video has ended, enjoy the rest of your night!");
  }
  setTimeout(stareAtClock,5000);
}

function unmuteTabs()
{

    chrome.tabs.query({'url': vidURL}, function(tabs) {
      tabs.forEach(function(tab) {
          chrome.tabs.update(tab.id,{'muted':false});
      });
    });
}

function endBuffer()
{
  console.log("Ending Buffer");
  bufferAction = "";

  unmuteTabs();
}

chrome.windows.onCreated.addListener(function(windowid) {
  refreshExtension();
 })

function refreshExtension()
{
  //console.log("[Nine O' Clock] - Reload Extension");
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
}

refreshExtension();