(() => {
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

    let youtubePlayer;
    let titleChanged = false;
    let origTitle;
    let vidURL;
    let videoLength;
    let lastPlayerTime;
    let contentPort;
    let settingAutoSync = true;
    let videoAiring = false;
    let controlVideo = false;
    let isMainTab = false;

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

        youtubePlayer.addEventListener('canplay', function () {
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
            if (controlVideo)
                youtubePlayer.playbackRate = 1;
        });

        youtubePlayer.addEventListener('ended', function() {
            videoAiring = false;
            controlVideo = settingAutoSync && videoAiring &&isMainTab;
            //console.log("Control Video: " + controlVideo + ": " + settingAutoSync + "," + videoAiring + "," + isMainTab);
        });
    }

    function connectToPort()
    {
        console.log("Connecting port...");
        contentPort = chrome.runtime.connect({name: MessageType.PORT});
        contentPort.postMessage({type: MessageType.HELLO, value: videoLength});
        contentPort.onMessage.addListener(function(obj) {
            const {type, value} = obj;
            switch(type)
            {
                case MessageType.HELLO:
                    console.log("Port connection successful");
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
                        console.log("Disconnecting wrong URL port");
                    }
                    else
                    {
                        syncVid(value.time,value.bufferAction);
                    }
                    break;
            }
        });
        contentPort.onDisconnect.addListener(() => {
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
    }

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
            case MessageType.UPDURL:
                if (vidURL != value.url)
                {
                    vidURL = value.url;
                    console.log("URL updated");
                }
                if (!isMainTab && value.isMainTab)
                {
                    console.log("Setting tab");
                    isMainTab = true;
                    initVideoPlayer();
                    setSettings(value.autoSync);
                    connectToPort();
                }
                vidURL = value.url;
                isMainTab == value.isMainTab;
                break;
        }
    });
})();