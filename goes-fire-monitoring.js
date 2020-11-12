var CONFIG = {
    startDate: '2017-05-24',
    mapInitZoom: 6,
    mapInitLat: -60.708,
    mapInitLon: -18.285
}

var DQFVis = {
    min: 0,
    max: 5,
    palette: [
        'red',          // Good quality fire pixel
        'olive',           // Good quality fire free land
        'cornsilk',            // Opaque cloud
        'darkslateblue',   // off earth, or missing input data
        'green',    // Bad input data
        'burlywood'        // Algorithm failure
    ]
};

var chosenDate = ee.Date(CONFIG.startDate);

var collection = ee.ImageCollection('NOAA/GOES/16/FDCF')
    .filterDate(CONFIG.startDate, Date.now());

var layerCreated = false;

var showPic = function () {
    setDate();
    var img = collection.filterDate(chosenDate, chosenDate.advance(1, 'days'))
        .select("DQF")
        .first();
    if (layerCreated) {
        Map.layers().get(0).setEeObject(img);
    }
    else {
        Map.addLayer(collection.first().select("DQF"), DQFVis, 'DQF');
        layerCreated = true;
    }
};


function setYMD(range) {
    resetHour();
    resetMinute();
    showPic();
}

function setHour(value) {
    resetMinute();
    showPic();
}

function setMinute(value) {
    showPic();
}

function resetHour() {
    hourSlider.setValue(0);
}

function resetMinute() {
    minuteSlider.setValue(0);
}

function createColorLabel(text, color) {
    var label = ui.Label({
        value: text,
        style: {
            backgroundColor: color,
            margin: '0px',
            width: '100%',
            height: "32px",
            fontFamily: 'Arial'
        },

    });
    return label;
}

function createCenteredLabel(text) {
    var label = ui.Label({
        value: text,
        style: {
            margin: 'auto',
            fontFamily: "Arial"
        },

    });
    return label
}

function setDate() {
    var YMD = ee.List(dateSlider.getValue()).get(0);
    var hour = hourSlider.getValue();
    var minute = minuteSlider.getValue();
    chosenDate = ee.Date(YMD);
    chosenDate = chosenDate.advance(hour, 'hours')
    chosenDate = chosenDate.advance(minute, 'minutes')
}


var dateSlider = ui.DateSlider({
    start: CONFIG.startDate,
    period: 1,
    onChange: setYMD
});


var hourSlider = ui.Slider({
    min: 0,
    max: 23,
    value: 0,
    step: 1,
    onChange: setHour,
    style: {
        width: "120%"
    }
});

var minuteSlider = ui.Slider({
    min: 0,
    max: 45,
    value: 0,
    step: 15,
    onChange: setMinute,
    style: {
        width: "120%"
    }
});

var legendLabels = [
    createColorLabel('fire', 'red'),
    createColorLabel('no-fire', 'olive'),
    createColorLabel('clouds', 'cornsilk'),
    createColorLabel('missing data or water', 'darkslateblue'),
    createColorLabel('bad input data', 'green'),
    createColorLabel('Algorithm failure', 'burlywood'),
]


var infoPanel = ui.Panel(legendLabels, ui.Panel.Layout.flow(),
    {
        width: "160px",
        height: "208px",
        textAlign: "center",
        margin: "0px",
        position: "bottom-right"
    });

var hourLabel = createCenteredLabel("Hour")
var minuteLabel = createCenteredLabel("Minute")

var hourSliderPanel = ui.Panel({
    style: {
        margin: "auto",
        height: "82px"
    }
})
var minuteSliderPanel = ui.Panel({
    style: {
        margin: "0 0 0 10px",
        height: "82px"
    }
})

hourSliderPanel.add(hourLabel)
hourSliderPanel.add(hourSlider)
minuteSliderPanel.add(minuteLabel)
minuteSliderPanel.add(minuteSlider)

Map.add(dateSlider);
Map.add(hourSliderPanel);
Map.add(minuteSliderPanel);
Map.add(infoPanel);
Map.setCenter(CONFIG.mapInitLat,
    CONFIG.mapInitLon,
    CONFIG.mapInitZoom);
showPic();
