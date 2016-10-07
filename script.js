require([
  'dojo/dom-construct',

  'esri/layers/CSVLayer',
  'esri/Map',
  'esri/renderers/SimpleRenderer',
  'esri/symbols/SimpleMarkerSymbol',
  'esri/views/MapView',

  'd3/d3.v3.min',
  'c3/c3.min',

  'dojo/domReady!'
], function(
  domConstruct,
  CSVLayer, Map, SimpleRenderer, SimpleMarkerSymbol, MapView,
  d3, c3
) {
  // get DOM references and initialize some shared vars
  var mapControlsNode = document.getElementById('mapControls'),
    yearSliderNode = document.getElementById('yearSlider'),
    yearInfoNode = document.getElementById('yearInfo'),
    totalInfoNode = document.getElementById('totalInfo'),
    credits = document.getElementById('credits'),
    csvLayerView,
    csvLayerViewGraphics,
    summaryChartData = {},
    summaryChart,
    harborChart,
    previousEaseInTimeoutID;

  yearSliderNode.addEventListener('input', function(e) {
    setYear(e.target.value);
  });

  var map = new Map({
    basemap: 'hybrid'
  });

  var mapView = new MapView({
    container: 'viewDiv',
    map: map,
    extent: {
      xmin: -874175.4372126001,
      ymin: 8692603.406494316,
      xmax: -668712.7051821456,
      ymax: 8983064.113977846,
      spatialReference: {
        wkid: 102100
      }
    },
    // center: [-6.93, 61.91],
    // zoom: 9,
    popup: {
      dockEnabled: true,
      dockOptions: {
        buttonEnabled: false,
        breakpoint: false,
        position: 'bottom-left'
      }
    }
  });

  // position and show the credits element
  mapView.ui.add('credits', 'bottom-right');
  credits.style.display = 'block';

  // create the thematic layer of whale counts
  var quantize = d3.scale.quantize().domain([0, 100]).range(d3.range(121));
  var csvThematicLayer = new CSVLayer({
    copyright: '<a href="http://www.hagstova.fo" title="Statistics Faroe Islands" target="_blank">Hagstova Føroya</a>',
    url: 'resources/FaroeWhaling.csv',
    id: 'csvThematicLayer',
    fields: [{
      name: 'whaling_bay',
      type: 'string'
    }, {
      name: 'year',
      type: 'integer'
    }, {
      name: 'hunts',
      type: 'double'
    }, {
      name: 'whales',
      type: 'double'
    }, {
      name: 'skinn_values',
      type: 'double'
    }],
    renderer: new SimpleRenderer({
      symbol: new SimpleMarkerSymbol({
        // size: 0,
        color: [178, 0, 255, 0.4],
        outline: {
          color: [255, 124, 0],
          width: 1
        }
      }),
      visualVariables: [{
        type: 'size',
        field: 'whales',
        stops: [{
          value: 0,
          size: quantize(9)
        }, {
          value: 1,
          size: quantize(10) + 10
        }, {
          value: 25,
          size: quantize(25)
        }, {
          value: 50,
          size: quantize(50)
        }, {
          value: 75,
          size: quantize(75)
        }, {
          value: 100,
          size: quantize(100)
        }]
      }]
    }),
    popupTemplate: {
      title: '{whaling_bay}: {whales} whales',
      content: function(data) {
        // generate popup content using a function
        // return a new c3 graph for each harbor (whaling_bay)
        var popupGraphicAttributes = data.graphic.attributes;
        // var node = domConstruct.create('div', {
        //   id: 'harborChart'
        // });

        // find matching csv graphics for the selected harbor over all years
        var harborTimeseriesAttributes = csvLayerViewGraphics.filter(function(g) {
          return g.attributes.whaling_bay === popupGraphicAttributes.whaling_bay;
        }).map(function(g) {
          return g.attributes;
        });

        harborChart = c3.generate({
          bindTo: domConstruct.create('div', {
            id: 'harborChart'
          }),
          oninit: function() {
            setTimeout(function() {
              // after the new chart is displayed in the popup,
              // select a point on the chart to display the chosen year
              harborChart.select(['whales'], [Object.keys(summaryChartData).indexOf(String(popupGraphicAttributes.year))], true);
            }, 50);
          },
          data: {
            x: 'x',
            columns: [
              ['x'].concat(harborTimeseriesAttributes.map(function(obj) {
                return obj.year;
              })),
              ['whales'].concat(harborTimeseriesAttributes.map(function(obj) {
                return obj.whales;
              }))
            ],
            axes: {
              whales: 'y'
            },
            type: 'spline',
            colors: {
              whales: '#000000'
            },
            selection: {
              enabled: true
            },
            onclick: function(d) {
              // when interacting with the graph,
              // update the year slider and set the current year
              yearSliderNode.value = d.x;
              setYear(d.x);
            }
          },
          axis: {
            x: {
              show: false
            },
            y: {
              show: false
            }
          },
          point: {
            show: false,
            select: {
              r: 3.5
            }
          },
          legend: {
            show: false
          },
          tooltip: {
            show: false
          },
          size: {
            height: 75
          }
        });

        // please don't ask, this is a workaround to get multiple c3 charts to render in the DOM
        harborChart.element.id = 'harborChart';
        return harborChart.element;
      }
    }
  });

  map.add(csvThematicLayer);

  // begin primary business logic of the app
  // once the csv layer view has been created and made ready in the view
  mapView.on('layerview-create', function(e) {
    if (e.layer.id === 'csvThematicLayer') {
      csvLayerView = e.layerView;

      // position and show the map controls element
      mapView.ui.add(mapControlsNode, 'top-right');
      mapControlsNode.style.display = 'block';

      // establish conditional DOM properties based on the view width
      mapViewWidthChange(mapView.widthBreakpoint);
      mapView.watch('widthBreakpoint', function(newValue) {
        mapViewWidthChange(newValue);
      });

      // get access to all the csv layer view graphics
      csvLayerView.queryGraphics().then(function(graphics) {
        csvLayerViewGraphics = graphics;

        // calculate annual stats from individual graphic attributes
        csvLayerViewGraphics.forEach(function(graphic) {
          if (!summaryChartData.hasOwnProperty(graphic.attributes.year)) {
            summaryChartData[graphic.attributes.year] = {};
            summaryChartData[graphic.attributes.year].whaleTotal = 0;
            // summaryChartData[graphic.attributes.year].huntTotal = 0;
          }
          summaryChartData[graphic.attributes.year].whaleTotal += graphic.attributes.whales;
          // summaryChartData[graphic.attributes.year].huntTotal += graphic.attributes.hunts;
        });

        // generate the summary chart of total whales per year
        summaryChart = c3.generate({
          bindTo: '#chart',
          data: {
            x: 'x',
            columns: [
              ['x'].concat(Object.keys(summaryChartData)),
              ['whales'].concat(Object.keys(summaryChartData).map(function(year) {
                return (summaryChartData[year].whaleTotal);
              }))
              // ['hunts'].concat(Object.keys(summaryChartData).map(function(year) {
              //   return (summaryChartData[year].huntTotal);
              // }))
            ],
            axes: {
              whales: 'y',
              // hunts: 'y2'
            },
            type: 'spline',
            colors: {
              whales: '#000000'
                // hunts: '#ffffff'
            },
            selection: {
              enabled: true
            },
            onclick: function(d) {
              // when interacting with the graph,
              // update the year slider and set the current year
              yearSliderNode.value = d.x;
              setYear(d.x);
            }
          },
          axis: {
            x: {
              show: false
            },
            y: {
              show: false
            },
            y2: {
              show: false
            }
          },
          point: {
            show: false,
            select: {
              r: 3.5
            }
          },
          legend: {
            show: false
          },
          tooltip: {
            show: false
          },
          size: {
            height: 75
          }
        });

        // please don't ask, this is a workaround to get multiple c3 charts to render in the DOM
        summaryChart.element.id = "summaryChart";

        // finally, set the initial year value for the app
        // but use a timeout because the svg parent g element of the circles won't be available in the DOM yet
        setTimeout(function() {
          setYear(1996);
        }, 250);
      });
    }
  });

  // the year can be changed by interacting with:
  //  - the range slider
  //  - the summary chart
  //  - a local harbor chart in the popup
  function setYear(year) {
    yearInfoNode.innerHTML = year;
    totalInfoNode.innerHTML = summaryChartData[year].whaleTotal + ' whales';

    var circlesParentElement = document.querySelectorAll('.esri-display-object>svg>g>circle')[0].parentElement;
    circlesParentElement.setAttribute('class', 'g-hidden');

    // toggle each csv graphic's visibility
    year = Number(year);
    csvLayerViewGraphics.forEach(function(g) {
      if (g.attributes.year === year) {
        g.visible = true;
      } else {
        g.visible = false;
      }
    });

    // wait for the custom css transition to finish fading OUT the previously-selected year's graphics
    setTimeout(function() {
      // this timeout is a workaround to "refresh" the csv layer view after changing graphic visibility properties
      // toggling the visible boolean property without a timeout does not appear to do anything until panning/zooming
      csvLayerView.visible = false;
      setTimeout(function() {
        csvLayerView.visible = true;
        // this final timeout is to start (and/or canceling) the custom css transition to fading IN the currently-selected year's graphics
        if (previousEaseInTimeoutID) {
          clearTimeout(previousEaseInTimeoutID);
        }
        previousEaseInTimeoutID = setTimeout(function() {
          circlesParentElement.setAttribute('class', 'g-visible');
        }, 50);
      }, 5);
    }, 200);

    // select a point on the summary chart to display the chosen year
    summaryChart.select(['whales'], [Object.keys(summaryChartData).indexOf(String(year))], true);

    // set popup properties and render content (a local harbor chart) when the year is changed
    if (mapView.popup.visible) {
      // find a matching csv graphic based on the selected harbor and current year
      var harborYearGraphics = csvLayerViewGraphics.filter(function(g) {
        return (g.attributes.whaling_bay === mapView.popup.selectedFeature.attributes.whaling_bay) && (g.attributes.year === year);
      });

      if (harborYearGraphics.length) {
        mapView.popup.open({
          features: [harborYearGraphics[0]],
          updateLocationEnabled: false
        });
      }
    }
  }

  function mapViewWidthChange(widthBreakpoint) {
    if (widthBreakpoint === 'xsmall') {
      mapView.ui.move(mapControlsNode, 'manual');
    } else {
      mapView.ui.move(mapControlsNode, 'top-right');
    }
  }
});
