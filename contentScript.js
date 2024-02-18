//import { SendMessageToBackground, SendMessageToPopup } from "./messenger.js";
//import { SendMessageToBackground, SendMessageToContent } from './messenger.js';

//import(chrome.runtime.getURL('messenger.js'));

(() => {
    const MessageType = Object.freeze({
        TEST: "TEST",
        OPEN: "OPEN",
        SYNC: "SYNC",
        SYNCVID: "SYNCVID",
        PORT: "PORT",
        HELLO: "HELLO",
        VIDEND: "VIDEND",
        GETSETTINGS: "GETSETTINGS",
        SETSETTINGS: "SETSETTINGS",
        UPDURL: "UPDURL",
        BUFFERPAUSE: "BUFFERPAUSE",
        BUFFERPLAY: "BUFFERPLAY",
        VIDLOAD: "VIDLOAD"
        });

    let youtubePlayer;
    let titleChanged = false;
    let origTitle;
    let vidURL;
    let videoLength;
    let lastPlayerTime;
    let contentPort;
    let portReady = false;
    let settingAutoSync = true;
    let firstSettings = true;
    let videoAiring = false;
    let controlVideo = false;
    let isMainTab = false;
    let onBufferTime = false;
    
    /*
    function SendMessageToPopup(type,value)
{
    chrome.runtime.sendMessage({
        type: "POPTEST",
        value: "Hello, popup!"
    });
}
*/
    
    function SendMessageToBackground(type,value)
    {
        chrome.runtime.sendMessage({
            type: type,
            value: value
        });
    }
    

    function initVideoPlayer()
    {
        youtubePlayer = document.getElementsByClassName('video-stream')[0];
        youtubePlayer.muted = false;
        vidURL = window.location.href;
        videoLength = youtubePlayer.duration;
        //youtubePlayer.pause();
        //console.log("First Pause");
        //youtubePlayer.playbackRate = 1;

        youtubePlayer.addEventListener('canplay', function () {
            //youtubePlayer.muted = true;
            //youtubePlayer.pause = true;
            //console.log("Vid loaded");
            SendMessageToBackground(MessageType.VIDLOAD,MessageType.VIDLOAD);
        });

        youtubePlayer.addEventListener('onvolumechange', function() {
            if (controlVideo)
                youtubePlayer.muted = false;
        });

        
        youtubePlayer.addEventListener('timeupdate', function() { //Keeps previous video time, used when preventing skipping
            if (!youtubePlayer.seeking) {
                lastPlayerTime = youtubePlayer.currentTime;
            }
        });

        youtubePlayer.addEventListener('seeking', function() { //Prevents skipping around
            if (controlVideo)
            {
                var delta = youtubePlayer.currentTime - lastPlayerTime;
                if (Math.abs(delta) > 1000) {
                    youtubePlayer.pause();
                    youtubePlayer.currentTime = lastPlayerTime;
                    youtubePlayer.play();
                }
            }
        });
        
        youtubePlayer.addEventListener('ratechange', function() { //Prevents changing playback rate
            //console.log(controlVideo);
            
            if (controlVideo)
                youtubePlayer.playbackRate = 1;
        });

        youtubePlayer.addEventListener('ended', function() {
            if (controlVideo && !firstSettings)
                SendMessageToBackground(MessageType.VIDEND,MessageType.VIDEND);
            //if (contentPort)
            //{
                //contentPort.postMessage({type: MessageType.VIDEND, value: MessageType.VIDEND});
            //}
            videoAiring = false;
            controlVideo = settingAutoSync && videoAiring &&isMainTab;
            console.log("Control Video: " + controlVideo + ": " + settingAutoSync + "," + videoAiring + "," + isMainTab);
            
        });
    }

    function connectToPort()
    {
        console.log("Connecting port...");
        contentPort = chrome.runtime.connect({name: MessageType.PORT});
        contentPort.postMessage({type: MessageType.HELLO, value: videoLength});
        contentPort.onMessage.addListener(function(obj) {
            const {type, value} = obj;
            //console.log("Message received of type: " + type);
            switch(type)
            {
                case MessageType.HELLO:
                    portReady = true;
                    console.log("Port connection successful");
                    //initVideoPlayer();
                    //determineVideoAiring(value);
                    if (value != undefined)
                        videoAiring = value;
                    contentPort.postMessage({type: MessageType.GETSETTINGS, value: MessageType.GETSETTINGS});
                    break;
                case MessageType.SETSETTINGS:
                    console.log("Received new Auto Sync: " + value);
                    setSettings(value);
                    break;
                case MessageType.SYNCVID:
                    if (vidURL != undefined && value.url != undefined && vidURL != value.url)
                    {
                        contentPort.disconnect();
                        console.log("Disconnecting wrong URL port (1)");
                    }
                    else
                    {
                        //console.log("URL Check: " + vidURL + "," + value.url);
                        syncVid(value.time,value.bufferAction);
                    }
                    break;
            }
        });
        contentPort.onDisconnect.addListener(() => {
            portReady = false;
            console.log("Connection to port has been lost");
        });
    }

    function syncVid(correctTimeStamp,bufferAction)
    {
        if (!isMainTab || !youtubePlayer || youtubePlayer.ended)
        {
            return;
        }

        videoAiring = true;
        controlVideo = videoAiring && settingAutoSync && isMainTab;

        //console.log("Video Sync: " + (youtubePlayer.currentTime - correctTimeStamp));

        if (bufferAction == MessageType.BUFFERPAUSE)
        {
            console.log("Buffer Buffer");
            youtubePlayer.pause();
            youtubePlayer.currentTime = 0;
        }
        else
        {
            if (Math.abs(youtubePlayer.currentTime - correctTimeStamp) > 0.5) //Threshold of 0.5 seconds
            {
                youtubePlayer.pause();
                youtubePlayer.currentTime = correctTimeStamp;
                youtubePlayer.play();
            }
        }

        if (youtubePlayer.muted)
        {
            youtubePlayer.muted = false;
        }

        updateTitle();
    }

    function setSettings(newAutoSync) {
        if (newAutoSync != undefined)
            settingAutoSync = newAutoSync;
        controlVideo = settingAutoSync && videoAiring && isMainTab;
        console.log("Control Video: " + controlVideo + ": " + settingAutoSync + "," + videoAiring + "," + isMainTab);

        updateTitle();

        if (controlVideo)
        {
            youtubePlayer.playbackRate = 1;
        }
        else
        {
            //if (firstSettings)
            //    youtubePlayer.play();
        }

        firstSettings = false;
    }
    /*
    function determineVideoAiring(timeTilStart) {
        switch(true) {
            case timeTilStart < -1 * videoLength:
                console.log ("It's past 9. Enjoy your night!");
                videoAiring = false;
                break;
            case timeTilStart < -31:
                console.log("It's 9 o'clock on a Saturday!");
                videoAiring = true;
                break;
            case timeTilStart < 60:
                console.log("Starting!!");
                videoAiring = true;
                break;
            default:
                console.log("Starts In: " + timeTilStart);
                videoAiring = false;
                chrome.alarms.create(MessageType.CHECKAIR,{delayInMinutes: timeTilStart / 60});
                break;
        }
    }
    */

    function updateTitle()
    {
        if ((!controlVideo && !titleChanged) || (controlVideo && titleChanged))
        {
            return;
        }

        let ytTitle = document.getElementById('above-the-fold').getElementsByTagName('yt-formatted-string')[0];
        if (!ytTitle)
            return;

        if (!origTitle)
        {
            origTitle = ytTitle.innerHTML;
        }

        if (controlVideo)
        {
            ytTitle.innerHTML = origTitle + ' - [SYNC]';
            titleChanged = true;
            console.log("Change Title: SYNC");
        }
        else
        {
            ytTitle.innerHTML = origTitle;
            titleChanged = false;
            console.log("Change Title: ORIG");
        }
    }

    chrome.runtime.onMessage.addListener((obj, sender, response) => {
        const {type, value} = obj;

        console.log("Message Received Of Type: " + type);

        switch (type)
        {
            case MessageType.TEST:
                console.log("This is a test message: " + value);
                //SendMessageToBackground(type,value);
                //SendMessageToPopup(type,value);
                break;
            //case MessageType.SYNCVID:
            //    syncVid(value);
            //    break;
            case MessageType.AUTOSYNC:
                console.log("AutoSync : " + value);
                break;
            case MessageType.UPDURL:
                if (vidURL != value.url)
                {
                    vidURL = value.url;
                    console.log("URL updated");
                }
                if (!isMainTab && value.isMainTab)
                {
                    console.log("Setting tab");
                    //vidURL = value.url;
                    isMainTab = true;
                    initVideoPlayer();
                    firstSettings = true;
                    setSettings(value.autoSync);
                    connectToPort();
                }
                vidURL = value.url;
                isMainTab == value.isMainTab;
                break;
        }
    });

    //document.addEventListener("DOMContentLoaded", async () => { //This is already going to fire after DOM content is loaded (unless you add run_at to manifest)
      
    //if (window.location.href === vidURL)
    //    {
    //        console.log("Piano Man Page");
            //firstSettings = true;
            //initVideoPlayer();
            //connectToPort();
    //    }
        //SendMessageToBackground(MessageType.SYNC,null);

     //   console.log("Nine O' Clock - Content Loaded");
    //});
    /*
    document.addEventListener("locationchange", () => {
        if (vidURL != window.location.href)
        {
            console.log("Changed URL");
            vidURL = window.location.href;
        }
    });
    */
    //initVideoPlayer();
    
   //SendMessageToBackground(MessageType.CHECKTAB,window.location.href);
})();