// CCI temporal resolution is monthly

var CONFIG = {
    startDate: '2001-01-01',
    endDate: '2020-01-01',

    fireBand: "Fires",


    maxConnectedPixels: 2048, // it can be adjusted according to geometry size
    timeField: 'system:time_start',
    maxPixels: 1e12,
    pixelSizeMeters: 250,

    maxIntersectAreaReducer: ee.Reducer.max(),

    sumBurnedAreaReducer: ee.Reducer.sum(),

    maxIntersectAreaChartOptions: {
        title: 'Maximum burned area intersecting chosen region monthly',
        vAxis: {
            title: "Burned area [hA]",
        },
        hAxis: {
            title: "month",
        },
        width: 480,
        height: 240
    },

    sumBurnedAreaChartOptions: {
        title: "Sum of burned areas in chosen region monthly",
        vAxis: {
            title: "Burned area [hA]",
        },
        hAxis: {
            title: "month",
        },
        width: 480,
        height: 240
    },

    mapInitZoom: 6,
    mapInitLat: -60.708,
    mapInitLon: -18.285
};

var baVis = {
    min: 1,
    max: 31,
    palette:
        ["03071e", "370617", "6a040f", "9d0208", "d00000",
            "dc2f02", "e85d04", "f48c06", "faa307", "ffba08"]
};

function toFireIndicator(img) {
    var indicator = img.select(['BurnDate'], [CONFIG.fireBand])
        .gt(0)
        .int();

    return ee.Image(indicator.copyProperties(img, [CONFIG.timeField]));
}


function reduceRegion(collection, reducer) {
    function returnFeat(img) {
        var reducedArea = img.reduceRegion({
            reducer: reducer,
            geometry: geom,
            scale: CONFIG.pixelSizeMeters,
            maxPixels: CONFIG.maxPixels,
        }).get(CONFIG.fireBand)

        var featureReduced = ee.Feature(geom, {
            Fires: reducedArea,
            "system:time_start": img.date()
        })
        return featureReduced
    }

    // to filter missing vlaues
    var nonZeroFilter = ee.Filter.neq(CONFIG.fireBand, 0);
    var notNullFilter = ee.Filter.notNull([CONFIG.fireBand, CONFIG.timeField])
    var filter = ee.Filter.and(nonZeroFilter, notNullFilter)


    return (collection.map(returnFeat)
        .filter(filter)
        .map(rescaleToHectares)
    )

}


function sumConnectedPixels(img) {
    var fireIndicator = toFireIndicator(img)

    // duplicate band to use the same band as connectiveness determinator and output
    fireIndicator = fireIndicator
        .addBands(fireIndicator)
        .select(['.*'], ['labels', CONFIG.fireBand])

    var areas = fireIndicator.reduceConnectedComponents(
        {
            reducer: ee.Reducer.sum()
                .setOutputs([CONFIG.fireBand]),
            labelBand: "labels",
            maxSize: CONFIG.maxConnectedPixels
        });

    return areas.copyProperties(img, [CONFIG.timeField]);
}


function rescaleToHectares(feature) {
    var value = ee.Number(feature.get(CONFIG.fireBand))

    var areaMultiplier = CONFIG.pixelSizeMeters * CONFIG.pixelSizeMeters;
    var hectare2Meter = 100 * 100;

    value = value.multiply(areaMultiplier / hectare2Meter);
    return feature.set(CONFIG.fireBand, value);
}

var showPic = function (range) {
    var startDate = range.start().format('Y-MM-01');
    var thisMonth = ee.Date(startDate)
    var img = collection.filterDate(thisMonth, CONFIG.endDate).first();
    var nextMonth = thisMonth.advance(1, "month")
    var numOfDays = nextMonth.difference(thisMonth, 'days')
    var doyStartMonth = thisMonth.getRelative("day", "year");

    baVis.max = numOfDays.getInfo();

    Map.layers().get(0).setEeObject(img.select("BurnDate").subtract(doyStartMonth));
    Map.layers().get(0).setVisParams(baVis)
    relabelLegend()

}

function relabelLegend() {
    legendLabels.clear()

    legendLabels.add(ui.Label(baVis.min, { margin: '2px 8px' }));
    legendLabels.add(ui.Label(Math.floor((baVis.max) / 2),
        { margin: '2px 0px', textAlign: 'center', stretch: 'horizontal' }))
    legendLabels.add(ui.Label(baVis.max, { margin: '2px 0px' }))
}


function setSliderDate(date) {
    dateSlider.setValue(date);
}

function plotOnChart(collection, reducer, options) {
    var regionTimeSeries = reduceRegion(collection, reducer)

    var burnedAreasChart = ui.Chart.feature.byFeature(
        regionTimeSeries,
        CONFIG.timeField,
        CONFIG.fireBand
    ).setChartType("ScatterChart")

    chartPanel.clear();
    chartPanel.add(burnedAreasChart.setOptions(options));
    burnedAreasChart.onClick(setSliderDate)

}

function updateGeometry() {
    geom = Map.drawingTools().layers().get(0).toGeometry();
}

function makeColorBarParams(palette) {
    return {
        bbox: [0, 0, 1, 0.1],
        dimensions: '260x30',
        format: 'png',
        min: 0,
        max: 1,
        palette: palette,
    };
}

// Create the color bar for the legend.
var colorBar = ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0),
    params: makeColorBarParams(baVis.palette),
    style: { stretch: 'vertical', margin: '0px 8px', maxHeight: '30px', width: "400px" },
});

var buttonPanel = ui.Panel();
buttonPanel.style().set({
    position: 'bottom-right',
    height: "100px"
});

var legendLabels = ui.Panel({
    widgets: [
        ui.Label(baVis.min, { margin: '2px 8px' }),
        ui.Label(
            Math.floor((baVis.max) / 2),
            { margin: '2px 0px', textAlign: 'center', stretch: 'horizontal' }),
        ui.Label(baVis.max, { margin: '2px 0px' })
    ],
    layout: ui.Panel.Layout.flow('horizontal')
});

var legendTitle = ui.Label({
    value: 'Estimated day of burn',

    style: {
        fontWeight: 'bold',
        fontSize: '20px',
        margin: "5px auto 5px auto"
    }
});

var legendPanel = ui.Panel({
    widgets: [legendTitle, colorBar, legendLabels],
    style: {
        position: "bottom-center"
    }
});



var plotMaxIntersectAreaButton = ui.Button({
    label: 'Plot max intersection area',
    onClick: function () {
        plotOnChart(connectedAreasStatistic,
            CONFIG.maxIntersectAreaReducer,
            CONFIG.maxIntersectAreaChartOptions)
    },
    style:
    {
        margin: "auto",
    }
});

var plotSumBurnedAreaButton = ui.Button({
    label: 'Plot burned area in region',
    onClick: function () {
        plotOnChart(fireIndicatorsStatistic,
            CONFIG.sumBurnedAreaReducer,
            CONFIG.sumBurnedAreaChartOptions
        )
    },
    style:
    {
        margin: "auto"
    }
});

var dateSlider = ui.DateSlider(
    {
        start: CONFIG.startDate,
        end: CONFIG.endDate,
        value: CONFIG.startDate,
        period: 1,
        onChange: showPic
    });


var chartPanel = ui.Panel();
chartPanel.style().set({
    position: 'bottom-left'
});



var collection = ee.ImageCollection("ESA/CCI/FireCCI/5_1")
    .filterDate(CONFIG.startDate, CONFIG.endDate);

var connectedAreasStatistic = collection.map(sumConnectedPixels);
var fireIndicatorsStatistic = collection.map(toFireIndicator);

Map.addLayer(collection.first().select("BurnDate"), baVis);

var geom = geometry;

Map.add(legendPanel)
Map.add(dateSlider);
Map.add(buttonPanel);
Map.add(chartPanel);
Map.setCenter(CONFIG.mapInitLat,
    CONFIG.mapInitLon,
    CONFIG.mapInitZoom);

buttonPanel.add(plotMaxIntersectAreaButton);
buttonPanel.add(plotSumBurnedAreaButton)
Map.drawingTools().onEdit(updateGeometry);
