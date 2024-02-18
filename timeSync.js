var worldTimeOffset = 0;
var currentTime = new Date().getTime();
var useTimeAPI = false;

function syncWorldTime() {
    if (!useTimeAPI)
        return;

    //console.log("Getting Time API");
    var apiCheckTime = new Date().getTime();  //Current system Unix time (seconds since 01/01/1970)
    fetch('https://www.worldtimeapi.org/api/timezone/Etc/UTC')
    .then(response => {
        if (!response.ok) {
            throw new Error("HTTP error " + response.status);
        }
        return response.json();
    })
    .then(json => {
        var worldTime = json.unixtime;
        //worldTimeOffset = worldTime - (new Date().getTime() / 1000);
        //worldTimeOffset = worldTime - apiCheckTime - ((new Date().getTime()) - apiCheckTime); //Too complicated?
        worldTimeOffset = (worldTime - (new Date().getTime())) - apiCheckTime; //Too complicated?

        //console.log("World Time Offset: " + worldTimeOffset);
    })
    .catch(function () {
        throw new Error("Exception catch");
    });

    //setTimeout(syncWorldTime,60000); //Re-sync every minute
}

function getTime() {
    currentTime = new Date().getTime();
    if (Math.abs(worldTimeOffset) > 500) //Threshold of 0.5 seconds
    {
        currentTime += worldTimeOffset;
    }
}

function getSyncTimeStamp(startTime) {
    getTime();
    return (currentTime - startTime) / 1000;
}

function getStartDateFromString(strStartTime,strOffsetTime,strDayOfWeek = -1) {
    let startDate = new Date();
    startDate.setHours(0,0,0,0);

    if (strDayOfWeek != undefined && strDayOfWeek >= 0 && strDayOfWeek < 7)
    {
        //console.log("Day Of Week: " + strDayOfWeek);
        if (startDate.getDay() != strDayOfWeek)
        {
            for (let i=0;i<7;i++)
            {
            startDate.setDate(startDate.getDate() + 1);
            if (startDate.getDay() == strDayOfWeek)
                i = 7;
            }
        }
    }

    //console.log("Start Date Check: " + startDate);

    if (strStartTime != undefined)
    {
        timeStampToDate(strStartTime,startDate);
    }

    //console.log("Start Date Check: " + startDate);

    if (strOffsetTime != undefined)
    {
        addTimeFromTimeStamp(strOffsetTime,startDate);
    }

    //console.log("Start Date Check: " + startDate);
    /*
    if (json.hour != undefined)
    startDate.setHours(json.hour);
    if (json.minute != undefined)
    startDate.setMinutes(json.minute);
    if (json.second != undefined)
    startDate.setSeconds(json.second);
    if (json.millisecond != undefined)
    startDate.setMilliseconds(json.millisecond)
    */
    //startTime = startDate.getTime();
    return startDate;
}

function timeStampToDate(strTimeStamp,date)
{   
    //console.log("Getting start time");
    //let date = new Date(inDate.getTime());
    let timeArray = strTimeStamp.split(":");
    for (let i=0;i<timeArray.length;i++)
    {
        let timeElement = timeArray[i];
        //console.log("StarTime: Time Element[" + i + "]: " + timeElement);
        if (timeElement != 0)
        {
        switch (i)
        {
            case 0: date.setHours(timeElement);        break; //Hours
            case 1: date.setMinutes(timeElement);      break; //Minutes
            case 2: date.setSeconds(timeElement);      break; //Seconds
            case 3: date.setMilliseconds(timeElement); break; //Milliseconds
        }
        }
    }
    //return date
}

function addTimeFromTimeStamp(strTimeStamp,date)
{
    //let date = new Date(inDate.getTime());
    let timeArray;
    let isAddingTime = (strTimeStamp.charAt(0) == "+" || (strTimeStamp.charAt(0) != "+" && strTimeStamp.charAt(0) != "-"));
    if (isAddingTime)
        timeArray = strTimeStamp.substring(1).split(":")
    else
        timeArray = strTimeStamp.split(":");

    for (let i=0;i<timeArray.length;i++)
    {
        let timeElement = timeArray[i];
        //if (isAddingTime)
        //{
        //console.log("OffsetTime ADD: Time Element[" + i + "]: " + timeElement);
        //}
        //else
        //{
        //console.log("OffsetTime SUB: Time Element[" + i + "]: " + timeElement);
        //}
        if (timeElement != 0)
        {
            if (isAddingTime)
            {
                switch (i)
                {
                case 0: date.setTime(date.getTime() + timeElement * 60 * 60 * 1000);        break; //Hours
                case 1: date.setTime(date.getTime() + timeElement * 60 * 1000);             break; //Minutes
                case 2: date.setTime(date.getTime() + timeElement * 1000);                  break; //Seconds
                case 3: date.setTime(date.getTime() + timeElement);                         break; //Milliseconds
                }
            }
            else
            {
                switch (i)
                {
                case 0: date.setTime(date.getTime() - timeElement * 60 * 60 * 1000);        break; //Hours
                case 1: date.setTime(date.getTime() - timeElement * 60 * 1000);             break; //Minutes
                case 2: date.setTime(date.getTime() - timeElement * 1000);                  break; //Seconds
                case 3: date.setTime(date.getTime() - timeElement);                         break; //Milliseconds
                }
            }
        }
    }
    //return date;
}

function getSecondsFromString(strTimeStamp)
{
    let seconds = 0;
    let date = new Date();

    date.setHours(0,0,0,0);
    timeStampToDate(strTimeStamp,date);

    //console.log("Seconds To String: " + date);

    seconds += date.getHours() * 60 * 60;
    seconds += date.getMinutes() * 60;
    seconds += date.getSeconds();
    seconds += date.getMilliseconds() * 0.001;

    //console.log("Seconds To String: " + seconds);

    return seconds;
}