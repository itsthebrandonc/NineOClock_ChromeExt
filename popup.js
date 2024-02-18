function $(id) { return document.getElementById(id); }

const MessageType = Object.freeze({
    TEST: "TEST",
    OPEN: "OPEN",
    SYNC: "SYNC",
    REFRESH: "REFRESH",
    HELLO: "HELLO",
    UPDSETTINGS: "UPDSETTINGS",
    SETSETTINGS: "SETSETTINGS",
    GETSETTINGS: "GETSETTINGS"
    });

var autoSync = true;

function SendMessageToContent(type,value)
{
    //chrome.tabs.create({'url':"chrome://newtab"});
    chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
        let currTab = tabs[0];
        if (currTab)
        {
            chrome.tabs.sendMessage(currTab.id, {
                type: type,
                value: value
            });
        }
    });
}

function SendMessageToBackground(type,value)
{
    chrome.runtime.sendMessage({
        type: type,
        value: value
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    getSettings();

    const chkSync = $("chkSync");
    const chkEveryDay = $("chkEveryDay");
    const chkAltEnd = $("chkAltEnd");
    const numSyncFreq = $("numSyncFreq");

    $("btnRefresh").addEventListener("click", () => {
        SendMessageToBackground(MessageType.REFRESH,MessageType.REFRESH);
    });
    $("btnSync").addEventListener("click", () => {
        SendMessageToBackground(MessageType.SYNC,MessageType.SYNC);
    });
    chkSync.addEventListener("change", () => {
        //console.log("Updating...");
        SendMessageToBackground(MessageType.UPDSETTINGS,{"autoSync": chkSync.checked, "everyDay": chkEveryDay.checked, "syncFreq": numSyncFreq.value, "altEnd": chkAltEnd.checked});
    });
    chkEveryDay.addEventListener("change", () => {
        SendMessageToBackground(MessageType.UPDSETTINGS,{"autoSync": chkSync.checked, "everyDay": chkEveryDay.checked, "syncFreq": numSyncFreq.value, "altEnd": chkAltEnd.checked});
    });
    chkAltEnd.addEventListener("change", () => {
        SendMessageToBackground(MessageType.UPDSETTINGS,{"autoSync": chkSync.checked, "everyDay": chkEveryDay.checked, "syncFreq": numSyncFreq.value, "altEnd": chkAltEnd.checked});
    });
    numSyncFreq.addEventListener("change", () => {
        SendMessageToBackground(MessageType.UPDSETTINGS,{"autoSync": chkSync.checked, "everyDay": chkEveryDay.checked, "syncFreq": numSyncFreq.value, "altEnd": chkAltEnd.checked});
    });
});

chrome.runtime.onMessage.addListener((obj, sender, response) => {
    const {type, value} = obj;

    console.log("Message Received Of Type: " + type);

    switch (type)
    {
        //case "POPTEST":
        //    console.log("This is a test message: " + value);
        //    break;
        case "SETSETTINGS":
            console.log("Set Settings: " + value.everyDay);
            $("chkSync").checked = value.autoSync;
            $("chkEveryDay").checked = value.everyDay;
            $("chkAltEnd").checked = value.altEnd;
            $("numSyncFreq").value = value.syncFreq;
            break;
    }
});

console.log("Nine O' Clock - Popup Loaded");

function getSettings() {
    SendMessageToBackground(MessageType.GETSETTINGS,MessageType.GETSETTINGS);
}