var currentTime = new Date().getTime();

function getTime() {
    currentTime = new Date().getTime();
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

    if (strStartTime != undefined)
    {
        timeStampToDate(strStartTime,startDate);
    }

    if (strOffsetTime != undefined)
    {
        addTimeFromTimeStamp(strOffsetTime,startDate);
    }

    return startDate;
}

function timeStampToDate(strTimeStamp,date)
{   
    let timeArray = strTimeStamp.split(":");
    for (let i=0;i<timeArray.length;i++)
    {
        let timeElement = timeArray[i];

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
}

function addTimeFromTimeStamp(strTimeStamp,date)
{;
    let timeArray;
    let isAddingTime = (strTimeStamp.charAt(0) == "+" || (strTimeStamp.charAt(0) != "+" && strTimeStamp.charAt(0) != "-"));
    if (isAddingTime)
        timeArray = strTimeStamp.substring(1).split(":")
    else
        timeArray = strTimeStamp.split(":");

    for (let i=0;i<timeArray.length;i++)
    {
        let timeElement = timeArray[i];

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
}

function getSecondsFromString(strTimeStamp)
{
    let seconds = 0;
    let date = new Date();

    date.setHours(0,0,0,0);
    timeStampToDate(strTimeStamp,date);

    seconds += date.getHours() * 60 * 60;
    seconds += date.getMinutes() * 60;
    seconds += date.getSeconds();
    seconds += date.getMilliseconds() * 0.001;

    return seconds;
}